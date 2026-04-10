import {
  Algodv2,
  generateAccount,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  assignGroupID,
  decodeUnsignedTransaction,
  encodeUnsignedTransaction,
  decodeSignedTransaction,
  Transaction,
  SuggestedParams,
} from "algosdk";

export const ALGOSDK = {
  Algodv2,
  generateAccount,
  decodeUnsignedTransaction,
  encodeUnsignedTransaction,
  decodeSignedTransaction,
  assignGroupID,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  Transaction,
};

export function getAlgodClient(network: "testnet" | "mainnet"): Algodv2 {
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
    flatFee: params.flatFee,
    fee: params.fee,
    minFee: params.minFee,
    firstValid: params.firstValid,
    lastValid: params.lastValid,
    genesisID: params.genesisID,
    genesisHash: params.genesisHash,
  };
}

export function decodeBase64Transaction(base64Txn: string): Transaction {
  const decoded =
    typeof atob === "function"
      ? Uint8Array.from(atob(base64Txn), (c) => c.charCodeAt(0))
      : Uint8Array.from(Buffer.from(base64Txn, "base64"));
  return decodeUnsignedTransaction(decoded);
}

export function encodeTransactionToBase64(txn: Transaction): string {
  const bytes = encodeUnsignedTransaction(txn);
  if (typeof btoa === "function") {
    return btoa(String.fromCharCode(...bytes));
  }
  return Buffer.from(bytes).toString("base64");
}

export { Transaction, encodeUnsignedTransaction, decodeSignedTransaction };
export type { SuggestedParams };
