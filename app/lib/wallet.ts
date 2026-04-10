import { PeraWalletConnect } from "@perawallet/connect";
import type { WalletState } from "@/app/types/wallet";

export const peraWallet = new PeraWalletConnect({
  bridge: "https://bridge.walletconnect.org",
});

export async function connectWallet(): Promise<string | null> {
  try {
    const accounts = await peraWallet.connect();
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    await peraWallet.disconnect();
  } catch (error) {
    console.error("Failed to disconnect wallet:", error);
  }
}

export function onWalletDisconnect(callback: () => void) {
  peraWallet.connector?.on("disconnect", callback);
}

export function getWalletState(address: string | null): WalletState {
  return {
    address,
    isConnected: !!address,
    isConnecting: false,
  };
}

export function formatAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
