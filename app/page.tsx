"use client";

import { useMemo, useState } from "react";

type Network = "testnet" | "mainnet";

type DeployResult = {
  deploymentId: string;
  network: Network;
  explorer: string;
  status: string;
  message: string;
};

const defaultPythonContract = `from algopy import ARC4Contract

class Counter(ARC4Contract):
    count: int = 0

    def increment(self) -> int:
        self.count += 1
        return self.count`;

export default function Home() {
  const [network, setNetwork] = useState<Network>("testnet");
  const [contractCode, setContractCode] = useState(defaultPythonContract);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const networkLabel = useMemo(
    () => (network === "testnet" ? "Algorand TestNet" : "Algorand MainNet"),
    [network],
  );

  async function handleDeploy() {
    setIsDeploying(true);
    setError(null);

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ network, contractCode }),
      });

      const data = (await response.json()) as DeployResult | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Deployment failed.");
      }

      setDeployResult(data);
    } catch (deployError) {
      const message =
        deployError instanceof Error
          ? deployError.message
          : "Could not deploy contract.";
      setError(message);
      setDeployResult(null);
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero-pattern text-slate-100">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">AlgoIDE</p>
          <h1 className="text-xl font-semibold sm:text-2xl">Web Smart Contract Studio</h1>
        </div>
        <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm backdrop-blur">
          Project initialized in browser
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 pb-12 lg:grid-cols-[1.2fr_2fr_1.2fr] lg:px-10">
        <section className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Zero setup workflow</h2>
          <ul className="space-y-2 text-sm text-slate-200/85">
            <li>No local AlgoKit install required</li>
            <li>No algokit init or bootstrap step</li>
            <li>No LocalNet requirement</li>
            <li>Deploy directly to selected network</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm">
            <p className="font-medium text-cyan-200">Current target</p>
            <p className="mt-1 text-cyan-100">{networkLabel}</p>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-slate-100">Network</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNetwork("testnet")}
                className={`network-pill ${
                  network === "testnet" ? "network-pill-active" : ""
                }`}
              >
                TestNet
              </button>
              <button
                type="button"
                onClick={() => setNetwork("mainnet")}
                className={`network-pill ${
                  network === "mainnet" ? "network-pill-active" : ""
                }`}
              >
                MainNet
              </button>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Contract editor</h2>
            <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Python ARC4 template
            </span>
          </div>

          <textarea
            aria-label="Smart contract editor"
            value={contractCode}
            onChange={(event) => setContractCode(event.target.value)}
            className="editor h-[430px] w-full"
            spellCheck={false}
          />

          <p className="mt-3 text-xs text-slate-300/75">
            Wallet signing and transaction confirmation can be connected here for full production deployment.
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Deploy</h2>
          <p className="text-sm text-slate-200/85">
            Click once to simulate deployment through the backend route for the selected network.
          </p>

          <button
            type="button"
            onClick={handleDeploy}
            disabled={isDeploying}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isDeploying ? "Deploying..." : "One-click deploy"}
          </button>

          {error ? (
            <p className="mt-3 rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          {deployResult ? (
            <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
              <p className="text-cyan-200">Status: {deployResult.status}</p>
              <p className="mt-1 text-slate-100">{deployResult.message}</p>
              <p className="mt-1 text-slate-300">Deployment ID: {deployResult.deploymentId}</p>
              <a
                href={deployResult.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-cyan-300 underline decoration-cyan-400/60 underline-offset-4"
              >
                Open explorer
              </a>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="mb-2 text-sm font-semibold">Essential commands context</p>
            <ul className="space-y-1 text-xs text-slate-300/85">
              <li>algokit init: skipped in this web IDE flow</li>
              <li>algokit project bootstrap: skipped in this web IDE flow</li>
              <li>npm run build: backend compile/build stage</li>
              <li>npm run deploy: replaced by one-click deploy button</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
