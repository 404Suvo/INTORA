"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  BadgeCheck,
  BatteryCharging,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Droplets,
  Eye,
  HardDrive,
  Headphones,
  HeartPulse,
  Highlighter,
  Info,
  Package,
  PenTool,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInr, PRODUCT_CATALOG } from "@/lib/catalog";
import { ProductCatalogItem } from "@/lib/types";
import { getProductVisual } from "@/lib/catalog-ui";

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

interface CatalogExplorerViewProps {
  onAddProductToPlan?: (productId: string) => void;
  existingPlanProductIds?: string[];
}

export function CatalogExplorerView({
  onAddProductToPlan,
  existingPlanProductIds = [],
}: CatalogExplorerViewProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [inspectItem, setInspectItem] = useState<ProductCatalogItem | null>(null);

  const categories = ["all", "stationery", "supplies", "electronics", "snacks", "hygiene"];

  const filteredItems = PRODUCT_CATALOG.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Package className="size-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Official Product Catalog
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative inventory source. All AI planning decisions and prices are strictly grounded here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/20 font-mono text-xs">
            15 Authoritative Records
          </Badge>
          <Badge variant="outline" className="border-white/[0.1] text-muted-foreground font-mono text-xs">
            INR Minor Units (Paise)
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog products..."
            className="pl-9 pr-8 h-10 rounded-2xl bg-[#0E131F] border-white/[0.08] font-mono text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-[#0E131F] border border-white/[0.08] text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item, idx) => {
          const visual = getProductVisual(item.id);
          const IconComponent = ICON_MAP[visual.iconName] || Package;
          const isInPlan = existingPlanProductIds.includes(item.id);

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              className={`flex flex-col justify-between rounded-3xl border p-5 backdrop-blur-xl transition-all ${
                item.inStock
                  ? "border-white/[0.08] bg-[#0E131F]/90 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5"
                  : "border-white/[0.04] bg-[#0E131F]/40 opacity-70"
              }`}
            >
              <div className="flex flex-col gap-3">
                {/* Visual Icon and Header */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${visual.gradient} border border-white/[0.08]`}
                  >
                    <IconComponent className="size-6 text-emerald-400" />
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-2 h-5 border-white/[0.1]">
                      {item.category}
                    </Badge>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {visual.badgeText}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Price, Stock and Actions */}
              <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="font-mono text-base font-bold text-foreground block">
                    {formatInr(item.priceMinor)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground block">
                    {item.priceMinor.toLocaleString()} paise &bull; per {item.unit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {item.inStock ? (
                    <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1 font-medium">
                      <CheckCircle2 className="size-3.5" />
                      {item.availableStock} in stock
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/70 inline-flex items-center gap-1">
                      <AlertCircle className="size-3.5" /> Sold out
                    </span>
                  )}

                  {/* Info Modal Trigger */}
                  <button
                    onClick={() => setInspectItem(item)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    title="View item specs"
                  >
                    <Eye className="size-4" />
                  </button>

                  {onAddProductToPlan && item.inStock && (
                    <Button
                      size="sm"
                      onClick={() => onAddProductToPlan(item.id)}
                      className="h-8 px-2.5 text-xs rounded-xl bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 font-semibold"
                    >
                      <Plus className="size-3.5 mr-1" />
                      {isInPlan ? "+1" : "Add"}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Product Spec Detail Modal */}
      <AnimatePresence>
        {inspectItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-3xl border border-white/[0.12] bg-[#0E131F] p-6 shadow-2xl text-foreground"
            >
              <button
                onClick={() => setInspectItem(null)}
                className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Package className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{inspectItem.name}</h3>
                  <span className="text-xs font-mono text-muted-foreground">ID: {inspectItem.id}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {inspectItem.description}
              </p>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-6">
                <div className="p-3 rounded-xl bg-[#090B10] border border-white/[0.04]">
                  <span className="text-[10px] text-muted-foreground uppercase block">Price</span>
                  <span className="font-bold text-foreground text-sm">{formatInr(inspectItem.priceMinor)}</span>
                  <span className="text-[10px] text-muted-foreground block">{inspectItem.priceMinor} paise</span>
                </div>

                <div className="p-3 rounded-xl bg-[#090B10] border border-white/[0.04]">
                  <span className="text-[10px] text-muted-foreground uppercase block">Stock Status</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {inspectItem.inStock ? `${inspectItem.availableStock} Available` : "Out of Stock"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Unit: {inspectItem.unit}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setInspectItem(null)}
                  className="rounded-xl h-9 text-xs"
                >
                  Close
                </Button>
                {onAddProductToPlan && inspectItem.inStock && (
                  <Button
                    onClick={() => {
                      onAddProductToPlan(inspectItem.id);
                      setInspectItem(null);
                    }}
                    className="rounded-xl h-9 text-xs bg-primary text-primary-foreground font-semibold"
                  >
                    Add to Active Plan
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
