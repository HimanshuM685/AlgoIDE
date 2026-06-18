// AlgoIDE command sandbox.
//
// SECURITY MODEL
// --------------
// Nothing here ever touches a real shell or the real filesystem. Every command
// is parsed in JS and "executed" purely against an in-memory FileMap (the same
// object the editor persists to localStorage). That means even a command that
// slips past validation cannot read, write, or destroy anything on the host.
//
// On top of that hard boundary we add defense-in-depth + UX:
//   1. validateCommand() classifies input as `allowed` or `blocked` against an
//      allowlist of command roots and a denylist of dangerous shell syntax.
//   2. The UI shows the verdict and requires explicit confirmation before an
//      `allowed` command runs ("check before running"). `blocked` commands are
//      never runnable.
//   3. runCommand() only mutates a copy of the FileMap and returns the result.

export type FileMap = Record<string, string>;
export type Stack = "python" | "typescript";

export type Verdict = {
  status: "allowed" | "blocked";
  reason?: string;
  command: string;
  argv: string[];
};

export type RunResult = {
  // Lines to print to the console. Prefix with ERROR:/SUCCESS: for coloring.
  logs: string[];
  // When present, replaces the whole file map (file create/move/delete/scaffold).
  files?: FileMap;
  // When present, asks the IDE to open this path in the editor.
  openFile?: string;
  // When true, asks the IDE to trigger the real wallet deploy flow.
  deploy?: boolean;
  // When true, asks the IDE to clear the console.
  clear?: boolean;
};

// Command roots the sandbox understands. Anything else is blocked outright.
const ALLOWED_ROOTS = new Set([
  "algokit",
  "ls",
  "tree",
  "cat",
  "touch",
  "mkdir",
  "rm",
  "mv",
  "cp",
  "echo",
  "pwd",
  "clear",
  "help",
]);

