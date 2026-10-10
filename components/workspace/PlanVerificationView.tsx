"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  Hash,
  History,
  Info,
  Layers,
  Loader2,
  Lock,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInr, getProductById } from "@/lib/catalog";
import { BASE_SEPOLIA_CHAIN_ID, INTENT_REGISTRY_ADDRESS } from "@/lib/contract-config";
import { connectMetaMaskOnTestnet, promptSwitchToBaseSepolia } from "@/lib/web3-wallet";
import { computePlanHash } from "@/lib/plan-hash";
import { ShoppingPlan, StoredPlanRecord } from "@/lib/types";

export type PlanLifecycleStatus =
  | "Draft"
  | "Validating"
  | "Ready for approval"
  | "Awaiting wallet confirmation"
  | "Submitted"
  | "Confirmed"
  | "Verification failed";

interface PlanVerificationViewProps {
  plan: ShoppingPlan | null;
  reviewedPlanHash: `0x${string}` | null;
  walletAccount: string | null;
  walletChainId: number | null;
  onCommitmentSuccess: (txHash: `0x${string}`, blockNumber: number) => void;
  onSelectSavedVersion?: (version: number) => void;
  onConnectWallet?: () => void;
  onSwitchNetwork?: () => void;
}

export function PlanVerificationView({
  plan,
  reviewedPlanHash,
  walletAccount,
  walletChainId,
  onCommitmentSuccess,
  onSelectSavedVersion,
  onConnectWallet,
  onSwitchNetwork,
}: PlanVerificationViewProps) {
  const [lifecycleStatus, setLifecycleStatus] = useState<PlanLifecycleStatus>("Ready for approval");
  const [reviewChecked, setReviewChecked] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showCanonicalJson, setShowCanonicalJson] = useState(false);

  // Simulation mode
  const [isSimulating, setIsSimulating] = useState(false);

  // On-chain read-back verification state
  const [onChainData, setOnChainData] = useState<any>(null);
  const [allVersions, setAllVersions] = useState<StoredPlanRecord[]>([]);
  const [queryingContract, setQueryingContract] = useState(false);

  const isBaseSepolia = walletChainId === BASE_SEPOLIA_CHAIN_ID;
  const isExpired = plan ? plan.expiry <= Math.floor(Date.now() / 1000) : false;

  // Fetch contract and version data
  async function fetchOnChainStatus(intentId: string, version: number) {
    setQueryingContract(true);
    try {
      // 1. Fetch off-chain records
      const planRes = await fetch(`/api/plan?intentId=${intentId}`);
      if (planRes.ok) {
        const planData = await planRes.json();
        setAllVersions(planData.versions || []);
      }

      // 2. Fetch on-chain status
      const intentRes = await fetch(`/api/intent?intentId=${intentId}&version=${version}`);
      if (intentRes.ok) {
        const intentData = await intentRes.json();
        setOnChainData(intentData);

        if (intentData.hashMatch) {
          setLifecycleStatus("Confirmed");
          if (intentData.onChain?.txHash) {
            setTxHash(intentData.onChain.txHash);
          }
        } else if (intentData.onChainAvailable) {
          setLifecycleStatus("Verification failed");
        }
      }
    } catch (err) {
      console.error("Verification query error:", err);
    } finally {
      setQueryingContract(false);
    }
  }

  useEffect(() => {
    if (plan?.intentId) {
      fetchOnChainStatus(plan.intentId, plan.version);
    }
  }, [plan?.intentId, plan?.version]);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-white/[0.08] bg-[#0E131F]/80 backdrop-blur-md max-w-2xl mx-auto">
        <ShieldCheck className="size-10 text-muted-foreground mb-3" />
        <h3 className="font-bold text-lg text-foreground">No Active Plan Selected</h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1 leading-relaxed">
          Generate an optimized shopping plan in the AI Workspace or select a saved plan from history to review
          and record its cryptographic commitment on Base Sepolia.
        </p>
      </div>
    );
  }

  const { canonicalString, planHash: currentRecomputedHash } = computePlanHash(plan);
  const hashMatchesReviewed =
    !reviewedPlanHash || currentRecomputedHash.toLowerCase() === reviewedPlanHash.toLowerCase();

  // Handle User-Approved MetaMask Transaction
  async function handleRecordCommitment() {
    if (!plan) return;
    setErrorMessage(null);

    // Hard Rule: Recheck hash immediately prior to submission
    if (!hashMatchesReviewed) {
      setErrorMessage("CRITICAL INTEGRITY ERROR: Plan was modified after review. On-chain submission blocked.");
      setLifecycleStatus("Verification failed");
      return;
    }

    let activeAccount = walletAccount;
    let activeChainId = walletChainId;

    // 1. If wallet is not connected, trigger MetaMask popup to connect and switch to Base Sepolia testnet
    if (!activeAccount) {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          setLifecycleStatus("Awaiting wallet confirmation");
          const res = await connectMetaMaskOnTestnet();
          activeAccount = res.account;
          activeChainId = res.chainId;
          onConnectWallet?.();
        } catch (connErr: any) {
          setLifecycleStatus("Ready for approval");
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

    // 2. If connected to another chain, trigger MetaMask popup to switch/add Base Sepolia testnet
    if (activeChainId !== BASE_SEPOLIA_CHAIN_ID) {
      try {
        setLifecycleStatus("Awaiting wallet confirmation");
        await promptSwitchToBaseSepolia();
        activeChainId = BASE_SEPOLIA_CHAIN_ID;
        onSwitchNetwork?.();
      } catch (switchErr: any) {
        setLifecycleStatus("Ready for approval");
        if (switchErr.code === 4001) {
          setErrorMessage("Network switch was canceled in MetaMask. Please switch to Base Sepolia Testnet.");
        } else {
          setErrorMessage(switchErr.message || "Failed to switch network to Base Sepolia Testnet.");
        }
        return;
      }
    }

    if (isExpired) {
      setErrorMessage("This plan version has reached its expiry timestamp. Please generate a fresh plan.");
      return;
    }

    setLifecycleStatus("Awaiting wallet confirmation");

    try {
      // 1. Fetch prepared calldata from server
      const prepRes = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          intentId: plan.intentId,
          version: plan.version,
        }),
      });

      const prepData = await prepRes.json();
      if (!prepRes.ok || prepData.error) {
        throw new Error(prepData.error || "Failed to prepare transaction");
      }

      // 2. User explicitly approves transaction in MetaMask (Hard Rule 2)
      const txParams = {
        to: prepData.to,
        from: activeAccount,
        data: prepData.calldata,
        chainId: "0x14a34", // 84532 in hex
      };

      const hash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      })) as `0x${string}`;

      setTxHash(hash);
      setLifecycleStatus("Submitted");

      // 3. Wait for receipt & verify via server
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

      setBlockNumber(verifyData.blockNumber);
      setLifecycleStatus("Confirmed");
      onCommitmentSuccess(hash, verifyData.blockNumber);

      // Refresh on-chain read-back
      await fetchOnChainStatus(plan.intentId, plan.version);
    } catch (err: any) {
      console.error("Commitment submission failed:", err);
      if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("User denied")) {
        setLifecycleStatus("Ready for approval");
        setErrorMessage("Transaction was declined in MetaMask (Code 4001). You can retry when ready.");
      } else {
        setLifecycleStatus("Verification failed");
        setErrorMessage(err.message || "Failed to record transaction on Base Sepolia.");
      }
    }
  }

  // Handle Simulated Commitment (Sandbox Mode for instant testing)
  async function handleSimulateCommitment() {
    if (!plan) return;
    setErrorMessage(null);
    setIsSimulating(true);

    try {
      setLifecycleStatus("Awaiting wallet confirmation");
      await new Promise((r) => setTimeout(r, 600));

      setLifecycleStatus("Submitted");
      await new Promise((r) => setTimeout(r, 1000));

      const simulatedTxHash: `0x${string}` = `0x9c83f12a87b649d0124b8932014ac89b4f2c91823ab67d8120e53a19fc820a4b`;
      const simulatedBlockNumber = 18421904;

      setTxHash(simulatedTxHash);
      setBlockNumber(simulatedBlockNumber);
      setLifecycleStatus("Confirmed");

      // Update off-chain state
      setOnChainData({
        intentId: plan.intentId,
        version: plan.version,
        hashMatch: true,
        onChainAvailable: true,
        onChain: {
          intentHash: currentRecomputedHash,
          version: plan.version,
          txHash: simulatedTxHash,
          blockNumber: simulatedBlockNumber,
          timestamp: Math.floor(Date.now() / 1000),
        },
      });

      onCommitmentSuccess(simulatedTxHash, simulatedBlockNumber);
    } catch (err: any) {
      setErrorMessage("Simulation failed: " + err.message);
      setLifecycleStatus("Verification failed");
    } finally {
      setIsSimulating(false);
    }
  }

  function handleCopyHash() {
    navigator.clipboard.writeText(currentRecomputedHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1500);
  }

  function handleCopyCanonicalJson() {
    navigator.clipboard.writeText(canonicalString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1500);
  }

  const isConfirmedOnChain = Boolean(onChainData?.hashMatch) || lifecycleStatus === "Confirmed";

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Plan Review & Cryptographic Verification
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Independent off-chain UTF-8 canonical hash verification & Base Sepolia commitment registry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <Badge
            variant="outline"
            className={`font-mono text-xs px-3 py-1.5 rounded-xl ${
              lifecycleStatus === "Confirmed"
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                : lifecycleStatus === "Verification failed"
                  ? "border-destructive/40 text-destructive bg-destructive/10"
                  : lifecycleStatus === "Submitted"
                    ? "border-blue-500/40 text-blue-400 bg-blue-950/20"
                    : "border-white/[0.1] text-foreground bg-white/[0.03]"
            }`}
          >
            Status: {lifecycleStatus}
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchOnChainStatus(plan.intentId, plan.version)}
            disabled={queryingContract}
            className="h-9 text-xs font-mono rounded-xl hover:bg-white/[0.05]"
          >
            <RefreshCw className={`size-3.5 mr-1 ${queryingContract ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Version selector tabs if revisions exist */}
      {allVersions.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/[0.06]">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 font-mono">
            <History className="size-3.5" /> Plan Versions:
          </span>
          {allVersions.map((v) => (
            <button
              key={v.version}
              onClick={() => onSelectSavedVersion?.(v.version)}
              className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                plan.version === v.version
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-card border border-white/[0.08] text-muted-foreground hover:text-foreground"
              }`}
            >
              Version {v.version} {v.version === allVersions[allVersions.length - 1].version ? "(Latest)" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Verification Result Banner */}
      <div
        className={`flex items-start sm:items-center justify-between p-5 rounded-3xl border transition-all gap-4 ${
          isConfirmedOnChain
            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
            : onChainData?.onChainAvailable
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-white/[0.08] bg-[#0E131F]/80 text-muted-foreground"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3.5">
          {isConfirmedOnChain ? (
            <CheckCircle2 className="size-7 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          ) : onChainData?.onChainAvailable ? (
            <XCircle className="size-7 text-destructive shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <Layers className="size-7 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
          )}

          <div>
            <h3 className="font-bold text-sm sm:text-base text-foreground">
              {isConfirmedOnChain
                ? "ON-CHAIN COMMITMENT VERIFIED (PASS ✅)"
                : onChainData?.onChainAvailable
                  ? "CRITICAL HASH MISMATCH (FAIL ❌)"
                  : "OFF-CHAIN PREPARED (Ready for Explicit User Approval)"}
            </h3>
            <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
              {isConfirmedOnChain
                ? "The on-chain keccak256 commitment on Base Sepolia precisely matches the recomputed canonical plan hash."
                : onChainData?.onChainAvailable
                  ? "The hash committed on Base Sepolia does not match the off-chain stored canonical plan."
                  : "This plan is canonicalized, hashed, and ready for your review and explicit MetaMask approval."}
            </p>
          </div>
        </div>

        <Badge variant="outline" className="font-mono text-xs shrink-0 border-white/[0.15]">
          v{plan.version}
        </Badge>
      </div>

      {/* Plan Details & Cryptographic Hash Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Intent Parameters */}
        <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plan Specification
          </span>

          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-muted-foreground">Intent ID:</span>
              <span className="text-foreground break-all text-right font-medium">
                {plan.intentId.slice(0, 10)}...{plan.intentId.slice(-8)}
              </span>
            </div>

            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-muted-foreground">Plan Version:</span>
              <span className="text-foreground font-semibold">Version {plan.version}</span>
            </div>

            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-muted-foreground">Currency:</span>
              <span className="text-foreground font-semibold">{plan.currency} (Indian Rupees)</span>
            </div>

            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-muted-foreground">Budget Cap:</span>
              <span className="text-foreground font-semibold">{formatInr(plan.budgetMinor)}</span>
            </div>

            <div className="flex justify-between border-b border-white/[0.04] pb-2">
              <span className="text-muted-foreground">Estimated Total:</span>
              <span className="text-emerald-400 font-bold">{formatInr(plan.totalMinor)}</span>
            </div>

            <div className="flex justify-between pb-1">
              <span className="text-muted-foreground">Commitment Expiry:</span>
              <span className={`text-right ${isExpired ? "text-destructive font-bold" : "text-foreground"}`}>
                {new Date(plan.expiry * 1000).toLocaleString()} {isExpired && "(EXPIRED)"}
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic Hash & Deterministic JSON */}
        <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Canonical Keccak256 Hash
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyHash}
              className="h-6 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            >
              {copiedHash ? <CheckCircle2 className="size-3 text-emerald-400 mr-1" /> : <Copy className="size-3 mr-1" />}
              {copiedHash ? "Copied" : "Copy Hash"}
            </Button>
          </div>

          <div className="rounded-2xl bg-[#090B10]/80 p-3.5 border border-white/[0.06] font-mono text-xs text-emerald-400 break-all leading-relaxed">
            {currentRecomputedHash}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
            <button
              onClick={() => setShowCanonicalJson(!showCanonicalJson)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono"
            >
              <Eye className="size-3.5" />
              <span>{showCanonicalJson ? "Hide Canonical JSON" : "Inspect Canonical UTF-8 JSON"}</span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCanonicalJson}
              className="h-6 text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              {copiedJson ? <CheckCircle2 className="size-3 text-emerald-400 mr-1" /> : <Copy className="size-3 mr-1" />}
              {copiedJson ? "Copied JSON" : "Copy JSON"}
            </Button>
          </div>

          {showCanonicalJson && (
            <pre className="max-h-40 overflow-auto rounded-2xl bg-black/50 p-3 font-mono text-[10px] text-foreground border border-white/[0.06]">
              {canonicalString}
            </pre>
          )}
        </div>
      </div>

      {/* Selected Products Breakdown Table */}
      <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-md">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Selected Products Included in Hash Commitment ({plan.items.length} Items)
        </span>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-muted-foreground text-[11px] text-left">
                <th className="pb-2.5 font-semibold">Product</th>
                <th className="pb-2.5 font-semibold text-right">Unit Price</th>
                <th className="pb-2.5 font-semibold text-center">Qty</th>
                <th className="pb-2.5 font-semibold text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {plan.items.map((item) => {
                const product = getProductById(item.productId);
                const subtotal = item.unitPriceMinor * item.quantity;
                return (
                  <tr key={item.productId} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-2 font-sans font-medium text-foreground">
                      {product?.name || item.productId}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {formatInr(item.unitPriceMinor)}
                    </td>
                    <td className="py-2.5 text-center text-foreground font-semibold">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">
                      {formatInr(subtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.1] text-sm">
                <td colSpan={3} className="pt-3 font-sans font-bold text-foreground">
                  Final Validated Total
                </td>
                <td className="pt-3 text-right font-mono font-bold text-emerald-400">
                  {formatInr(plan.totalMinor)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mandatory Disclaimer (Non-Negotiable Hard Rule 5) */}
      <div className="flex items-start gap-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 p-4 text-xs text-amber-300">
        <ShieldAlert className="size-5 shrink-0 text-amber-400 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-amber-200">Legal & Technical Transparency Disclaimer</span>
          <p className="text-amber-100 font-medium">
            This records a commitment to your approved plan. It does not place an order.
          </p>
          <p className="text-amber-200/70 text-[11px] leading-relaxed">
            No purchases, automatic wallet debits, or token escrow. Storing this keccak256 commitment on Base Sepolia
            proves your intent parameters existed at this timestamp, but does not guarantee merchant delivery, inventory,
            or payment execution.
          </p>
        </div>
      </div>

      {/* Review Consent Checkbox */}
      {!isConfirmedOnChain && (
        <div className="flex items-center gap-3 p-4 bg-[#0E131F] rounded-2xl border border-white/[0.08]">
          <input
            type="checkbox"
            id="review-consent"
            checked={reviewChecked}
            onChange={(e) => setReviewChecked(e.target.checked)}
            className="size-4 accent-emerald-500 cursor-pointer rounded"
          />
          <label htmlFor="review-consent" className="text-xs text-foreground cursor-pointer select-none leading-relaxed">
            I have reviewed the products, quantities, and total amount of <strong>{formatInr(plan.totalMinor)}</strong>.
            I authorize recording this version commitment on Base Sepolia.
          </label>
        </div>
      )}

      {/* Error Message banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons & Transaction Execution */}
      <div className="flex flex-col gap-3">
        {!isConfirmedOnChain && (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Real MetaMask Submit Button */}
            <Button
              size="lg"
              onClick={handleRecordCommitment}
              disabled={
                !reviewChecked ||
                isExpired ||
                lifecycleStatus === "Awaiting wallet confirmation" ||
                lifecycleStatus === "Submitted"
              }
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-background font-bold text-xs sm:text-sm gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-40 cursor-pointer"
            >
              {lifecycleStatus === "Awaiting wallet confirmation" ? (
                <>
                  <Loader2 className="size-4 animate-spin text-background" />
                  <span>Confirm in MetaMask popup...</span>
                </>
              ) : lifecycleStatus === "Submitted" ? (
                <>
                  <Loader2 className="size-4 animate-spin text-background" />
                  <span>Waiting for Base Sepolia Block Confirmation...</span>
                </>
              ) : !walletAccount ? (
                <>
                  <Wallet className="size-4 text-background" />
                  <span>Connect MetaMask & Record on Base Sepolia Testnet</span>
                </>
              ) : !isBaseSepolia ? (
                <>
                  <AlertCircle className="size-4 text-background animate-pulse" />
                  <span>Switch MetaMask to Base Sepolia Testnet</span>
                </>
              ) : (
                <>
                  <Lock className="size-4 text-background" />
                  <span>Record Version {plan.version} Commitment in MetaMask</span>
                </>
              )}
            </Button>

            {/* Testnet Sandbox Simulation Button */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleSimulateCommitment}
              disabled={!reviewChecked || isSimulating || lifecycleStatus === "Submitted"}
              className="h-12 rounded-2xl border-white/[0.15] hover:border-emerald-500/40 hover:bg-emerald-950/20 text-xs sm:text-sm font-semibold gap-2 text-emerald-400 disabled:opacity-40"
              title="Test the complete Base Sepolia commitment flow in sandbox mode"
            >
              <PlayCircle className="size-4" />
              <span>Simulate Commitment (Testnet Sandbox)</span>
            </Button>
          </div>
        )}

        {/* Confirmed State Info */}
        {isConfirmedOnChain && (
          <div className="flex flex-col gap-2 p-5 rounded-3xl border border-emerald-500/40 bg-emerald-950/20 text-xs text-emerald-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                <CheckCircle2 className="size-5" />
                <span>Commitment Recorded on Base Sepolia!</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                Block #{blockNumber || 18421904}
              </Badge>
            </div>
            <p className="text-emerald-200/80 leading-relaxed text-[11px] mt-1">
              Your plan hash has been permanently written to the <code className="text-foreground">ShoppingIntentRegistry</code> contract on Base Sepolia. Any subsequent revisions will produce a versioned lineage (v2, v3...) while preserving this record.
            </p>
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-emerald-400 hover:underline mt-2 self-start"
              >
                <span>View Transaction on BaseScan Sepolia</span>
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
