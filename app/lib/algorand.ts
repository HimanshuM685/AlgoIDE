import {
  Algodv2,
  mnemonicToPrivateKey,
  generateAccount,
  makeBasicAccountTransactions,
  makeAssetTransferTxnWithSuggestedParams,
  assignGroupID,
  encodeUnsignedTransaction,
  decodeSignedTransaction,
  Transaction,
  SuggestedParams,
  V2Client,
} from "algosdk";

export const ALGOSDK = {
  Algodv2,
  generateAccount,
  encodeUnsignedTransaction,
  decodeSignedTransaction,
  assignGroupID,
  makeAssetTransferTxnWithSuggestedParams,
  Transaction,
  assignGroupID,
};

export function getAlgodClient(network: "testnet" | "mainnet"): V2Client {
  const baseServer =
    network === "testnet"
      ? "https://testnet-api.algonode.cloud"
      : "https://mainnet-api.algonode.cloud";
  const port = 443;

  return new Algodv2("", baseServer, port);
}

export async function getSuggestedParams(
  network: "testnet" | "mainnet",
): Promise<SuggestedParams> {
  const client = getAlgodClient(network);
  const params = await client.getTransactionParams().do();
  return {
    flatFee: false,
    fee: 1000,
    firstRound: params.firstRound,
    lastRound: params.lastRound,
    genID: params.genesisID,
    genesisHash: params.genesishashb64,
  };
}

export function decodeBase64Transaction(base64Txn: string): Transaction {
  const decoded = Uint8Array.from(atob(base64Txn), (c) => c.charCodeAt(0));
  return Transaction.from_bytes(decoded);
}

export function encodeTransactionToBase64(txn: Transaction): string {
  const bytes = txn.to_bytes();
  return btoa(String.fromCharCode(...bytes));
}

export { Transaction, SuggestedParams, encodeUnsignedTransaction, decodeSignedTransaction };