// Denylist of shell syntax / binaries. Each entry blocks the command and is
// reported to the user so they understand why.
const DANGEROUS_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /[;&|`]/, reason: "command chaining or piping (; & | `) is not allowed" },
  { re: /\$\(|\$\{|<\(/, reason: "command or parameter substitution is not allowed" },
  { re: /[<>]/, reason: "input/output redirection (< >) is not allowed" },
  { re: /(^|\s)~(\/|\s|$)/, reason: "home-directory (~) paths are not allowed" },
  { re: /(^|\s)\//, reason: "absolute paths are not allowed; use project-relative paths" },
  { re: /\.\.(\/|$)/, reason: "path traversal ('..') is not allowed" },
  {
    re: /\b(sudo|su|chmod|chown|curl|wget|nc|ncat|netcat|telnet|ssh|scp|ftp|eval|exec|node|deno|bun|python3?|perl|ruby|sh|bash|zsh|fish|kill|killall|reboot|shutdown|halt|mkfs|dd|fork|crontab|launchctl|systemctl)\b/,
    reason: "potentially unsafe binary or keyword",
  },
  { re: /\brm\b[^]*\s-{1,2}\w*[rf]/, reason: "recursive/forced delete (rm -rf) is not allowed" },
];

const MAX_LENGTH = 200;

function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

export function validateCommand(input: string): Verdict {
  const command = input.trim();
  const argv = tokenize(command);
  const base = { command, argv };

  if (!command) {
    return { status: "blocked", reason: "empty command", ...base };
  }
  if (command.length > MAX_LENGTH) {
    return { status: "blocked", reason: `command exceeds ${MAX_LENGTH} characters`, ...base };
  }
  for (const { re, reason } of DANGEROUS_PATTERNS) {
    if (re.test(command)) {
      return { status: "blocked", reason, ...base };
    }
  }
  const root = argv[0];
  if (!ALLOWED_ROOTS.has(root)) {
    return {
      status: "blocked",
      reason: `'${root}' is not an allowed command. Type 'help' to see what's available.`,
      ...base,
    };
  }
  return { status: "allowed", ...base };
}

// ---------------------------------------------------------------------------
// FileMap helpers (folders are implied by file path prefixes)
// ---------------------------------------------------------------------------

function fileExists(files: FileMap, path: string): boolean {
  return Object.prototype.hasOwnProperty.call(files, path);
}

function folderExists(files: FileMap, path: string): boolean {
  const prefix = `${path}/`;
  return Object.keys(files).some((key) => key.startsWith(prefix));
}

function listDir(files: FileMap, dir: string): string[] {
  const prefix = dir ? `${dir}/` : "";
  const entries = new Set<string>();
  for (const key of Object.keys(files)) {
    if (dir && !key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    if (!rest) continue;
    const slash = rest.indexOf("/");
    entries.add(slash === -1 ? rest : `${rest.slice(0, slash)}/`);
  }
  return [...entries].sort((a, b) => {
    const aDir = a.endsWith("/");
    const bDir = b.endsWith("/");
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.localeCompare(b);
  });
}

const CONTRACTS_DIR: Record<Stack, string> = {
  python: "smart_contracts",
  typescript: "contracts",
};

function scaffoldContract(stack: Stack, name: string): { path: string; content: string } {
  if (stack === "python") {
    return {
      path: `smart_contracts/${name}/contract.py`,
      content: `from algopy import ARC4Contract, arc4\n\nclass ${toClassName(name)}(ARC4Contract):\n    @arc4.abimethod\n    def hello(self, name: arc4.String) -> arc4.String:\n        return "Hello, " + name\n`,
    };
  }
  return {
    path: `contracts/${name}.algo.ts`,
    content: `import { Contract } from '@algorandfoundation/algorand-typescript'\n\nexport class ${toClassName(name)} extends Contract {\n  hello(name: string): string {\n    return \`Hello, \${name}\`\n  }\n}\n`,
  };
}

function toClassName(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") || "Contract";
}

// Reject path arguments that are empty or otherwise unusable. Traversal and
// absolute paths are already blocked by validateCommand, but file ops re-check
// so the executor is safe to call directly (e.g. from sidebar buttons).
function badPath(path: string | undefined): string | null {
  if (!path) return "missing path argument";
  if (path.startsWith("/")) return "absolute paths are not allowed";
  if (path.split("/").includes("..")) return "path traversal is not allowed";
  if (path.length > MAX_LENGTH) return "path is too long";
  return null;
}

// ---------------------------------------------------------------------------
// Executor — pure function over a FileMap copy
// ---------------------------------------------------------------------------

export function runCommand(argv: string[], files: FileMap, ctx: { stack: Stack }): RunResult {
  const [root, sub, ...rest] = argv;
  const next = { ...files };

  switch (root) {
    case "help":
      return { logs: helpText() };

    case "clear":
      return { logs: [], clear: true };

    case "pwd":
      return { logs: ["/project"] };

    case "echo":
      return { logs: [argv.slice(1).join(" ")] };

    case "ls":
    case "tree": {
      const dir = sub ?? "";
      if (dir && !folderExists(files, dir)) {
        return { logs: [`ERROR: no such directory: ${dir}`] };
      }
      const entries = listDir(files, dir);
      return { logs: entries.length ? entries : ["(empty)"] };
    }

    case "cat": {
      const bad = badPath(sub);
      if (bad) return { logs: [`ERROR: ${bad}`] };
      if (!fileExists(files, sub)) return { logs: [`ERROR: no such file: ${sub}`] };
      return { logs: files[sub].split("\n") };
    }

    case "touch": {
      const bad = badPath(sub);
      if (bad) return { logs: [`ERROR: ${bad}`] };
      if (fileExists(files, sub)) return { logs: [`ERROR: file already exists: ${sub}`] };
      next[sub] = "";
      return { logs: [`SUCCESS: created ${sub}`], files: next, openFile: sub };
    }

    case "mkdir": {
      const bad = badPath(sub);
      if (bad) return { logs: [`ERROR: ${bad}`] };
      const keep = `${sub}/.gitkeep`;
      if (fileExists(files, keep) || folderExists(files, sub)) {
        return { logs: [`ERROR: directory already exists: ${sub}`] };
      }
      next[keep] = "";
      return { logs: [`SUCCESS: created directory ${sub}`], files: next };
    }

    case "rm": {
      const bad = badPath(sub);
      if (bad) return { logs: [`ERROR: ${bad}`] };
      if (!fileExists(files, sub)) return { logs: [`ERROR: no such file: ${sub}`] };
      delete next[sub];
      return { logs: [`SUCCESS: removed ${sub}`], files: next };
    }

    case "mv":
    case "cp": {
      const [src, dst] = [sub, rest[0]];
      const badSrc = badPath(src);
      const badDst = badPath(dst);
      if (badSrc) return { logs: [`ERROR: source: ${badSrc}`] };
      if (badDst) return { logs: [`ERROR: destination: ${badDst}`] };

      const verb = root === "mv" ? "moved" : "copied";

      // File case.
      if (fileExists(files, src)) {
        if (fileExists(files, dst)) return { logs: [`ERROR: destination already exists: ${dst}`] };
        next[dst] = files[src];
        if (root === "mv") delete next[src];
        return { logs: [`SUCCESS: ${verb} ${src} -> ${dst}`], files: next, openFile: dst };
      }

      // Folder case — operate on every key under src/.
      if (folderExists(files, src)) {
        const prefix = `${src}/`;
        for (const key of Object.keys(files)) {
          if (!key.startsWith(prefix)) continue;
          const target = `${dst}/${key.slice(prefix.length)}`;
          next[target] = files[key];
          if (root === "mv") delete next[key];
        }
        return { logs: [`SUCCESS: ${verb} ${src}/ -> ${dst}/`], files: next };
      }

      return { logs: [`ERROR: no such file or directory: ${src}`] };
    }

    case "algokit":
      return runAlgokit(sub, rest, files, next, ctx);

    default:
      return { logs: [`ERROR: '${root}' is not supported.`] };
  }
}

function runAlgokit(
  sub: string | undefined,
  rest: string[],
  files: FileMap,
  next: FileMap,
  ctx: { stack: Stack },
): RunResult {
  switch (sub) {
    case undefined:
    case "--help":
    case "-h":
      return { logs: algokitHelp() };

    case "--version":
    case "-v":
      return { logs: ["algokit 2.0.0 (AlgoIDE simulated)"] };

    case "doctor":
      return {
        logs: [
          "SUCCESS: AlgoKit doctor (simulated)",
          "  AlgoKit........ 2.0.0",
          `  Stack.......... ${ctx.stack}`,
          "  Algod.......... testnet-api.algonode.cloud (reachable)",
          "  Wallet......... Pera Connect available",
        ],
      };

    case "init":
    case "bootstrap":
      return {
        logs: [
          "INFO: project already initialized in this workspace.",
          "INFO: use 'algokit generate <name>' to add a contract.",
        ],
      };

    case "generate":
    case "generate-contract": {
      const name = (rest[0] || "").replace(/[^a-zA-Z0-9_-]/g, "");
      if (!name) return { logs: ["ERROR: usage: algokit generate <contract-name>"] };
      const { path, content } = scaffoldContract(ctx.stack, name);
      if (fileExists(files, path)) return { logs: [`ERROR: contract already exists: ${path}`] };
      next[path] = content;
      return { logs: [`SUCCESS: generated ${path}`], files: next, openFile: path };
    }

    case "compile":
    case "build":
      return runCompile(rest, files, ctx);

    case "project":
      if (rest[0] === "run" && rest[1] === "build") return runCompile(rest.slice(2), files, ctx);
      if (rest[0] === "list") return { logs: [`hello_world (${ctx.stack})`] };
      return { logs: [`ERROR: unsupported 'algokit project ${rest.join(" ")}'`] };

    case "deploy":
      return { logs: ["INIT: handing off to wallet deploy flow..."], deploy: true };

    case "explore":
      return { logs: ["LINK: https://testnet.explorer.perawallet.app"] };

    default:
      return { logs: [`ERROR: unknown algokit subcommand: ${sub}. Try 'algokit --help'.`] };
  }
}

function runCompile(rest: string[], files: FileMap, ctx: { stack: Stack }): RunResult {
  const dir = CONTRACTS_DIR[ctx.stack];
  const contracts = Object.keys(files).filter(
    (key) =>
      key.startsWith(`${dir}/`) &&
      (key.endsWith(".py") || key.endsWith(".algo.ts")) &&
      !key.includes("__pycache__"),
  );
  if (!contracts.length) {
    return { logs: [`ERROR: no contract sources found under ${dir}/`] };
  }
  const logs = ["INFO: compiling contracts..."];
  for (const path of contracts) {
    const body = files[path].trim();
    if (body.length < 12) {
      logs.push(`ERROR: ${path} is empty or too short to compile.`);
      continue;
    }
    logs.push(`SUCCESS: compiled ${path}`);
  }
  return { logs };
}

function helpText(): string[] {
  return [
    "AlgoIDE sandbox — available commands:",
    "  File system (operate on the in-memory project, never your disk):",
    "    ls [dir] | tree [dir] | cat <file> | touch <file> | mkdir <dir>",
    "    rm <file> | mv <src> <dst> | cp <src> <dst> | echo <text> | pwd",
    "  AlgoKit (simulated):",
    "    algokit --version | algokit doctor | algokit generate <name>",
    "    algokit compile | algokit project run build | algokit deploy",
    "  Misc: clear | help",
    "Blocked: pipes, chaining, redirection, absolute/.. paths, and system binaries.",
  ];
}

function algokitHelp(): string[] {
  return [
    "algokit <command> (simulated):",
    "  --version            show version",
    "  doctor               check the simulated toolchain",
    "  generate <name>      scaffold a new contract for the active stack",
    "  compile              compile contract sources",
    "  project run build    same as compile",
    "  deploy               start the wallet deploy flow",
    "  explore              print the block explorer link",
  ];
}
