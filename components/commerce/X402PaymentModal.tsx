"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductResearchResult } from "@/app/api/research/product/route";
import type { PaymentLifecycleStatus, SettlementTelemetry } from "@/lib/x402-buyer";

interface X402PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultQuery?: string;
  defaultCategory?: string;
  productName?: string;
}

export function X402PaymentModal({
  isOpen,
  onClose,
  defaultQuery = "wireless earbuds",
  defaultCategory = "electronics",
  productName,
}: X402PaymentModalProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [paymentState, setPaymentState] = useState<PaymentLifecycleStatus>("Ready");
  const [isLoading, setIsLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<SettlementTelemetry | null>(null);
  const [researchData, setResearchData] = useState<ProductResearchResult | null>(null);
  const [agentWallet, setAgentWallet] = useState<any>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync default query when modal opens or prop changes
  useEffect(() => {
    if (defaultQuery) {
      setQuery(defaultQuery);
    }
  }, [defaultQuery, isOpen]);

  // Fetch agent wallet status on mount
  async function refreshWalletStatus() {
    try {
      const res = await fetch("/api/x402/wallet");
      if (res.ok) {
        const data = await res.json();
        setAgentWallet(data);
      }
    } catch (err) {
      console.warn("Could not fetch x402 wallet status:", err);
    }
  }

  useEffect(() => {
    if (isOpen) {
      refreshWalletStatus();
    }
  }, [isOpen]);

  async function handlePayAndResearch() {
    setIsLoading(true);
    setErrorMsg(null);
    setPaymentState("Payment required");

    try {
      // Simulate real-time progress transitions in UI
      setTimeout(() => {
        setPaymentState((prev) => (prev === "Payment required" ? "Authorizing" : prev));
      }, 600);

      setTimeout(() => {
        setPaymentState((prev) => (prev === "Authorizing" ? "Submitting settlement" : prev));
      }, 1400);

      const res = await fetch("/api/x402/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim() || defaultQuery,
          category: defaultCategory,
          maxSpendUsd: "0.05",
        }),
      });

      const data: SettlementTelemetry = await res.json();
      setTelemetry(data);
      setPaymentState(data.status);

      if (data.status === "Confirmed" && data.researchData) {
        setResearchData(data.researchData);
      } else if (data.status === "Failed" || data.status === "Payment required") {
        setErrorMsg(data.errorMessage || "Payment could not be completed.");
      }

      await refreshWalletStatus();
    } catch (err: any) {
      setPaymentState("Failed");
      setErrorMsg(err?.message || "Failed to initiate x402 payment flow.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  const quotedPrice = telemetry?.quotedAmountUsd || "0.01";
  const token = telemetry?.tokenSymbol || "USDC";
  const network = telemetry?.network || "eip155:84532";
  const txHash = telemetry?.transactionHash || null;
  const explorerUrl = telemetry?.explorerUrl || (txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null);
  const agentAddress = agentWallet?.address || telemetry?.payerAddress || "Loading...";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-[#0A0D14] text-foreground shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
              <Zap className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-foreground tracking-tight">
                  Pay with x402 Protocol
                </h3>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] py-0 px-2 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-950/30"
                >
                  Base Sepolia
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Official EVM exact-payment scheme with facilitator settlement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Service & Pricing Quote Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                Protected Service
              </span>
              <span className="text-xs font-medium text-foreground">
                Deep Product Intelligence
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                Quoted Price
              </span>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-emerald-400">
                <span>{quotedPrice} {token}</span>
                <span className="text-[10px] text-muted-foreground font-normal">($0.01 USD)</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                Blockchain Rail
              </span>
              <span className="text-xs font-mono text-foreground flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
                Base Sepolia (84532)
              </span>
            </div>
          </div>

          {/* Research Target Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Target Research Query:</span>
              {productName && (
                <span className="text-[11px] text-emerald-400 font-mono">
                  Context: {productName}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. noise cancelling wireless earbuds, stainless steel flask"
                disabled={isLoading}
                className="w-full h-10 px-3.5 pl-9 rounded-xl border border-white/10 bg-black/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 font-mono transition-colors"
              />
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground/60" />
            </div>
          </div>

          {/* Agent Wallet Status & Balances */}
          <div className="p-3.5 rounded-2xl border border-white/[0.06] bg-black/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wallet className="size-3.5 text-blue-400" />
                Dedicated Agent Wallet (Server-Side Signer):
              </span>
              <button
                type="button"
                onClick={refreshWalletStatus}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                title="Refresh balances"
              >
                <RefreshCw className="size-2.5" />
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
              <div className="flex items-center gap-1.5 font-mono text-xs text-foreground/90 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
                <span className="text-muted-foreground text-[10px]">Address:</span>
                <span>
                  {typeof agentAddress === "string" && agentAddress.startsWith("0x")
                    ? `${agentAddress.slice(0, 8)}...${agentAddress.slice(-6)}`
                    : agentAddress}
                </span>
                {typeof agentAddress === "string" && agentAddress.startsWith("0x") && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(agentAddress);
                      setCopiedAddress(true);
                      setTimeout(() => setCopiedAddress(false), 2000);
                    }}
                    className="text-muted-foreground hover:text-foreground ml-1"
                    title="Copy agent wallet address"
                  >
                    <Copy className="size-3" />
                  </button>
                )}
                {copiedAddress && <span className="text-[10px] text-emerald-400">Copied!</span>}
              </div>

              {/* Balances */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">USDC:</span>
                  <span className={`font-semibold ${agentWallet?.balances?.hasUsdcFunds ? "text-emerald-400" : "text-amber-400"}`}>
                    {agentWallet?.balances?.usdcBalance ?? "0.00"} USDC
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">ETH:</span>
                  <span className="text-muted-foreground/90">
                    {agentWallet?.balances?.ethBalance ?? "0.0000"} ETH
                  </span>
                </div>
              </div>
            </div>

            {/* Testnet Faucet Banner if insufficient funds */}
            {agentWallet && !agentWallet?.balances?.hasUsdcFunds && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/20 text-amber-300 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0 text-amber-400" />
                  <span>Agent wallet needs Base Sepolia testnet USDC to pay.</span>
                </div>
                <a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium border border-amber-500/30 transition-colors"
                >
                  Circle Faucet
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </div>

          {/* Current Payment Lifecycle Status Display */}
          <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Protocol Payment Lifecycle State:
              </span>
              <div className="flex items-center gap-2">
                {paymentState === "Ready" && (
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/20 font-mono text-[11px]">
                    Ready
                  </Badge>
                )}
                {paymentState === "Payment required" && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-950/20 font-mono text-[11px]">
                    <span className="size-1.5 rounded-full bg-amber-400 animate-ping mr-1.5" />
                    HTTP 402 Payment Required
                  </Badge>
                )}
                {paymentState === "Authorizing" && (
                  <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-950/20 font-mono text-[11px]">
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                    Authorizing (Signing EIP-3009)
                  </Badge>
                )}
                {paymentState === "Submitting settlement" && (
                  <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-950/20 font-mono text-[11px]">
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                    Submitting Settlement to Facilitator
                  </Badge>
                )}
                {paymentState === "Confirmed" && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/20 font-mono text-[11px]">
                    <CheckCircle2 className="size-3 text-emerald-400 mr-1.5" />
                    Confirmed on Base Sepolia
                  </Badge>
                )}
                {paymentState === "Failed" && (
                  <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-950/20 font-mono text-[11px]">
                    <ShieldAlert className="size-3 text-rose-400 mr-1.5" />
                    Payment Failed
                  </Badge>
                )}
                {paymentState === "Pending verification" && (
                  <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-950/20 font-mono text-[11px]">
                    <span className="size-1.5 rounded-full bg-yellow-400 animate-pulse mr-1.5" />
                    Pending Verification
                  </Badge>
                )}
              </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{errorMsg}</p>
                  <p className="text-[11px] text-rose-300/80">
                    {telemetry?.requiresFunds
                      ? "Copy the agent wallet address above, claim free USDC from Circle Faucet on Base Sepolia, then retry."
                      : "The x402 exact-payment scheme requires a valid signature and facilitator settlement verification."}
                  </p>
                </div>
              </div>
            )}

            {/* Settlement On-Chain Hash & Basescan link (if Confirmed) */}
            {txHash && (
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    Real Base Sepolia Settlement Tx:
                  </span>
                  <a
                    href={explorerUrl || `https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 underline"
                  >
                    View on Basescan
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="flex items-center justify-between bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="font-mono text-xs text-foreground truncate max-w-[420px]">
                    {txHash}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(txHash);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs ml-2"
                    title="Copy transaction hash"
                  >
                    {copiedHash ? <span className="text-[10px] text-emerald-400">Copied!</span> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unlocked Research Intelligence Card */}
          {researchData && (
            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider font-mono">
                    Unlocked Research Intelligence
                  </span>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                  {researchData.verdict.recommendation}
                </Badge>
              </div>

              {/* Price Intelligence & Verdict */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-[10px] text-muted-foreground block font-mono">Market Benchmark</span>
                  <span className="text-base font-bold text-foreground font-mono">
                    ₹{researchData.priceIntelligence.benchmarkInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">
                    Est. Savings: ₹{researchData.priceIntelligence.estimatedSavingsInr}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-[10px] text-muted-foreground block font-mono">30-Day Low</span>
                  <span className="text-base font-bold text-foreground font-mono">
                    ₹{researchData.priceIntelligence.historical30DayLowInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Volatility: {researchData.priceIntelligence.volatility}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-[10px] text-muted-foreground block font-mono">Authenticity Audit</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {researchData.merchantAudit.authenticityScore} / 100
                  </span>
                  <span className="text-[10px] text-emerald-400/90 block mt-0.5">
                    Risk: {researchData.merchantAudit.counterfeitRisk}
                  </span>
                </div>
              </div>

              {/* Cross Platform Table */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                  Cross-Platform Pricing Comparison:
                </span>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-muted-foreground font-mono">
                        <th className="py-2 px-3">Platform</th>
                        <th className="py-2 px-3">Price</th>
                        <th className="py-2 px-3">Delivery</th>
                        <th className="py-2 px-3">Authorization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {researchData.crossPlatformPrices.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 text-foreground">{item.platform}</td>
                          <td className="py-2 px-3 font-semibold text-emerald-400">
                            ₹{item.priceInr.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{item.deliveryDays} Days</td>
                          <td className="py-2 px-3 text-emerald-400">
                            {item.isAuthorizedDealer ? "✓ Verified" : "Third Party"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rationale */}
              <p className="text-xs text-muted-foreground bg-black/30 p-3 rounded-xl border border-white/5 leading-relaxed">
                <strong className="text-foreground">Analyst Verdict: </strong>
                {researchData.verdict.rationale}
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] text-muted-foreground font-mono">
            Scheme: <span className="text-foreground">exact</span> | Rail: <span className="text-foreground">eip155:84532</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="border-white/10 text-muted-foreground hover:text-foreground text-xs"
            >
              Close
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePayAndResearch}
              disabled={isLoading}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs px-4 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Processing x402 Payment...
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Pay with x402 (0.01 USDC)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
