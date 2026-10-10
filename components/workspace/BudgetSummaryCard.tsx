"use client";

import { AlertCircle, CheckCircle2, Coins, DollarSign, PieChart, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatInr, getProductById } from "@/lib/catalog";
import { ShoppingPlan } from "@/lib/types";

interface BudgetSummaryCardProps {
  plan: ShoppingPlan;
  budgetMinor: number;
}

export function BudgetSummaryCard({ plan, budgetMinor }: BudgetSummaryCardProps) {
  // Recomputed strictly in application code:
  const calculatedTotalMinor = plan.items.reduce(
    (acc, curr) => acc + curr.unitPriceMinor * curr.quantity,
    0
  );
  const remainingMinor = budgetMinor - calculatedTotalMinor;
  const isOverBudget = remainingMinor < 0;
  const percentUsed = Math.min(100, Math.max(0, Math.round((calculatedTotalMinor / budgetMinor) * 100)));
  const totalUnits = plan.items.reduce((acc, curr) => acc + curr.quantity, 0);

  // Category breakdown calculation
  const categoryTotals: Record<string, number> = {};
  for (const item of plan.items) {
    const catItem = getProductById(item.productId);
    const category = catItem?.category || "supplies";
    const cost = item.unitPriceMinor * item.quantity;
    categoryTotals[category] = (categoryTotals[category] || 0) + cost;
  }

  const categoryColors: Record<string, string> = {
    stationery: "bg-blue-400",
    supplies: "bg-teal-400",
    electronics: "bg-violet-400",
    snacks: "bg-amber-400",
    hygiene: "bg-emerald-400",
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Coins className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Budget & Expenditure</h3>
            <p className="text-[11px] text-muted-foreground">Integer paise arithmetic &bull; No floating point drift</p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="font-mono text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
        >
          Paise Precision: 100%
        </Badge>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* User Budget */}
        <div className="flex flex-col rounded-2xl bg-[#090B10]/70 p-3.5 border border-white/[0.06]">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">User Budget Cap</span>
          <span className="font-mono text-base sm:text-lg font-bold text-foreground mt-0.5">
            {formatInr(budgetMinor)}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {budgetMinor.toLocaleString()} paise
          </span>
        </div>

        {/* Recomputed Total */}
        <div className="flex flex-col rounded-2xl bg-[#090B10]/70 p-3.5 border border-white/[0.06]">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Plan Total</span>
          <span
            className={`font-mono text-base sm:text-lg font-bold mt-0.5 ${
              isOverBudget ? "text-destructive" : "text-emerald-400"
            }`}
          >
            {formatInr(calculatedTotalMinor)}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {calculatedTotalMinor.toLocaleString()} paise
          </span>
        </div>

        {/* Remaining Budget */}
        <div className="flex flex-col rounded-2xl bg-[#090B10]/70 p-3.5 border border-white/[0.06]">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">
            {isOverBudget ? "Over Budget By" : "Remaining Buffer"}
          </span>
          <span
            className={`font-mono text-base sm:text-lg font-bold mt-0.5 ${
              isOverBudget ? "text-destructive" : "text-emerald-400"
            }`}
          >
            {formatInr(Math.abs(remainingMinor))}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {isOverBudget ? "Exceeds cap" : `${Math.abs(remainingMinor).toLocaleString()} paise unspent`}
          </span>
        </div>

        {/* Items & Units */}
        <div className="flex flex-col rounded-2xl bg-[#090B10]/70 p-3.5 border border-white/[0.06]">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Products / Units</span>
          <span className="font-mono text-base sm:text-lg font-bold text-foreground mt-0.5">
            {plan.items.length} <span className="text-xs font-normal text-muted-foreground">SKUs</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {totalUnits} total units
          </span>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground text-[11px]">
            Budget Utilization: <strong className="text-foreground">{percentUsed}%</strong>
          </span>
          <span
            className={`font-mono text-[11px] font-semibold ${
              isOverBudget ? "text-destructive" : "text-emerald-400"
            }`}
          >
            {isOverBudget ? "EXCEEDS BUDGET CAP" : `${100 - percentUsed}% Headroom`}
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isOverBudget
                ? "bg-destructive"
                : percentUsed > 90
                  ? "bg-amber-400"
                  : "bg-emerald-400"
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      {/* Category Allocation Distribution Bar */}
      {calculatedTotalMinor > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Category Spending Distribution:</span>
            <span className="text-[10px] font-mono lowercase">{Object.keys(categoryTotals).length} categories active</span>
          </span>

          <div className="h-2 w-full flex overflow-hidden rounded-full bg-white/[0.06]">
            {Object.entries(categoryTotals).map(([cat, amount]) => {
              const widthPct = Math.max(3, (amount / calculatedTotalMinor) * 100);
              const colorClass = categoryColors[cat] || "bg-primary";
              return (
                <div
                  key={cat}
                  className={`h-full ${colorClass} transition-all`}
                  style={{ width: `${widthPct}%` }}
                  title={`${cat}: ${formatInr(amount)} (${Math.round((amount / calculatedTotalMinor) * 100)}%)`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground pt-0.5">
            {Object.entries(categoryTotals).map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${categoryColors[cat] || "bg-primary"}`} />
                <span className="capitalize">{cat}:</span>
                <span className="text-foreground font-semibold">{formatInr(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Over-budget Warning */}
      {isOverBudget && (
        <div className="flex items-center gap-2 p-3 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Total bundle cost exceeds your budget cap by {formatInr(Math.abs(remainingMinor))}. Please reduce item quantities or adjust your budget ceiling before approving.
          </span>
        </div>
      )}
    </div>
  );
}
