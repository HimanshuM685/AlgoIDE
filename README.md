# AlgoIDE

Remix-style web IDE concept for Algorand smart contracts.

Goal: users open a browser, write contract code, and deploy with one click without running local AlgoKit setup steps.

## Local development

Run the app:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Product workflow

1. Project is pre-initialized in the web app.
2. User writes or edits a smart contract.
3. User chooses target network: TestNet or MainNet.
4. User clicks One-click deploy.

## Command mapping

- algokit init: not required in this UX
- algokit project bootstrap: not required in this UX
- npm run build: compile/build the web app
- npm run deploy: represented by the in-app deploy button

## Current deploy implementation

The deploy endpoint currently returns a queued deployment response and explorer link for the selected network.

For production-grade deployment, connect:

- Wallet signing (Pera / Defly / WalletConnect)
- On-chain transaction submission through Algod indexer/relay infrastructure
- Contract compiler pipeline and bytecode validation
