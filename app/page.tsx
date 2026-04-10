"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { decodeUnsignedTransaction } from "algosdk";
import { WalletButton } from "@/app/components/WalletButton";
import { peraWallet } from "@/app/lib/wallet";
import type { DeployResult } from "@/app/types/wallet";

type Network = "testnet" | "mainnet";
type Stack = "python" | "typescript";
type Theme = "light" | "dark";
type FileMap = Record<string, string>;

type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: TreeNode[];
};

const PYTHON_CONTRACT_PATH = "smart_contracts/hello_world/contract.py";
const TYPESCRIPT_CONTRACT_PATH = "smart_contracts/hello_world/contract.algo.ts";

const PYTHON_PROJECT_FILES: FileMap = {
  ".env.template": "ALGOD_SERVER=https://testnet-api.algonode.cloud\nALGOD_TOKEN=\nINDEXER_SERVER=https://testnet-idx.algonode.cloud\nINDEXER_TOKEN=\n",
  "pyproject.toml": "[project]\nname = \"algokit-contracts\"\nversion = \"0.1.0\"\nrequires-python = \">=3.12\"\n\n[tool.black]\nline-length = 100\n",
  "requirements.txt": "algopy>=0.8.0\nalgokit-utils>=3.0.0\n",
  "smart_contracts/__main__.py": "from smart_contracts.hello_world.contract import Counter\n\nif __name__ == \"__main__\":\n    print(\"Build artifacts for\", Counter.__name__)\n",
  "smart_contracts/hello_world/contract.py": "from algopy import ARC4Contract\n\nclass Counter(ARC4Contract):\n    count: int = 0\n\n    def increment(self) -> int:\n        self.count += 1\n        return self.count\n",
  "smart_contracts/hello_world/deploy_config.py": "from dataclasses import dataclass\n\n@dataclass\nclass DeployConfig:\n    app_name: str = \"Counter\"\n    updatable: bool = True\n    deletable: bool = True\n",
  "artifacts/README.md": "Generated contract artifacts appear here after build/deploy.\n",
};

