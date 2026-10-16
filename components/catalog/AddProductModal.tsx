"use client";

import { useState } from "react";
import {
  Check,
  Package,
  Plus,
  Search,
  Sparkles,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatInr,
  searchCatalog,
  registerCatalogProducts,
} from "@/lib/catalog";
import { ProductCatalogItem } from "@/lib/types";

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
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearchLiveAmazon = async () => {
    if (!search.trim() || isSearchingLive) return;
    setIsSearchingLive(true);
    setLiveError(null);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(search.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.userFriendlyMessage || data.error || `ScraperAPI search error: ${res.status}`);
      }
      const products = data.products || data.items || [];
      if (Array.isArray(products) && products.length > 0) {
        registerCatalogProducts(products);
      }
    } catch (err: any) {
      console.warn("Live Amazon search error:", err);
      setLiveError(err.message || "Failed to search Amazon India live.");
    } finally {
      setIsSearchingLive(false);
    }
  };

  const filtered = searchCatalog(
    search,
    selectedCat === "all" ? undefined : selectedCat
  );

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
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isSearchingLive}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!isSearchingLive) handleSearchLiveAmazon();
                  }
                }}
                placeholder="Search products by title, keyword, or ASIN..."
                className="pl-9 h-9 text-xs font-mono bg-background/80 rounded-xl border-white/[0.08] disabled:opacity-60"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSearchLiveAmazon}
              disabled={isSearchingLive || !search.trim()}
              className="h-9 px-3 text-xs gap-1.5 rounded-xl border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08]"
            >
              {isSearchingLive ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5 text-[#F4A28C]" />
              )}
              <span className="hidden sm:inline">Search Amazon</span>
            </Button>
          </div>

          {liveError && (
            <div className="text-[11px] text-red-400 bg-red-950/20 border border-red-500/30 p-2 rounded-xl">
              {liveError}
            </div>
          )}

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
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-white/[0.1] rounded-xl space-y-2">
              <p>No products found in local cache matching &quot;{search}&quot;.</p>
              <p className="text-[11px]">
                Click <strong>Search Amazon</strong> above to query Amazon India live via ScraperAPI.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isAlreadyAdded = existingProductIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-background/60 hover:border-white/[0.12] transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-11 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-full object-contain p-0.5 bg-white"
                        />
                      ) : (
                        <Package className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                          {item.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-4 border-white/[0.1] shrink-0">
                          {item.category}
                        </Badge>
                        {item.source === "scraperapi" && (
                          <span className="text-[9px] font-semibold text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
                            Amazon India
                          </span>
                        )}
                        {isAlreadyAdded && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                            In Plan
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-bold text-primary">
                          {formatInr(item.priceMinor)}
                        </span>
                        {item.rating && (
                          <span className="text-[10px] text-amber-400 font-medium">
                            ★ {item.rating} {item.totalReviews ? `(${item.totalReviews})` : ""}
                          </span>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            <span>Amazon.in</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </div>
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
            })
          )}
        </div>

        {/* Live pricing disclaimer */}
        <div className="text-[10px] text-muted-foreground/75 border-t border-white/[0.06] pt-2">
          Prices and stock retrieved from Amazon India via ScraperAPI. Prices are estimates and not guaranteed at checkout.
        </div>
      </div>
    </div>
  );
}
