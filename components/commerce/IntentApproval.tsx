"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Hash,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/catalog";
import { BASE_SEPOLIA_CHAIN_ID, EVIDENCE_SINK_ADDRESS } from "@/lib/contract-config";
import { connectMetaMaskOnTestnet, promptSwitchToBaseSepolia } from "@/lib/web3-wallet";
import { computePlanHash } from "@/lib/plan-hash";
import { ShoppingPlan } from "@/lib/types";

interface IntentApprovalProps {
  plan: ShoppingPlan;
  reviewedPlanHash: `0x${string}`;
  account: string | null;
  chainId: number | null;
  onCommitmentSuccess: (result: {
    txHash: `0x${string}`;
    blockNumber: number;
    version: number;
    intentId: `0x${string}`;
  }) => void;
}

type TxState = "idle" | "awaiting_approval" | "pending" | "confirmed" | "rejected" | "failed";

export function IntentApproval({
  plan,
  reviewedPlanHash,
  account,
  chainId,
  onCommitmentSuccess,
}: IntentApprovalProps) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [isApprovedByUser, setIsApprovedByUser] = useState(false);

  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const isExpired = plan.expiry <= Math.floor(Date.now() / 1000);

  async function handleRecordCommitment() {
    setErrorMessage(null);

    // 1. Recompute the hash right now in code (Hard Rule)
    const { planHash: recomputedHash } = computePlanHash(plan);

    // Block submission if plan was altered
    if (recomputedHash.toLowerCase() !== reviewedPlanHash.toLowerCase()) {
      setErrorMessage("CRITICAL INTEGRITY ERROR: The plan was modified after review. On-chain submission blocked.");
      setTxState("failed");
      return;
    }

    let activeAccount = account;
    let activeChainId = chainId;

    if (!activeAccount) {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          setTxState("awaiting_approval");
          const res = await connectMetaMaskOnTestnet();
          activeAccount = res.account;
          activeChainId = res.chainId;
        } catch (connErr: any) {
          setTxState("idle");
          if (connErr.code === 4001) {
            setErrorMessage("Connection request was canceled in MetaMask.");
          } else {
            setErrorMessage(connErr.message || "Failed to connect MetaMask.");
          }
          return;
        }
      } else {
        setErrorMessage("MetaMask is not detected. Please install MetaMask to record on-chain commitments.");
        return;
      }
    }

    if (activeChainId !== BASE_SEPOLIA_CHAIN_ID) {
      try {
        setTxState("awaiting_approval");
        await promptSwitchToBaseSepolia();
        activeChainId = BASE_SEPOLIA_CHAIN_ID;
      } catch (switchErr: any) {
        setTxState("idle");
        if (switchErr.code === 4001) {
          setErrorMessage("Network switch was canceled in MetaMask. Please switch to Base Sepolia Testnet.");
        } else {
          setErrorMessage(switchErr.message || "Failed to switch to Base Sepolia Testnet.");
        }
        return;
      }
    }

    if (isExpired) {
      setErrorMessage("This plan version has reached its expiry timestamp. Please generate a fresh plan.");
      return;
    }

    setTxState("awaiting_approval");

    try {
      // 2. Fetch prepared calldata from server (API route)
      const prepRes = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          intentId: plan.intentId,
          version: plan.version,
          sender: activeAccount,
        }),
      });

      const prepData = await prepRes.json();
      if (!prepRes.ok || prepData.error) {
        throw new Error(prepData.error || "Failed to prepare contract call");
      }

      // 3. User approves in MetaMask (Hard Rule 2: Agent never signs or submits)
      let targetAddress = prepData.to;
      if (activeAccount && targetAddress.toLowerCase() === activeAccount.toLowerCase()) {
        targetAddress = EVIDENCE_SINK_ADDRESS;
      }

      const transactionParameters = {
        to: targetAddress,
        from: activeAccount,
        data: prepData.calldata,
        chainId: "0x14a34", // 84532
      };

      let hash: `0x${string}`;
      try {
        hash = (await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [transactionParameters],
        })) as `0x${string}`;
      } catch (txErr: any) {
        const msg = (txErr.message || "").toLowerCase();
        // Handle MetaMask restriction: "External transactions to internal accounts cannot include data"
        if (
          msg.includes("internal account") ||
          msg.includes("cannot include data") ||
          msg.includes("to internal accounts")
        ) {
          hash = (await window.ethereum.request({
            method: "eth_sendTransaction",
            params: [{ ...transactionParameters, to: EVIDENCE_SINK_ADDRESS }],
          })) as `0x${string}`;
        } else {
          throw txErr;
        }
      }

      setTxHash(hash);
      setTxState("pending");

      // 4. Wait for receipt and verify via server
      const verifyRes = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          intentId: plan.intentId,
          version: plan.version,
          txHash: hash,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || verifyData.error) {
        throw new Error(verifyData.error || "Failed to verify transaction receipt");
      }

      setTxState("confirmed");
      onCommitmentSuccess({
        txHash: hash,
        blockNumber: verifyData.blockNumber,
        version: plan.version,
        intentId: plan.intentId as `0x${string}`,
      });
    } catch (err: any) {
      console.error("Commitment transaction failed:", err);
      // Clean handling for MetaMask rejection (code 4001)
      if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("User denied")) {
        setTxState("rejected");
        setErrorMessage("Transaction request was rejected in MetaMask (Code 4001).");
      } else {
        setTxState("failed");
        setErrorMessage(err.message || "Transaction failed.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-5 text-primary" />
          <h3 className="font-bold text-base tracking-tight uppercase">
            Plan Review & On-Chain Commitment
          </h3>
        </div>
        <Badge variant="outline" className="font-mono text-xs border-primary/50 text-primary">
          Version {plan.version}
        </Badge>
      </div>

      {/* Plan Details Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg bg-background p-3.5 border border-border/50 text-xs font-mono">
        <div>
          <span className="text-muted-foreground block text-[11px]">Intent ID (bytes32):</span>
          <span className="text-foreground break-all">{plan.intentId}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Keccak256 Plan Hash:</span>
          <span className="text-primary break-all font-bold">{reviewedPlanHash}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Total Commitment:</span>
          <span className="text-foreground font-bold text-sm">
            {formatInr(plan.totalMinor)} ({plan.totalMinor} paise)
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Expiry:</span>
          <span className="text-foreground">
            {new Date(plan.expiry * 1000).toLocaleString()} {isExpired && "(Expired)"}
          </span>
        </div>
      </div>

      {/* Mandatory Disclaimer (Non-Negotiable Rule 7) */}
      <div className="flex items-start gap-2 rounded-md bg-amber-950/20 border border-amber-500/30 p-3 text-xs text-amber-300">
        <ShieldAlert className="size-4 shrink-0 text-amber-400 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-amber-200">Legal & Operational Disclaimer</span>
          <p className="text-amber-100 font-medium">
            This records a commitment to your approved plan. It does not place an order.
          </p>
          <p className="text-amber-200/70 text-[11px]">
            No purchases, payments, or escrow. This cryptographic commitment does not prove product authenticity, inventory, seller reliability, payment, or delivery.
          </p>
        </div>
      </div>

      {/* User Review Checkbox */}
      {!isApprovedByUser && (
        <div className="flex items-center gap-3 p-2 bg-muted/40 rounded border border-border/40">
          <input
            type="checkbox"
            id="review-consent"
            checked={isApprovedByUser}
            onChange={(e) => setIsApprovedByUser(e.target.checked)}
            className="size-4 accent-primary cursor-pointer"
          />
          <label htmlFor="review-consent" className="text-xs text-foreground cursor-pointer select-none">
            I have reviewed the items, quantities, and prices. Lock this plan as immutable and prepare MetaMask transaction.
          </label>
        </div>
      )}

      {/* Action and status */}
      <div className="flex flex-col gap-3 pt-2">
        {txState === "idle" && (
          <Button
            onClick={handleRecordCommitment}
            disabled={!isApprovedByUser || !account || !isBaseSepolia || isExpired}
            className="w-full h-11 font-mono text-xs uppercase tracking-wider gap-2"
          >
            <Lock className="size-4" />
            Record Version {plan.version} Commitment in MetaMask
          </Button>
        )}

        {txState === "awaiting_approval" && (
          <Button disabled className="w-full h-11 font-mono text-xs uppercase bg-amber-600/80 gap-2">
            <Loader2 className="size-4 animate-spin" />
            Please confirm transaction in MetaMask...
          </Button>
        )}

        {txState === "pending" && (
          <Button disabled className="w-full h-11 font-mono text-xs uppercase bg-blue-600/80 gap-2">
            <Loader2 className="size-4 animate-spin" />
            Waiting for Base Sepolia Block Confirmation...
          </Button>
        )}

        {txState === "confirmed" && (
          <div className="flex flex-col gap-2 rounded-lg bg-emerald-950/20 border border-emerald-500/40 p-3.5 text-xs text-emerald-300">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span>Commitment Successfully Recorded on Base Sepolia!</span>
            </div>
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-emerald-400 underline underline-offset-4 hover:text-emerald-200 mt-1"
              >
                View on Basescan <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}

        {txState === "rejected" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 p-2.5 rounded border border-amber-600/30">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTxState("idle")}
              className="text-xs font-mono uppercase"
            >
              Retry MetaMask Approval
            </Button>
          </div>
        )}

        {txState === "failed" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/30">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTxState("idle")}
              className="text-xs font-mono uppercase"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
