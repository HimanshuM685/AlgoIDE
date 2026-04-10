import { createHash, randomUUID } from "node:crypto";
import {
  Algodv2,
  encodeUnsignedTransaction,
  isValidAddress,
  makePaymentTxnWithSuggestedParamsFromObject,
  waitForConfirmation,
} from "algosdk";
import { NextRequest, NextResponse } from "next/server";

type Network = "testnet" | "mainnet";

type DeployBody = {
  network?: Network;
  contractCode?: string;
  sender?: string;
  signedTxn?: string;
  deploymentId?: string;
};

function getExplorerBase(network: Network): string {
  return network === "testnet"
    ? "https://testnet.explorer.perawallet.app"
    : "https://explorer.perawallet.app";
}

function getAlgodClient(network: Network): Algodv2 {
  const baseServer =
    network === "testnet"
      ? "https://testnet-api.algonode.cloud"
      : "https://mainnet-api.algonode.cloud";

  return new Algodv2("", baseServer, 443);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DeployBody;

  if (!body.contractCode || body.contractCode.trim().length < 12) {
    return NextResponse.json(
      { error: "Please provide valid contract code before deploying." },
      { status: 400 },
    );
  }

  if (!body.sender || !isValidAddress(body.sender)) {
    return NextResponse.json(
      { error: "Please connect a valid Algorand wallet address." },
      { status: 400 },
    );
  }

  const network: Network = body.network === "mainnet" ? "mainnet" : "testnet";
  const algod = getAlgodClient(network);
  const deploymentId = body.deploymentId || randomUUID();

  if (!body.signedTxn) {
    const params = await algod.getTransactionParams().do();
    const contractHash = createHash("sha256")
      .update(body.contractCode)
      .digest("hex")
      .slice(0, 24);
    const note = new TextEncoder().encode(`AlgoIDE deploy:${deploymentId}:${contractHash}`);

    const unsignedPayment = makePaymentTxnWithSuggestedParamsFromObject({
      sender: body.sender,
      receiver: body.sender,
      amount: 0,
      note,
      suggestedParams: params,
    });

    const unsignedTxn = Buffer.from(encodeUnsignedTransaction(unsignedPayment)).toString("base64");

    return NextResponse.json({
      deploymentId,
      network,
      status: "sign",
      message: "Sign transaction in Pera Wallet to continue deployment.",
      unsignedTxn,
      explorer: "",
    });
  }

  const signedBytes = Uint8Array.from(Buffer.from(body.signedTxn, "base64"));
  const submission = await algod.sendRawTransaction(signedBytes).do();
  await waitForConfirmation(algod, submission.txid, 4);

  return NextResponse.json({
    deploymentId,
    network,
    status: "success",
    message: "Transaction confirmed on-chain.",
    txId: submission.txid,
    explorer: `${getExplorerBase(network)}/tx/${submission.txid}`,
  });
}
