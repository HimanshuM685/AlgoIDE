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
    peraWallet
      .reconnectSession()
      .then((accounts) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          onAddressChange(accounts[0]);
        }
      })
      .catch(() => {});

    onWalletDisconnect(() => {
      setAddress(null);
      onAddressChange(null);
    });
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
        <div className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          {formatAddress(address)}
        </div>
        <button
          type="button"
          onClick={handleDisconnect}
          className="rounded-lg border border-white/20 bg-white/8 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/15"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isConnecting}
      className="rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-5 py-2 text-sm font-medium text-cyan-100 backdrop-blur transition hover:border-cyan-300/60 hover:from-cyan-500/30 hover:to-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
