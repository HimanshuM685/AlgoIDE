import { createHash, randomUUID } from "node:crypto";
import {
  Algodv2,
  encodeUnsignedTransaction,
  getApplicationAddress,
  isValidAddress,
  makeApplicationCreateTxnFromObject,
  OnApplicationComplete,
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

const FALLBACK_APPROVAL_PROGRAM = `#pragma version 10
txn ApplicationID
int 0
==
bnz init
int 1
return
init:
int 1
return`;

const FALLBACK_CLEAR_PROGRAM = `#pragma version 10
int 1`;

function isLikelyTeal(source: string): boolean {
  return source.trimStart().startsWith("#pragma version");
}

async function compileTeal(algod: Algodv2, source: string): Promise<Uint8Array> {
  const compiled = await algod.compile(source).do();
  return Uint8Array.from(Buffer.from(compiled.result, "base64"));
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

    let usedFallbackProgram = false;
    let approvalProgramSource = body.contractCode;

    if (!isLikelyTeal(body.contractCode)) {
      usedFallbackProgram = true;
      approvalProgramSource = FALLBACK_APPROVAL_PROGRAM;
    }

    let approvalProgram: Uint8Array;
    try {
      approvalProgram = await compileTeal(algod, approvalProgramSource);
    } catch {
      usedFallbackProgram = true;
      approvalProgram = await compileTeal(algod, FALLBACK_APPROVAL_PROGRAM);
    }

    const clearProgram = await compileTeal(algod, FALLBACK_CLEAR_PROGRAM);

    const unsignedAppCreate = makeApplicationCreateTxnFromObject({
      sender: body.sender,
      approvalProgram,
      clearProgram,
      numLocalInts: 0,
      numLocalByteSlices: 0,
      numGlobalInts: 0,
      numGlobalByteSlices: 0,
      onComplete: OnApplicationComplete.NoOpOC,
      note,
      suggestedParams: params,
    });

    const unsignedTxn = Buffer.from(encodeUnsignedTransaction(unsignedAppCreate)).toString("base64");

    return NextResponse.json({
      deploymentId,
      network,
      status: "sign",
      message: usedFallbackProgram
        ? "Sign transaction to create app. Current source is not raw TEAL, fallback approval logic will be used."
        : "Sign transaction in Pera Wallet to continue deployment.",
      unsignedTxn,
      explorer: "",
    });
  }

  const signedBytes = Uint8Array.from(Buffer.from(body.signedTxn, "base64"));
  const submission = await algod.sendRawTransaction(signedBytes).do();
  const pendingResult = await waitForConfirmation(algod, submission.txid, 6);
  const appId = pendingResult.applicationIndex
    ? Number(pendingResult.applicationIndex)
    : undefined;
  const contractAddress = appId ? getApplicationAddress(appId).toString() : undefined;

  return NextResponse.json({
    deploymentId,
    network,
    status: "success",
    message: appId
      ? "Application created successfully on-chain."
      : "Transaction confirmed on-chain.",
    txId: submission.txid,
    appId,
    contractAddress,
    explorer: `${getExplorerBase(network)}/tx/${submission.txid}`,
  });
}
