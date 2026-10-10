"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  History,
  Layers,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInr, getProductById } from "@/lib/catalog";
import { StoredPlanRecord } from "@/lib/types";

interface IntentSummaryRecord {
  intentId: string;
  latestVersion: number;
  updatedAt: string;
}

interface IntentHistoryViewProps {
  onSelectIntent: (intentId: string) => void;
  activeIntentId?: string | null;
  onStartNewPlan: () => void;
}

export function IntentHistoryView({
  onSelectIntent,
  activeIntentId,
  onStartNewPlan,
}: IntentHistoryViewProps) {
  const [loading, setLoading] = useState(false);
  const [intentsList, setIntentsList] = useState<IntentSummaryRecord[]>([]);
  const [detailedRecords, setDetailedRecords] = useState<Record<string, StoredPlanRecord>>({});

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/plan");
      if (res.ok) {
        const data = await res.json();
        const list: IntentSummaryRecord[] = data.intents || [];
        setIntentsList(list);

        // Fetch latest plan details for each to display budget and total
        const detailsMap: Record<string, StoredPlanRecord> = {};
        for (const item of list.slice(0, 10)) {
          const detailRes = await fetch(`/api/plan?intentId=${item.intentId}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.latest) {
              detailsMap[item.intentId] = detailData.latest;
            }
          }
        }
        setDetailedRecords(detailsMap);
      }
    } catch (err) {
      console.error("Failed to load intent history:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [activeIntentId]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <History className="size-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Saved Intent History
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Browse stored shopping plans, inspect previous versions, and restore them into your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
            className="h-9 rounded-xl text-xs font-mono border-white/[0.1] hover:bg-white/[0.05]"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={onStartNewPlan}
            className="h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            New Shopping Plan
          </Button>
        </div>
      </div>

      {/* History List or Clean Empty State */}
      {intentsList.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-white/[0.08] bg-[#0E131F]/80 backdrop-blur-md">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-muted-foreground mb-3">
            <ShoppingBag className="size-7" />
          </div>
          <h3 className="font-bold text-base text-foreground">No Saved Plans Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
            Once you generate or optimize a shopping plan in the AI Workspace, it will be automatically saved off-chain and versioned here.
          </p>
          <Button
            onClick={onStartNewPlan}
            className="mt-5 h-10 px-5 text-xs font-bold bg-primary text-primary-foreground rounded-2xl shadow-md shadow-emerald-500/20"
          >
            Create Your First Plan
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {intentsList.map((item, idx) => {
            const isSelected = item.intentId.toLowerCase() === activeIntentId?.toLowerCase();
            const detail = detailedRecords[item.intentId];
            const plan = detail?.plan;
            const commitmentStatus = detail?.onChainCommitment?.status || "uncommitted";
            const txHash = detail?.onChainCommitment?.txHash;

            return (
              <motion.div
                key={item.intentId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-3xl border transition-all gap-4 ${
                  isSelected
                    ? "border-primary/50 bg-primary/10 shadow-lg shadow-primary/5"
                    : "border-white/[0.08] bg-[#0E131F]/90 hover:border-white/[0.16]"
                }`}
              >
                {/* Details */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      Intent: {item.intentId.slice(0, 10)}...{item.intentId.slice(-8)}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-2 h-5 border-white/[0.1] rounded-md">
                      Version {item.latestVersion}
                    </Badge>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-primary font-semibold">
                        [Active in Workspace]
                      </span>
                    )}
                  </div>

                  {plan && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Coins className="size-3 text-primary" /> Budget: {formatInr(plan.budgetMinor)}
                      </span>
                      <span>&bull;</span>
                      <span className="inline-flex items-center gap-1 font-mono text-foreground font-semibold">
                        Total: {formatInr(plan.totalMinor)}
                      </span>
                      <span>&bull;</span>
                      <span>{plan.items.length} products</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 font-mono">
                    <Calendar className="size-3" />
                    <span>Updated: {new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Status and Action */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono capitalize rounded-lg px-2.5 py-1 ${
                      commitmentStatus === "confirmed"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
                        : "border-white/[0.08] text-muted-foreground"
                    }`}
                  >
                    {commitmentStatus === "confirmed" ? "Base Sepolia Confirmed" : "Off-Chain Stored"}
                  </Badge>

                  {txHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-muted-foreground hover:text-emerald-400 transition-colors"
                      title="View on BaseScan"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}

                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onSelectIntent(item.intentId)}
                    className="h-9 text-xs font-semibold rounded-xl gap-1.5 border-white/[0.1]"
                  >
                    <span>{isSelected ? "Active Plan" : "Load Into Workspace"}</span>
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
