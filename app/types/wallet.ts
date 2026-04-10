export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
}

export interface DeployPayload {
  network: "testnet" | "mainnet";
  contractCode: string;
  sender: string;
}

export interface DeployResult {
  deploymentId: string;
  appId?: number;
  contractAddress?: string;
  network: "testnet" | "mainnet";
  explorer: string;
  status: "success" | "error" | "sign";
  message: string;
  txId?: string;
  unsignedTxn?: string;
}

export interface SignPayload {
  network: "testnet" | "mainnet";
  contractCode: string;
  sender: string;
  signedTxn: string;
  deploymentId: string;
}
