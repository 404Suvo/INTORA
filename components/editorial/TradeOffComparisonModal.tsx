"use client";

import React, { useState } from "react";
import {
  X,
  Scale,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  TrendingDown,
  Layers,
  ShieldCheck,
  Star,
  Package,
} from "lucide-react";
import { ProductItem } from "@/data/mockData";
import {
  ProductComparisonItem,
  TradeOffRecommendation,
  UserTradeOffPreference,
} from "@/lib/trade-off-engine";

interface TradeOffComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem: ProductItem;
  tradeOffData?: TradeOffRecommendation | null;
  onSelectAlternative?: (altItem: ProductComparisonItem) => void;
  onPreferenceChange?: (pref: UserTradeOffPreference) => void;
  currentPreference?: UserTradeOffPreference;
}

export function TradeOffComparisonModal({
  isOpen,
  onClose,
  currentItem,
  tradeOffData,
  onSelectAlternative,
  onPreferenceChange,
  currentPreference = "balanced",
}: TradeOffComparisonModalProps) {
  if (!isOpen) return null;

  const selected = tradeOffData?.selectedProduct;
  const alternatives = tradeOffData?.alternatives || [];
  const [activeTab, setActiveTab] = useState<"overview" | "breakdown" | "specs">("overview");
  const [selectedAltIndex, setSelectedAltIndex] = useState<number>(0);

  const activeAlternative = alternatives[selectedAltIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] border border-[#E4DED8] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4DED8] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1F4D45]/10 text-[#1F4D45] flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B857F]">
                  Total-Cost & Trade-Off Engine
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45]">
                  Verified Data
                </span>
              </div>
              <h3 className="font-serif-headline text-xl font-bold text-[#111111] line-clamp-1">
                {currentItem.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#E4DED8]/60 text-[#8B857F] hover:text-[#111111] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preference Selector Bar */}
        <div className="px-6 py-3 bg-[#F7F4F1] border-b border-[#E4DED8] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-[#8B857F]">
            <span>Optimization Preference:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "balanced", label: "Balanced Value" },
              { id: "lowest_cost", label: "Lowest Total Cost" },
              { id: "quality", label: "Best Quality & Evidence" },
              { id: "features", label: "Feature-Rich" },
            ].map((pref) => (
              <button
                key={pref.id}
                type="button"
                onClick={() => onPreferenceChange?.(pref.id as UserTradeOffPreference)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  currentPreference === pref.id
                    ? "bg-[#111111] text-white shadow-xs"
                    : "bg-white text-[#8B857F] border border-[#E4DED8] hover:text-[#111111]"
                }`}
              >
                {pref.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Factual Trade-off Explanations */}
          {tradeOffData?.selectionExplanation && (
            <div className="p-4 rounded-2xl bg-[#E8F3EE] border border-[#1F4D45]/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F4D45]">
                <Sparkles className="w-4 h-4" />
                <span>Why this product was selected</span>
              </div>
              <p className="text-xs text-[#2A433D] leading-relaxed">
                {tradeOffData.selectionExplanation.whySelected}
              </p>
              {tradeOffData.selectionExplanation.userSacrifices.length > 0 && (
                <div className="pt-2 border-t border-[#1F4D45]/15 space-y-1">
                  <div className="text-[11px] font-bold text-[#8B857F] uppercase tracking-wider">
                    What You Sacrifice:
                  </div>
                  <ul className="list-disc pl-4 text-xs text-[#555555] space-y-0.5">
                    {tradeOffData.selectionExplanation.userSacrifices.map((sac, idx) => (
                      <li key={idx}>{sac}</li>
                    ))}
                  </ul>
                </div>
              )}
              {tradeOffData.selectionExplanation.whyAlternativeMayBeBetter && (
                <div className="pt-2 border-t border-[#1F4D45]/15 text-xs text-[#2A433D]">
                  <span className="font-semibold">When an alternative is better: </span>
                  <span>{tradeOffData.selectionExplanation.whyAlternativeMayBeBetter}</span>
                </div>
              )}
            </div>
          )}

          {/* Side-by-Side Comparison Container */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#8B857F] uppercase tracking-wider">
              <span>Primary Recommendation vs Suitable Alternatives</span>
              {alternatives.length > 0 && (
                <span>{alternatives.length} Available Alternative{alternatives.length > 1 ? "s" : ""}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Currently Recommended Product */}
              <div className="p-5 rounded-3xl bg-[#FAF8F5] border-2 border-[#1F4D45] space-y-4 relative shadow-2xs">
                <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1F4D45] text-white">
                  Current Choice
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4D45]">
                    {selected?.merchant || currentItem.merchant || "Amazon India"}
                  </span>
                  <h4 className="font-serif-headline text-lg font-bold text-[#111111] line-clamp-2 mt-0.5">
                    {selected?.name || currentItem.name}
                  </h4>
                </div>

                {/* Pricing & Cost Breakdown */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E4DED8] space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-[#8B857F]">Unit Price:</span>
                    <span className="text-sm font-semibold text-[#111111]">
                      ₹{(selected?.cost.unitPrice ?? currentItem.unitPrice).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-[#8B857F]">Shipping Cost:</span>
                    <span className="text-xs font-medium text-[#111111]">
                      {selected?.cost.shippingType === "free"
                        ? "FREE (Included)"
                        : selected?.cost.shippingCost
                        ? `₹${selected.cost.shippingCost}`
                        : "Unknown / Checkout Verified"}
                    </span>
                  </div>
                  {selected?.cost.discounts ? (
                    <div className="flex justify-between items-baseline text-[#1F4D45]">
                      <span className="text-xs">Discounts Applied:</span>
                      <span className="text-xs font-semibold">
                        -₹{selected.cost.discounts.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t border-[#E4DED8] flex justify-between items-baseline">
                    <div>
                      <span className="text-xs font-bold text-[#111111]">Estimated Total:</span>
                      <div className="text-[10px] text-[#8B857F]">
                        Status:{" "}
                        <span className="font-semibold text-[#1F4D45]">
                          {selected?.cost.costCompleteness === "complete"
                            ? "Complete"
                            : selected?.cost.costCompleteness === "estimated"
                            ? "Estimated"
                            : "Partial (Shipping unconfirmed)"}
                        </span>
                      </div>
                    </div>
                    <div className="font-serif-headline text-xl font-bold text-[#1F4D45]">
                      ₹{(selected?.cost.estimatedTotalCost ?? currentItem.totalPrice).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Rating & Review Evidence */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    <span className="font-bold text-[#111111]">
                      {selected?.rating ? `★${selected.rating}` : "No rating available"}
                    </span>
                    {selected?.reviewCount ? (
                      <span className="text-[#8B857F]">({selected.reviewCount.toLocaleString("en-IN")} reviews)</span>
                    ) : null}
                  </div>
                  {selected?.valueScore ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF8F5] border border-[#E4DED8] text-[#111111]">
                      Value Score: {selected.valueScore}/100
                    </span>
                  ) : null}
                </div>

                {/* Key Advantages */}
                {selected?.advantages && selected.advantages.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-[#111111]">Advantages:</span>
                    <ul className="space-y-1">
                      {selected.advantages.slice(0, 3).map((adv, aIdx) => (
                        <li key={aIdx} className="flex items-start gap-1.5 text-[#2A433D]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4D45] shrink-0 mt-0.5" />
                          <span>{adv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Product Link */}
                {(selected?.productUrl || currentItem.url) && (
                  <div className="pt-2">
                    <a
                      href={selected?.productUrl || currentItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4D45] hover:underline"
                    >
                      <span>View on Amazon India</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Right Column: Alternative Candidate Inspector */}
              {activeAlternative ? (
                <div className="p-5 rounded-3xl bg-white border border-[#E4DED8] hover:border-[#F4A28C] transition-all space-y-4 shadow-2xs flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Alternatives selector pills if multiple */}
                    {alternatives.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {alternatives.map((alt, idx) => (
                          <button
                            key={alt.productId}
                            type="button"
                            onClick={() => setSelectedAltIndex(idx)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                              selectedAltIndex === idx
                                ? "bg-[#111111] text-white"
                                : "bg-[#F7F4F1] text-[#8B857F] hover:text-[#111111]"
                            }`}
                          >
                            Alt #{idx + 1} (₹{alt.cost.estimatedTotalCost.toLocaleString("en-IN")})
                          </button>
                        ))}
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B857F]">
                        {activeAlternative.merchant || "Amazon India"}
                      </span>
                      <h4 className="font-serif-headline text-lg font-bold text-[#111111] line-clamp-2 mt-0.5">
                        {activeAlternative.name}
                      </h4>
                    </div>

                    {/* Pricing & Cost Breakdown */}
                    <div className="p-3.5 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-[#8B857F]">Unit Price:</span>
                        <span className="text-sm font-semibold text-[#111111]">
                          ₹{activeAlternative.cost.unitPrice.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-[#8B857F]">Shipping Cost:</span>
                        <span className="text-xs font-medium text-[#111111]">
                          {activeAlternative.cost.shippingType === "free"
                            ? "FREE (Included)"
                            : activeAlternative.cost.shippingCost
                            ? `₹${activeAlternative.cost.shippingCost}`
                            : "Unknown / Checkout Verified"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#E4DED8] flex justify-between items-baseline">
                        <div>
                          <span className="text-xs font-bold text-[#111111]">Estimated Total:</span>
                          <div className="text-[10px] text-[#8B857F]">
                            {activeAlternative.cost.estimatedTotalCost < (selected?.cost.estimatedTotalCost ?? 0) ? (
                              <span className="font-bold text-[#1F4D45]">
                                Saves ₹{((selected?.cost.estimatedTotalCost ?? 0) - activeAlternative.cost.estimatedTotalCost).toLocaleString("en-IN")}
                              </span>
                            ) : activeAlternative.cost.estimatedTotalCost > (selected?.cost.estimatedTotalCost ?? 0) ? (
                              <span className="font-bold text-amber-700">
                                +₹{(activeAlternative.cost.estimatedTotalCost - (selected?.cost.estimatedTotalCost ?? 0)).toLocaleString("en-IN")} higher
                              </span>
                            ) : (
                              <span className="font-medium text-[#8B857F]">Equal Cost</span>
                            )}
                          </div>
                        </div>
                        <div className="font-serif-headline text-xl font-bold text-[#111111]">
                          ₹{activeAlternative.cost.estimatedTotalCost.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {/* Rating & Review Evidence */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                        <span className="font-bold text-[#111111]">
                          {activeAlternative.rating ? `★${activeAlternative.rating}` : "No rating"}
                        </span>
                        {activeAlternative.reviewCount ? (
                          <span className="text-[#8B857F]">
                            ({activeAlternative.reviewCount.toLocaleString("en-IN")} reviews)
                          </span>
                        ) : null}
                      </div>
                      {activeAlternative.valueScore ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF8F5] border border-[#E4DED8] text-[#111111]">
                          Score: {activeAlternative.valueScore}/100
                        </span>
                      ) : null}
                    </div>

                    {/* Drawbacks / Sacrifices if switching */}
                    {activeAlternative.drawbacks.length > 0 && (
                      <div className="space-y-1 text-xs">
                        <span className="font-semibold text-amber-900">Trade-Off Considerations:</span>
                        <ul className="space-y-1">
                          {activeAlternative.drawbacks.map((dr, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-1.5 text-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>{dr}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Switch Button */}
                  <div className="pt-4 border-t border-[#E4DED8] flex items-center justify-between gap-3">
                    {activeAlternative.productUrl && (
                      <a
                        href={activeAlternative.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#8B857F] hover:text-[#111111]"
                      >
                        <span>View Details</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAlternative?.(activeAlternative);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-[#111111] text-white hover:bg-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Switch to this Alternative</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-3xl bg-[#FAF8F5] border border-[#E4DED8] text-center flex flex-col items-center justify-center space-y-2 text-[#8B857F]">
                  <Package className="w-8 h-8 text-[#8B857F]/60" />
                  <p className="font-semibold text-xs text-[#111111]">No other alternatives retrieved</p>
                  <p className="text-xs max-w-xs leading-relaxed">
                    All other retrieved catalog items were either out of stock or failed required specifications.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E4DED8] bg-[#FAF8F5] flex items-center justify-between text-xs text-[#8B857F]">
          <div>
            <span>Calculations powered by Intora's Total-Cost & Trade-Off Engine.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full font-semibold bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
