"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  BatteryCharging,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Droplets,
  HardDrive,
  Headphones,
  HeartPulse,
  Highlighter,
  Minus,
  MinusCircle,
  Package,
  PenTool,
  Plus,
  PlusCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Trash2,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInr, getProductById, PRODUCT_CATALOG } from "@/lib/catalog";
import { getProductRecommendationReason, getProductVisual } from "@/lib/catalog-ui";
import { PlanDiff, PriceMismatch, ShoppingPlan, ShoppingPlanItem } from "@/lib/types";

const ICON_MAP: Record<string, any> = {
  BookOpen,
  PenTool,
  Highlighter,
  StickyNote,
  Droplets,
  Zap,
  BatteryCharging,
  HardDrive,
  Briefcase,
  HeartPulse,
  Headphones,
  BadgeCheck,
  Wind,
  Package,
  Sparkles,
};

interface ProductBundleEditorProps {
  plan: ShoppingPlan;
  diff?: PlanDiff | null;
  priceMismatches?: PriceMismatch[];
  userSituation?: string;
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onOpenAddModal: () => void;
  onSwapItem?: (oldProductId: string, newProductId: string) => void;
}

export function ProductBundleEditor({
  plan,
  diff,
  priceMismatches = [],
  userSituation = "",
  onUpdateQuantity,
  onRemoveItem,
  onOpenAddModal,
  onSwapItem,
}: ProductBundleEditorProps) {
  const [removedAlert, setRemovedAlert] = useState<string | null>(null);
  const [swappingItemId, setSwappingItemId] = useState<string | null>(null);

  function handleRemove(productId: string, productName: string) {
    onRemoveItem(productId);
    setRemovedAlert(`Removed "${productName}" from bundle.`);
    setTimeout(() => setRemovedAlert(null), 3000);
  }

  function handlePerformSwap(oldId: string, newId: string) {
    if (onSwapItem) {
      onSwapItem(oldId, newId);
    } else {
      // Fallback: remove old, then let user add new
      onRemoveItem(oldId);
    }
    setSwappingItemId(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
      {/* Header and Add Item action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <ShoppingBag className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Recommended Shopping Bundle ({plan.items.length} Products)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Catalog grounded &bull; Interactive quantities, swaps & budget rebalancing
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onOpenAddModal}
          className="h-8 rounded-xl text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
        >
          <Plus className="size-3.5" />
          <span>Add Catalog Item</span>
        </Button>
      </div>

      {/* Price Mismatch Notice if any */}
      {priceMismatches.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs text-amber-300 flex flex-col gap-1">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>AI Price Discrepancy Flagged & Corrected (Hard Rule 3)</span>
          </div>
          <p className="text-[11px] text-amber-200/80">
            AI proposed hallucinated unit prices which were safely overwritten with catalog truth:
          </p>
          <ul className="list-disc pl-5 text-[11px] text-amber-200/90 space-y-0.5 mt-0.5">
            {priceMismatches.map((m, idx) => (
              <li key={idx}>
                <span className="font-semibold">{getProductById(m.productId)?.name || m.productId}:</span> AI
                proposed {formatInr(m.aiPriceMinor)}, catalog enforced at{" "}
                <span className="font-bold underline">{formatInr(m.catalogPriceMinor)}</span>.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Revision Diff Banner if plan is a revision */}
      {diff && (
        <div className="rounded-2xl border border-blue-500/40 bg-blue-950/20 p-3.5 text-xs text-blue-200 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 font-bold text-blue-400">
            <RefreshCw className="size-3.5" />
            <span>Version Revision Delta (v{diff.fromVersion} &rarr; v{diff.toVersion})</span>
          </div>
          <p className="text-[11px] font-mono text-foreground/90">{diff.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-500/20 text-[11px]">
            {diff.removedItems.length > 0 && (
              <div>
                <span className="font-semibold text-rose-400 block mb-0.5">Removed to fit budget:</span>
                {diff.removedItems.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-muted-foreground mr-2">
                    <MinusCircle className="size-3 text-rose-400" />
                    {getProductById(r.productId)?.name ?? r.productId}
                  </span>
                ))}
              </div>
            )}
            {diff.addedItems.length > 0 && (
              <div>
                <span className="font-semibold text-emerald-400 block mb-0.5">Added essential items:</span>
                {diff.addedItems.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-muted-foreground mr-2">
                    <PlusCircle className="size-3 text-emerald-400" />
                    {getProductById(a.productId)?.name ?? a.productId}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Temporary feedback alert */}
      {removedAlert && (
        <div className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-xl border border-white/[0.06] animate-in fade-in">
          {removedAlert}
        </div>
      )}

      {/* Product Items List with Motion Stagger */}
      <div className="flex flex-col gap-3">
        {plan.items.map((item, index) => {
          const product = getProductById(item.productId);
          const visual = getProductVisual(item.productId);
          const IconComponent = ICON_MAP[visual.iconName] || Package;
          const lineTotal = item.unitPriceMinor * item.quantity;
          const reason = getProductRecommendationReason(item.productId, userSituation);

          const isSwapping = swappingItemId === item.productId;
          const categoryAlternatives = PRODUCT_CATALOG.filter(
            (p) => p.category === product?.category && p.id !== item.productId && p.inStock
          );

          return (
            <motion.div
              key={item.productId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className="flex flex-col p-4 rounded-2xl border border-white/[0.08] bg-[#090B10]/70 hover:border-white/[0.14] transition-all gap-3"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Product Visual & Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${visual.gradient} border border-white/[0.08] text-foreground shadow-sm`}
                  >
                    <IconComponent className="size-5 text-emerald-400" />
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {product?.name || item.productId}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono py-0 px-1.5 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
                      >
                        {product?.category || "supplies"}
                      </Badge>
                      <span className="text-[10px] font-medium text-muted-foreground/80 bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]">
                        {visual.badgeText}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
                      {product?.description}
                    </p>

                    {/* Recommendation Reason Pill */}
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/90 bg-emerald-950/20 px-2.5 py-1 rounded-xl border border-emerald-500/20 mt-0.5">
                      <Sparkles className="size-3 text-emerald-400 shrink-0" />
                      <span className="italic leading-tight">{reason}</span>
                    </div>
                  </div>
                </div>

                {/* Price, Quantity Selector, Subtotal & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
                  {/* Unit Price */}
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-muted-foreground block font-mono">Unit</span>
                    <span className="font-mono text-xs text-foreground font-medium">
                      {formatInr(item.unitPriceMinor)}
                    </span>
                  </div>

                  {/* Working Quantity Stepper */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-card/90 p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="size-3" />
                    </button>

                    <span className="min-w-[24px] text-center font-mono text-xs font-bold text-foreground">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                      disabled={Boolean(product && item.quantity >= product.availableStock)}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right min-w-[75px]">
                    <span className="text-[10px] text-muted-foreground block font-mono">Total</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {formatInr(lineTotal)}
                    </span>
                  </div>

                  {/* Actions: Swap Alternative & Remove */}
                  <div className="flex items-center gap-1">
                    {categoryAlternatives.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSwappingItemId(isSwapping ? null : item.productId)}
                        className={`p-2 rounded-xl transition-colors ${
                          isSwapping
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        title="Swap with alternative product"
                      >
                        <ArrowRightLeft className="size-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemove(item.productId, product?.name || item.productId)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                      title="Remove item from bundle"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Swap Alternatives Tray */}
              <AnimatePresence>
                {isSwapping && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-2 border-t border-white/[0.06] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Swap with another {product?.category} item:</span>
                      <button
                        onClick={() => setSwappingItemId(null)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {categoryAlternatives.map((alt) => (
                        <button
                          key={alt.id}
                          onClick={() => handlePerformSwap(item.productId, alt.id)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.06] bg-card hover:border-emerald-500/40 hover:bg-emerald-950/20 text-left transition-all"
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-medium text-foreground truncate">{alt.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{formatInr(alt.priceMinor)}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                            Swap
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
