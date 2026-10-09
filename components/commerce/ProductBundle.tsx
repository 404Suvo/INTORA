"use client";

import { AlertTriangle, CheckCircle2, MinusCircle, PlusCircle, RefreshCw, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatInr, getProductById } from "@/lib/catalog";
import { PlanDiff, PriceMismatch, ShoppingPlan } from "@/lib/types";

interface ProductBundleProps {
  plan: ShoppingPlan;
  diff?: PlanDiff | null;
  priceMismatches?: PriceMismatch[];
  warnings?: string[];
}

export function ProductBundle({
  plan,
  diff,
  priceMismatches = [],
  warnings = [],
}: ProductBundleProps) {
  const percentUsed = Math.min(100, Math.round((plan.totalMinor / plan.budgetMinor) * 100));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-5">
      {/* Header and totals */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          <h3 className="font-bold text-base tracking-tight uppercase">
            Validated Shopping Bundle (Version {plan.version})
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Plan Total</span>
            <span className="font-mono font-bold text-base text-primary">
              {formatInr(plan.totalMinor)}
            </span>
          </div>
          <div className="text-right border-l pl-3">
            <span className="text-xs text-muted-foreground block">Budget Cap</span>
            <span className="font-mono text-sm text-foreground">
              {formatInr(plan.budgetMinor)}
            </span>
          </div>
        </div>
      </div>

      {/* Budget utilization progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Budget Utilization: {percentUsed}%</span>
          <span>Remaining: {formatInr(Math.max(0, plan.budgetMinor - plan.totalMinor))}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-300 ${
              percentUsed > 95 ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      {/* Warnings & Price Mismatches Banner */}
      {priceMismatches.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-300">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span>AI Price Discrepancy Corrected (Hard Rule 3)</span>
          </div>
          <p className="mt-1 text-amber-200/90">
            AI-suggested prices were safely overwritten with authoritative catalog values:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {priceMismatches.map((m, idx) => (
              <li key={idx}>
                {getProductById(m.productId)?.name || m.productId}: AI proposed {formatInr(m.aiPriceMinor)}, catalog price enforced at {formatInr(m.catalogPriceMinor)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Version Diff Banner */}
      {diff && (
        <div className="rounded-lg border border-blue-500/40 bg-blue-950/20 p-3 text-xs text-blue-200">
          <div className="flex items-center gap-1.5 font-semibold text-blue-400 mb-1">
            <RefreshCw className="size-3.5" />
            <span>Version Revision Changes (v{diff.fromVersion} &rarr; v{diff.toVersion})</span>
          </div>
          <p className="mb-2 text-foreground/90 font-mono text-[11px]">{diff.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-500/20">
            {diff.removedItems.length > 0 && (
              <div>
                <span className="font-semibold text-rose-400 block mb-0.5">Removed to fit budget:</span>
                {diff.removedItems.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-2">
                    <MinusCircle className="size-3 text-rose-500 inline" />
                    {getProductById(r.productId)?.name ?? r.productId}
                  </span>
                ))}
              </div>
            )}
            {diff.addedItems.length > 0 && (
              <div>
                <span className="font-semibold text-emerald-400 block mb-0.5">Added essential items:</span>
                {diff.addedItems.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-2">
                    <PlusCircle className="size-3 text-emerald-500 inline" />
                    {getProductById(a.productId)?.name ?? a.productId}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bundle Products ({plan.items.length} items)
        </span>

        <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-background/50">
          {plan.items.map((item, index) => {
            const product = getProductById(item.productId);
            const lineTotal = item.unitPriceMinor * item.quantity;

            return (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {product?.name || item.productId}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-primary/30 text-primary">
                      {product?.category || "supplies"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {product?.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Catalog Verified
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Available: {product?.availableStock ?? "In Stock"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.quantity} &times; {formatInr(item.unitPriceMinor)}
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground min-w-[80px]">
                    {formatInr(lineTotal)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
