"use client";

import { useMemo, useState, useCallback } from "react";
import { algosdk } from "@/app/lib/algorand";
import { WalletButton } from "@/app/components/WalletButton";
import { peraWallet } from "@/app/lib/wallet";
import type { DeployResult } from "@/app/types/wallet";

type Network = "testnet" | "mainnet";

const defaultPythonContract = `from algopy import ARC4Contract

class Counter(ARC4Contract):
    count: int = 0

    def increment(self) -> int:
        self.count += 1
        return self.count`;

const defaultTealContract = `#pragma version 10
// Simple Counter Application

// Global state keys
byte "counter"
int 0
app_global_get
int 1
+
// Store the new value
dup
byte "counter"
int 0
app_global_put

// Return the new count
int 1
retsub

// Application ID: 0 (creating new app)
// On creation:
txn ApplicationID
int 0
==
bnz main

// Clear state
int 1
return

main:
int 1
return`;

export default function Home() {
  const [network, setNetwork] = useState<Network>("testnet");
  const [contractCode, setContractCode] = useState(defaultTealContract);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingPython, setUsingPython] = useState(false);

  const networkLabel = useMemo(
    () => (network === "testnet" ? "Algorand TestNet" : "Algorand MainNet"),
    [network],
  );

  const handleDeploy = useCallback(async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first.");
      return;
    }

    setIsDeploying(true);
    setError(null);
    setDeployResult(null);

    try {
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
        const signedTxns = await peraWallet.signTransaction([
          {
            transaction: data.unsignedTxn,
            signers: [walletAddress],
          },
        ]);

        const confirmResponse = await fetch("/api/deploy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network,
            contractCode,
            sender: walletAddress,
            signedTxn: signedTxns[0],
            deploymentId: data.deploymentId,
          }),
        });

        const confirmedData = (await confirmResponse.json()) as DeployResult;
        setDeployResult(confirmedData);
      } else {
        setDeployResult(data);
      }
    } catch (deployError) {
      const message =
        deployError instanceof Error ? deployError.message : "Could not deploy contract.";
      setError(message);
      setDeployResult(null);
    } finally {
      setIsDeploying(false);
    }
  }, [network, contractCode, walletAddress]);

  const loadPythonTemplate = () => {
    setContractCode(defaultPythonContract);
    setUsingPython(true);
  };

  const loadTealTemplate = () => {
    setContractCode(defaultTealContract);
    setUsingPython(false);
  };

  return (
    <div className="min-h-screen bg-hero-pattern text-slate-100">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">AlgoIDE</p>
          <h1 className="text-xl font-semibold sm:text-2xl">Web Smart Contract Studio</h1>
        </div>
        <WalletButton onAddressChange={setWalletAddress} />
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
                className={`network-pill ${network === "testnet" ? "network-pill-active" : ""}`}
              >
                TestNet
              </button>
              <button
                type="button"
                onClick={() => setNetwork("mainnet")}
                className={`network-pill ${network === "mainnet" ? "network-pill-active" : ""}`}
              >
                MainNet
              </button>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-slate-100">Contract Language</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={loadTealTemplate}
                className={`network-pill ${!usingPython ? "network-pill-active" : ""}`}
              >
                TEAL
              </button>
              <button
                type="button"
                onClick={loadPythonTemplate}
                className={`network-pill ${usingPython ? "network-pill-active" : ""}`}
              >
                Python
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {usingPython
                ? "Python requires server-side compilation"
                : "TEAL compiled client-side via Algorand SDK"}
            </p>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Contract editor</h2>
            <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              {usingPython ? "Python ARC4 template" : "TEAL template"}
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
            {walletAddress
              ? "Ready to deploy. Click the deploy button to sign and submit."
              : "Connect your wallet to enable deployment."}
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Deploy</h2>
          <p className="text-sm text-slate-200/85">
            {walletAddress
              ? "Your wallet is connected. Click to deploy your contract."
              : "Connect your wallet to deploy to the selected network."}
          </p>

          <button
            type="button"
            onClick={handleDeploy}
            disabled={isDeploying || !walletAddress}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isDeploying ? "Deploying..." : walletAddress ? "Deploy Contract" : "Connect Wallet First"}
          </button>

          {error ? (
            <p className="mt-3 rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          {deployResult && deployResult.status === "success" ? (
            <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
              <p className="text-emerald-300">Status: Deployed Successfully</p>
              <p className="mt-1 text-slate-100">App ID: {deployResult.appId}</p>
              <p className="mt-1 text-slate-300">TX ID: {deployResult.txId?.slice(0, 20)}...</p>
              <a
                href={deployResult.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-cyan-300 underline decoration-cyan-400/60 underline-offset-4"
              >
                Open in Explorer
              </a>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="mb-2 text-sm font-semibold">Deployment Flow</p>
            <ol className="space-y-1 text-xs text-slate-300/85">
              <li>1. Write or edit your contract</li>
              <li>2. Connect Pera wallet</li>
              <li>3. Click deploy to sign & submit</li>
              <li>4. View your app on explorer</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
