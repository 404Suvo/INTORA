"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, LogOut, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/contract-config";
import { connectMetaMaskOnTestnet, promptSwitchToBaseSepolia } from "@/lib/web3-wallet";

interface WalletStatusProps {
  account: string | null;
  chainId: number | null;
  onConnect: (account: string, chainId: number) => void;
  onDisconnect: () => void;
}

export function WalletStatus({
  account,
  chainId,
  onConnect,
  onDisconnect,
}: WalletStatusProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        onDisconnect();
      } else {
        const currentChain = window.ethereum.chainId
          ? parseInt(window.ethereum.chainId, 16)
          : null;
        onConnect(accounts[0], currentChain || 0);
      }
    };

    const handleChainChanged = (chainHex: string) => {
      const newChainId = parseInt(chainHex, 16);
      if (account) {
        onConnect(account, newChainId);
      }
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    // Initial check if already connected
    window.ethereum
      .request?.({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          const currentChain = window.ethereum.chainId
            ? parseInt(window.ethereum.chainId, 16)
            : null;
          onConnect(accounts[0], currentChain || 0);
        }
      })
      .catch(() => {});

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [account, onConnect, onDisconnect]);

  async function connectMetaMask() {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to record on-chain commitments.");
      return;
    }

    setConnecting(true);
    try {
      const { account: connectedAcc, chainId: connectedChain } = await connectMetaMaskOnTestnet();
      onConnect(connectedAcc, connectedChain);
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Connection request was rejected in MetaMask.");
      } else {
        setError(err.message || "Failed to connect wallet.");
      }
    } finally {
      setConnecting(false);
    }
  }

  async function switchToBaseSepolia() {
    setError(null);
    if (!window.ethereum) return;
    try {
      await promptSwitchToBaseSepolia();
      if (account) {
        onConnect(account, BASE_SEPOLIA_CHAIN_ID);
      }
    } catch (switchError: any) {
      setError(switchError.message || "Failed to switch to Base Sepolia Testnet.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" />
          <span className="font-semibold text-sm tracking-wide uppercase">User MetaMask Wallet</span>
        </div>

        {account ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              title="Disconnect"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={connectMetaMask}
            disabled={connecting}
            className="font-mono text-xs uppercase"
          >
            {connecting ? "Connecting..." : "Connect MetaMask"}
          </Button>
        )}
      </div>

      {account && (
        <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Network:</span>
            {isBaseSepolia ? (
              <Badge variant="outline" className="border-emerald-600/50 text-emerald-400 bg-emerald-950/20">
                <CheckCircle2 className="size-3 mr-1" /> Base Sepolia (84532)
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
                <AlertCircle className="size-3 mr-1" /> Wrong Network (ID: {chainId})
              </Badge>
            )}
          </div>

          {!isBaseSepolia && (
            <div className="mt-1 flex items-center justify-between rounded bg-amber-950/30 p-2 border border-amber-800/40 text-xs text-amber-300">
              <span>Switch to Base Sepolia to record intent commitments.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={switchToBaseSepolia}
                className="h-6 px-2 text-xs border-amber-600/50 hover:bg-amber-900/30"
              >
                Switch Network
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
          <AlertCircle className="size-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
