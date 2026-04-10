import { PeraWalletConnect } from "@perawallet/connect";
import type { WalletState } from "@/app/types/wallet";

class PeraWalletSingleton {
  private static instance: PeraWalletConnect | null = null;
  
  static getInstance(): PeraWalletConnect {
    if (typeof window === "undefined") {
      // Return a dummy object for server-side rendering
      return {
        connect: async () => [],
        reconnectSession: async () => [],
        disconnect: async () => {},
        connector: null,
      } as unknown as PeraWalletConnect;
    }
    
    if (!PeraWalletSingleton.instance) {
      PeraWalletSingleton.instance = new PeraWalletConnect({
        shouldShowSignTxnToast: false,
      });
    }
    return PeraWalletSingleton.instance;
  }
}

export const peraWallet = PeraWalletSingleton.getInstance();

export async function connectWallet(): Promise<string | null> {
  try {
    const accounts = await peraWallet.connect();
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch (error: unknown) {
    if (error && typeof error === "object" && (error as { name?: string }).name === "PeraWalletConnectError") {
      console.warn("User closed Pera Wallet modal or connect error:", (error as Error).message || "Unknown error");
    } else {
      console.error("Failed to connect wallet:", error);
    }
    // Clean up potentially hung session
    peraWallet.disconnect().catch(() => {});
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
  if (peraWallet.connector) {
    peraWallet.connector.on("disconnect", callback);
  }
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
