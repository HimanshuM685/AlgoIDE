"use client";

import { WalletButton } from "@/app/components/WalletButton";

const features = [
  {
    title: "Browser-first workflow",
    text: "Start writing contract logic immediately in the browser, with no local setup friction.",
  },
  {
    title: "Wallet-connected deploy",
    text: "Connect a wallet and push to Algorand testnet from one clean action.",
  },
  {
    title: "AlgoKit inspired",
    text: "Built to mirror the fast, guided experience developers expect from AlgoKit.",
  },
];

const steps = [
  "Open the app and initialize the workspace",
  "Write contract logic in the editor",
  "Connect wallet and deploy to testnet",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="brutal-border-b bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center brutal-border bg-[var(--accent)] text-[var(--line)] font-black">
              A
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
                AlgoIDE
              </p>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl">Build Algorand apps faster</h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <span className="rounded-full brutal-border bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold uppercase">
              TestNet Ready
            </span>
            <WalletButton />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-12">
          <div className="brutal-border brutal-shadow bg-[var(--surface)] p-6 sm:p-8">
            <p className="inline-flex rounded-full brutal-border bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-black">
              Neobrutalist Web IDE
            </p>
            <h2 className="mt-5 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Write, connect, and deploy Algorand contracts in one flow.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted-text)] sm:text-lg">
              A clean landing page for your app built around the same rapid experience seen in modern
              contract tooling. Black, white, and #16CAC6, with a sharp developer-first layout.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#launch" className="brutal-button inline-flex items-center justify-center">
                Start Building
              </a>
              <a href="#features" className="inline-flex items-center justify-center brutal-border bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide hover:bg-[var(--surface-muted)]">
                Explore Features
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="brutal-border bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-text)]">Mode</p>
                <p className="mt-2 text-lg font-black">Web IDE</p>
              </div>
              <div className="brutal-border bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-text)]">Network</p>
                <p className="mt-2 text-lg font-black">TestNet</p>
              </div>
              <div className="brutal-border bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-text)]">Wallet</p>
                <p className="mt-2 text-lg font-black">One-click</p>
              </div>
            </div>
          </div>

          <aside className="brutal-border brutal-shadow bg-black p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Preview</p>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase text-white/80">
                Live UI
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="brutal-border border-white/20 bg-white/5 p-4">
                <p className="text-sm font-bold">Contract editor</p>
                <p className="mt-2 text-sm text-white/75">Type smart contract logic here.</p>
              </div>
              <div className="brutal-border border-white/20 bg-white/5 p-4">
                <p className="text-sm font-bold">Wallet connect</p>
                <p className="mt-2 text-sm text-white/75">Connect wallet before deploying.</p>
              </div>
              <div className="brutal-border border-white/20 bg-[var(--accent)] p-4 text-black">
                <p className="text-sm font-bold">Deploy</p>
                <p className="mt-2 text-sm">Send the contract to Algorand testnet.</p>
              </div>
            </div>
          </aside>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="brutal-border brutal-shadow bg-[var(--surface)] p-5">
                <div className="mb-3 h-2 w-12 bg-[var(--accent)]" />
                <h3 className="text-lg font-black">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-text)]">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div className="brutal-border brutal-shadow bg-[var(--surface)] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Flow</p>
            <h3 className="mt-2 text-2xl font-black">Simple launch path</h3>
            <div className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-3 brutal-border bg-white p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center brutal-border bg-[var(--accent)] text-sm font-black text-black">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted-text)]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="launch" className="brutal-border brutal-shadow bg-[var(--surface-muted)] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-black/70">Launch</p>
            <h3 className="mt-2 text-3xl font-black">Start your Algorand build now</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-black/70">
              This landing page is set up to funnel users into the editor, wallet connect, and deploy flow.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/ide" className="brutal-button inline-flex items-center justify-center">
                Open App
              </a>
              <a href="#" className="inline-flex items-center justify-center brutal-border bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide hover:bg-[var(--surface-muted)]">
                Learn More
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
