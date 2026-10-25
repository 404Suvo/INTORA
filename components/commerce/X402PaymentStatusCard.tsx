"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X402PaymentModal } from "./X402PaymentModal";
import type { SettlementTelemetry } from "@/lib/x402-buyer";

interface X402PaymentStatusCardProps {
  currentQuery?: string;
  category?: string;
  className?: string;
}

export function X402PaymentStatusCard({
  currentQuery = "essential supplies",
  category = "supplies",
  className = "",
}: X402PaymentStatusCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<SettlementTelemetry | null>(null);

  useEffect(() => {
    fetch("/api/x402/wallet")
      .then((res) => res.json())
      .then((data) => setAgentStatus(data))
      .catch((err) => console.warn("Failed to load agent status:", err));
  }, []);

  const hasFunds = agentStatus?.balances?.hasUsdcFunds ?? false;
  const usdcBal = agentStatus?.balances?.usdcBalance ?? "0.00";
  const agentAddr = agentStatus?.address
    ? `${agentStatus.address.slice(0, 6)}...${agentStatus.address.slice(-4)}`
    : "Configured";

  return (
    <>
      <div
        className={`p-4 rounded-2xl border border-white/[0.08] bg-[#0A0D14]/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
            <Zap className="size-5" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-xs text-foreground tracking-tight">
                x402 Micro-Payment Protocol
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-mono py-0 px-1.5 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
              >
                Base Sepolia (84532)
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-mono py-0 px-1.5 h-4 border-white/10 text-muted-foreground bg-white/[0.02]"
              >
                0.01 USDC / Call
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
              Autonomous agent pays for verified price trends, counterfeit audits & cross-platform benchmarks.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted-foreground/80 mt-0.5">
              <span>Agent Signer: <strong className="text-foreground">{agentAddr}</strong></span>
              <span>•</span>
              <span className={hasFunds ? "text-emerald-400" : "text-amber-400"}>
                Balance: {usdcBal} USDC
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <Button
            type="button"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="size-3.5" />
            <span>Pay with x402</span>
          </Button>
        </div>
      </div>

      <X402PaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultQuery={currentQuery}
        defaultCategory={category}
      />
    </>
  );
}