const TYPESCRIPT_PROJECT_FILES: FileMap = {
  ".env.template": "ALGOD_SERVER=https://testnet-api.algonode.cloud\nALGOD_TOKEN=\nINDEXER_SERVER=https://testnet-idx.algonode.cloud\nINDEXER_TOKEN=\n",
  "package.json": "{\n  \"name\": \"algokit-contracts\",\n  \"private\": true,\n  \"scripts\": {\n    \"build\": \"algokit compile\",\n    \"deploy\": \"algokit deploy\"\n  }\n}\n",
  "tsconfig.json": "{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"module\": \"ESNext\",\n    \"strict\": true\n  }\n}\n",
  "smart_contracts/index.ts": "export * from './hello_world/contract.algo'\n",
  "smart_contracts/hello_world/contract.algo.ts": "import { Contract, GlobalStateKey, uint64 } from '@algorandfoundation/algorand-typescript'\n\nexport class Counter extends Contract {\n  count = GlobalStateKey<uint64>()\n\n  increment(): uint64 {\n    this.count.value += 1\n    return this.count.value\n  }\n}\n",
  "smart_contracts/hello_world/deploy_config.ts": "export const deployConfig = {\n  appName: 'Counter',\n  updatable: true,\n  deletable: true,\n}\n",
  "artifacts/README.md": "Generated contract artifacts appear here after build/deploy.\n",
};

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = {
    name: "root",
    path: "",
    kind: "folder",
    children: [],
  };

  for (const fullPath of paths) {
    const parts = fullPath.split("/");
    let current = root;
    let currentPath = "";

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (!current.children) {
        current.children = [];
      }

      let child = current.children.find((node) => node.name === part);

      if (!child) {
        child = {
          name: part,
          path: currentPath,
          kind: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        current.children.push(child);
      }

      if (!isFile) {
        current = child;
      }
    }
  }

  const normalize = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .map((node) => ({
        ...node,
        children: node.children ? normalize(node.children) : undefined,
      }))
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  };

  return normalize(root.children || []);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }
  return btoa(binary);
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("light");
  const [stack, setStack] = useState<Stack | null>(null);
  const [network, setNetwork] = useState<Network>("testnet");
  const [fileContents, setFileContents] = useState<FileMap>({});
  const [openFilePath, setOpenFilePath] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([
    "smart_contracts",
    "smart_contracts/hello_world",
    "artifacts",
  ]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "AlgoIDE v1.0.0 initialized.",
    "Awaiting commands...",
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [terminalLogs]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedTheme = window.localStorage.getItem("algoide-theme");
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const initialTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? (savedTheme as Theme)
        : systemTheme;

    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const tree = useMemo(() => buildTree(Object.keys(fileContents)), [fileContents]);

  const activeContractPath = useMemo(() => {
    if (stack === "python") {
      return PYTHON_CONTRACT_PATH;
    }
    if (stack === "typescript") {
      return TYPESCRIPT_CONTRACT_PATH;
    }
    return "";
  }, [stack]);

  const openFileContent = useMemo(() => {
    if (!openFilePath) return "";
    return fileContents[openFilePath] || "";
  }, [fileContents, openFilePath]);

  const addLog = useCallback((msg: string) => {
    setTerminalLogs((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].endsWith(msg)) {
        return prev;
      }
      const next = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return next.slice(-120);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("algoide-theme", next);
      }
      document.documentElement.setAttribute("data-theme", next);
      if (stack) {
        addLog(`THEME: ${next.toUpperCase()} mode enabled.`);
      }
      return next;
    });
  }, [addLog, stack]);

  const chooseStack = useCallback(
    (nextStack: Stack) => {
      const initialFiles =
        nextStack === "python" ? PYTHON_PROJECT_FILES : TYPESCRIPT_PROJECT_FILES;
      const defaultFile =
        nextStack === "python" ? PYTHON_CONTRACT_PATH : TYPESCRIPT_CONTRACT_PATH;

      setStack(nextStack);
      setFileContents(initialFiles);
      setOpenFilePath(defaultFile);
      setExpandedFolders(["smart_contracts", "smart_contracts/hello_world", "artifacts"]);
      addLog(
        `PROJECT: ${nextStack === "python" ? "Python" : "TypeScript"} contract template loaded.`,
      );
    },
    [addLog],
  );

  const handleAddressChange = useCallback((addr: string | null) => {
    setWalletAddress((prev) => {
      if (prev === addr) return prev;
      if (addr) addLog(`WALLET: Connected ${addr.slice(0, 6)}...${addr.slice(-4)}`);
      else addLog("WALLET: Disconnected");
      return addr;
    });
  }, [addLog]);

  const handleDeploy = useCallback(async () => {
    if (!walletAddress) {
      addLog("ERROR: Please connect your wallet first.");
      return;
    }

    setIsDeploying(true);
    addLog(`INIT: Deploying to ${network.toUpperCase()}...`);

    try {
      const contractCode = fileContents[activeContractPath] || "";
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ network, contractCode, sender: walletAddress }),
      });

      const data = (await response.json()) as DeployResult | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Deployment failed.");
      }

      if (data.status === "sign") {
        addLog("ACTION: Please sign the transaction in your wallet...");

        if (!data.unsignedTxn) {
          throw new Error("Missing unsigned transaction payload.");
        }

        const unsignedTransaction = decodeUnsignedTransaction(base64ToBytes(data.unsignedTxn));
        const signedTxns = await peraWallet.signTransaction([
          [{ txn: unsignedTransaction, signers: [walletAddress] }],
        ]);

        addLog("SUCCESS: Transaction signed. Submitting to network...");
        const confirmResponse = await fetch("/api/deploy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network,
            contractCode: fileContents[activeContractPath] || "",
            sender: walletAddress,
            signedTxn: bytesToBase64(signedTxns[0]),
            deploymentId: data.deploymentId,
          }),
        });

        const confirmedData = (await confirmResponse.json()) as DeployResult;
        if (confirmedData.appId) {
          addLog(`SUCCESS: Contract deployed! App ID: ${confirmedData.appId}`);
          if (confirmedData.contractAddress) {
            addLog(`ADDRESS: ${confirmedData.contractAddress}`);
          }
        } else if (confirmedData.txId) {
          addLog(`SUCCESS: Transaction confirmed. TX ID: ${confirmedData.txId}`);
        } else {
          addLog("SUCCESS: Transaction confirmed.");
        }
        addLog(`LINK: ${confirmedData.explorer}`);
      } else {
        // Fallback for simulated flow
        addLog(`SUCCESS: Deployment payload accepted.`);
        if (data.explorer) addLog(`EXPLORER: ${data.explorer}`);
      }
    } catch (deployError: unknown) {
      if (deployError && typeof deployError === "object" && (deployError as { name?: string }).name === "PeraWalletConnectError") {
        addLog("ERROR: Transaction signature was cancelled by user.");
      } else {
        const message =
          deployError instanceof Error ? deployError.message : "Could not deploy contract.";
        addLog(`ERROR: ${message}`);
      }
    } finally {
      setIsDeploying(false);
    }
  }, [activeContractPath, addLog, fileContents, network, walletAddress]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) =>
      prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path],
    );
  }, []);

  const openFile = useCallback(
    (path: string) => {
      setOpenFilePath(path);
      addLog(`FILE: Opened ${path}`);
    },
    [addLog],
  );

  const updateOpenFile = useCallback(
    (value: string) => {
      if (!openFilePath) return;
      setFileContents((prev) => ({
        ...prev,
        [openFilePath]: value,
      }));
    },
    [openFilePath],
  );

  const renderTree = useCallback(
    (nodes: TreeNode[], depth = 0): React.ReactNode => {
      return nodes.map((node) => {
        if (node.kind === "folder") {
          const isOpen = expandedFolders.includes(node.path);
          return (
            <div key={node.path}>
              <button
                type="button"
                onClick={() => toggleFolder(node.path)}
                className="flex w-full items-center gap-1 py-0.5 text-left font-mono text-xs"
                style={{ paddingLeft: `${depth * 12}px` }}
              >
                <span>{isOpen ? "▾" : "▸"}</span>
                <span className="font-bold">{node.name}</span>
              </button>
              {isOpen && node.children ? renderTree(node.children, depth + 1) : null}
            </div>
          );
        }

        const isActive = openFilePath === node.path;
        return (
          <button
            key={node.path}
            type="button"
            onClick={() => openFile(node.path)}
            className={`w-full py-0.5 text-left font-mono text-xs ${
              isActive
                ? "bg-[#16CAC6] font-bold text-black border border-black"
                : "text-gray-700 hover:bg-[#e5e5e5]"
            }`}
            style={{ paddingLeft: `${depth * 12}px` }}
          >
            {node.name}
          </button>
        );
      });
    },
    [expandedFolders, openFile, openFilePath, toggleFolder],
  );

  if (!stack) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-2xl brutal-border brutal-shadow bg-white p-6">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={toggleTheme}
              className="border-2 border-black px-3 py-1 text-xs font-bold uppercase hover:bg-[#e5e5e5]"
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#16CAC6]">AlgoIDE Setup</p>
          <h1 className="mt-2 text-2xl font-black">Choose your smart contract stack</h1>
          <p className="mt-2 text-sm">Select one first, then the IDE opens with the full contract project tree.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseStack("python")}
              className="brutal-button h-28 w-full"
            >
              Python
            </button>
            <button
              type="button"
              onClick={() => chooseStack("typescript")}
              className="brutal-button h-28 w-full"
            >
              TypeScript
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white text-black font-sans box-border selection:bg-[#16CAC6] selection:text-black">
      {/* Top Navbar */}
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 bg-white px-4 py-2 brutal-border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: "var(--font-code)" }}>
            ALGO<span className="text-[#16CAC6]">IDE</span>
          </h1>
          <button
            type="button"
            onClick={toggleTheme}
            className="border-2 border-black px-2 py-1 text-xs font-bold uppercase hover:bg-[#e5e5e5]"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            onClick={() => setStack(null)}
            className="border-2 border-black px-2 py-1 text-xs font-bold uppercase hover:bg-[#e5e5e5]"
          >
            Switch Stack
          </button>
          <div className="flex bg-[#e5e5e5] brutal-border p-1">
             <button
              type="button"
              onClick={() => {
                setNetwork("testnet");
                addLog("NETWORK: Switched to TestNet");
              }}
              className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${network === "testnet" ? "bg-[#16CAC6] border-2 border-black" : "hover:bg-white border-2 border-transparent"}`}
            >
              TestNet
            </button>
            <button
              type="button"
              onClick={() => {
                setNetwork("mainnet");
                addLog("NETWORK: Switched to MainNet");
              }}
              className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${network === "mainnet" ? "bg-[#16CAC6] border-2 border-black" : "hover:bg-white border-2 border-transparent"}`}
            >
              MainNet
            </button>
          </div>
        </div>
        
        <div>
          <WalletButton onAddressChange={handleAddressChange} />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:flex-row">
        
        {/* Left Sidebar */}
        <aside className="w-full border-b-[3px] border-black bg-white lg:w-[22rem] lg:border-r-[3px] lg:border-b-0 flex max-h-[45vh] flex-col shrink-0 lg:max-h-none">
          <div className="p-3 brutal-border-b bg-[#e5e5e5]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">Contract Workspace</h2>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            <div>
              <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-3">Files</h3>
              <p className="mb-2 text-[10px] font-bold uppercase text-gray-600">
                {stack === "python" ? "Python Contract Project" : "TypeScript Contract Project"}
              </p>
              <div className="space-y-0.5">{renderTree(tree)}</div>
            </div>

            <div>
              <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-3">🚀 DEPLOY</h3>
              <p className="text-xs mb-4">Deploy {activeContractPath.split("/").pop()} to {network.toUpperCase()}.</p>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || !walletAddress}
                className="brutal-button w-full text-center flex justify-center items-center gap-2"
              >
                {isDeploying ? "Deploying..." : "One-Click Deploy"}
              </button>
              {!walletAddress && <p className="text-[10px] text-red-600 font-bold mt-2 leading-tight">Must connect wallet first!</p>}
            </div>
            
             <div className="mt-8 p-3 brutal-border bg-[#16CAC6]/10">
              <h3 className="text-xs font-bold uppercase mb-2">IDE Status</h3>
              <p className="text-xs font-mono mb-1">Compiler: OK</p>
              <p className="text-xs font-mono">Project: {stack === "python" ? "Python" : "TypeScript"}</p>
            </div>
          </div>
        </aside>

        {/* Center Editor & Terminal Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* Tabs */}
          <div className="flex h-10 brutal-border-b bg-[#e5e5e5] shrink-0">
            <div className="px-4 py-2 border-r-3 border-black bg-white flex items-center gap-2 relative top-[-1px] font-mono text-sm font-bold border-b-white z-10 box-content">
              {openFilePath || "No file selected"}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 relative bg-white p-4">
             <textarea
              aria-label="Smart contract editor"
              value={openFileContent}
              onChange={(event) => updateOpenFile(event.target.value)}
              className="editor-textarea"
              spellCheck={false}
              disabled={!openFilePath}
            />
          </div>

          {/* Terminal / Output */}
          <div className="h-52 lg:h-56 brutal-border-t bg-black text-[#16cac6] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-1 border-b border-gray-800 shrink-0">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Console Output</span>
              <button 
                type="button"
                onClick={() => setTerminalLogs(["Console cleared."])}
                className="text-[10px] uppercase font-bold text-gray-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
              {terminalLogs.map((log, i) => (
                <div key={i} className="mb-1 leading-snug">
                  {log.startsWith("[") ? (
                    <>
                       <span className="text-gray-500 mr-2">{log.substring(0, 11)}</span>
                       <span className={log.includes("ERROR") ? "text-red-400" : log.includes("SUCCESS") ? "text-green-400" : "text-[#16cac6]"}>
                        {log.substring(11)}
                       </span>
                    </>
                  ) : (
                    log
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
