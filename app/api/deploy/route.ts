import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type Network = "testnet" | "mainnet";

type DeployBody = {
  network?: Network;
  contractCode?: string;
};

function getExplorerBase(network: Network): string {
  return network === "testnet"
    ? "https://testnet.explorer.perawallet.app"
    : "https://explorer.perawallet.app";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DeployBody;

  if (!body.contractCode || body.contractCode.trim().length < 12) {
    return NextResponse.json(
      { error: "Please provide valid contract code before deploying." },
      { status: 400 },
    );
  }

  const network: Network = body.network === "mainnet" ? "mainnet" : "testnet";
  const deploymentId = randomUUID();
  const pseudoTx = createHash("sha256")
    .update(`${network}:${body.contractCode}`)
    .digest("hex")
    .slice(0, 52);

  return NextResponse.json({
    deploymentId,
    network,
    status: "queued",
    message:
      "Deployment payload accepted. Connect wallet signing + on-chain submission for production use.",
    explorer: `${getExplorerBase(network)}/tx/${pseudoTx}`,
  });
}
