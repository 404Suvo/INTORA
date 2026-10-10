"use client";

import { useState } from "react";
import {
  Check,
  Package,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInr, PRODUCT_CATALOG } from "@/lib/catalog";
import { ProductCatalogItem } from "@/lib/types";
import { getProductVisual } from "@/lib/catalog-ui";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (productId: string) => void;
  existingProductIds: string[];
}

export function AddProductModal({
  isOpen,
  onClose,
  onAddProduct,
  existingProductIds,
}: AddProductModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");

  if (!isOpen) return null;

  const filtered = PRODUCT_CATALOG.filter((item) => {
    if (selectedCat !== "all" && item.category !== selectedCat) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const categories = ["all", "stationery", "supplies", "electronics", "snacks", "hygiene"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Add Product from Catalog</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by title, category, or keyword..."
              className="pl-9 h-9 text-xs font-mono bg-background/80 rounded-xl border-white/[0.08]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-all ${
                  selectedCat === cat
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
          {filtered.map((item) => {
            const isAlreadyAdded = existingProductIds.includes(item.id);
            const visual = getProductVisual(item.id);

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-background/60 hover:border-white/[0.12] transition-colors gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {item.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-4 border-white/[0.1]">
                      {item.category}
                    </Badge>
                    {isAlreadyAdded && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        In Plan
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-bold text-primary">
                      {formatInr(item.priceMinor)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Stock: {item.inStock ? `${item.availableStock} available` : "Out of stock"}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={!item.inStock}
                  onClick={() => {
                    onAddProduct(item.id);
                    onClose();
                  }}
                  className={`h-8 px-3 text-xs font-medium gap-1 rounded-lg shrink-0 ${
                    isAlreadyAdded
                      ? "bg-white/[0.08] text-foreground hover:bg-white/[0.15]"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  <Plus className="size-3.5" />
                  <span>{isAlreadyAdded ? "Add Another" : "Add to Plan"}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
