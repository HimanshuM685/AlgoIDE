"use client";

import { useEffect, useState, useCallback } from "react";
import { peraWallet, connectWallet, disconnectWallet, onWalletDisconnect, formatAddress } from "@/app/lib/wallet";

interface WalletButtonProps {
  onAddressChange: (address: string | null) => void;
}

export function WalletButton({ onAddressChange }: WalletButtonProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    peraWallet
      .reconnectSession()
      .then((accounts) => {
        if (isMounted && accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          onAddressChange(accounts[0]);
        }
      })
      .catch((err) => {
        // Ignore PeraWalletConnectError caused by strict mode double-renders
        if (err?.name !== "PeraWalletConnectError") {
          console.warn("Failed to reconnect session:", err);
        }
      });

    const handleDisconnect = () => {
      if (isMounted) {
        setAddress(null);
        onAddressChange(null);
      }
    };
    
    onWalletDisconnect(handleDisconnect);

    return () => {
      isMounted = false;
      if (peraWallet.connector) {
         peraWallet.connector.off("disconnect", handleDisconnect);
      }
    };
  }, [onAddressChange]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const account = await connectWallet();
      if (account) {
        setAddress(account);
        onAddressChange(account);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [onAddressChange]);

  const handleDisconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    onAddressChange(null);
  }, [onAddressChange]);

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <div className="brutal-border bg-[#e5e5e5] px-3 py-1 text-xs font-bold text-black border-2 border-black flex items-center shadow-[2px_2px_0px_#000]">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#16CAC6] border border-black animate-pulse" />
          {formatAddress(address)}
        </div>
        <button
          type="button"
          onClick={handleDisconnect}
          className="bg-white border-2 border-black px-2 py-1 text-xs font-bold shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] transition-all"
        >
          X
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isConnecting}
      className="brutal-button text-xs py-1 px-3"
    >
      {isConnecting ? "Connecting..." : "Connect"}
    </button>
  );
}
