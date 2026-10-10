"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Sliders,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Zap,
  RotateCcw,
  Plus,
  Minus,
} from "lucide-react";
import { PRESET_SITUATIONS, MOCK_PLANS, ShoppingPlanData, ProductItem } from "@/data/mockData";
import { generatePlan, hashPlan } from "@/lib/stubs";

interface LivePlannerDemoProps {
  onApproveAndRecord?: (plan: ShoppingPlanData, hash: string) => void;
  onEditInFullPlanner?: (plan: ShoppingPlanData) => void;
  externalPrompt?: string;
  externalBudget?: number;
}

export function LivePlannerDemo({
  onApproveAndRecord,
  onEditInFullPlanner,
  externalPrompt,
  externalBudget,
}: LivePlannerDemoProps) {
  const [situationPrompt, setSituationPrompt] = useState(
    externalPrompt || PRESET_SITUATIONS[0].prompt
  );
  const [budget, setBudget] = useState(externalBudget || 3000);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ShoppingPlanData>(
    MOCK_PLANS["college-fest"]
  );
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({
    "prod-bottle-01": true,
  });

  // Sync when externalPrompt or externalBudget changes from Hero prompt chips
  useEffect(() => {
    if (externalPrompt) {
      setSituationPrompt(externalPrompt);
      if (externalBudget) setBudget(externalBudget);
      handleGenerate(externalPrompt, externalBudget || budget);
    }
  }, [externalPrompt, externalBudget]);

  const toggleRationale = (itemId: string) => {
    setExpandedRationales((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleGenerate = async (promptOverride?: string, budgetOverride?: number) => {
    setIsLoading(true);
    const p = promptOverride || situationPrompt;
    const b = budgetOverride || budget;
    try {
      const generated = await generatePlan(p, b);
      const computedHash = await hashPlan(generated);
      setCurrentPlan({
        ...generated,
        planHash: computedHash,
      });
    } catch (err) {
      console.error("Plan generation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, delta: number) => {
    const updatedItems = currentPlan.items
      .map((item) => {
        if (item.id === itemId) {
          const newQty = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            totalPrice: item.unitPrice * newQty,
          };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    const newTotal = updatedItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const remaining = Math.max(0, currentPlan.budget - newTotal);

    const updatedPlan: ShoppingPlanData = {
      ...currentPlan,
      items: updatedItems,
      totalAmount: newTotal,
      remainingAmount: remaining,
      validation: {
        ...currentPlan.validation,
        budgetCompliant: newTotal <= currentPlan.budget,
      },
    };

    const newHash = await hashPlan(updatedPlan);
    updatedPlan.planHash = newHash;
    setCurrentPlan(updatedPlan);
  };

  const isUnderBudget = currentPlan.totalAmount <= currentPlan.budget;
  const percentageUsed = Math.min(
    100,
    Math.round((currentPlan.totalAmount / currentPlan.budget) * 100)
  );

  return (
    <section id="demo" className="scroll-mt-24 md:scroll-mt-28 py-24 md:py-32 bg-[#EEE9E4] pattern-dots relative overflow-hidden">
      {/* Peach ambient radial glow */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-br from-[#F9D5CB]/30 via-[#F4A28C]/20 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Editorial Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white border border-[#E4DED8] text-[#8B857F] mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#F4A28C]" />
            <span>Interactive Live Demo</span>
          </div>
          <h2 className="font-serif-headline text-5xl sm:text-6xl text-[#111111] leading-tight mb-4">
            Test the planning agent{" "}
            <span className="text-[#8B857F] italic font-normal">in real-time.</span>
          </h2>
          <p className="font-editorial-sans text-base sm:text-lg text-[#8B857F] leading-relaxed">
            Adjust the natural language situation, slide your budget in ₹, and
            watch the catalog solver optimize in milliseconds.
          </p>
        </div>

        {/* 2-Column Interactive Centerpiece */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Situation & Budget Controls (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-[32px] border border-[#E4DED8] p-6 sm:p-8 shadow-editorial-card space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8B857F] mb-2">
                1. Situation or Event Description
              </label>
              <textarea
                value={situationPrompt}
                onChange={(e) => setSituationPrompt(e.target.value)}
                rows={4}
                placeholder="Describe your upcoming event, college fest, trek or hostel move-in..."
                className="w-full rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] p-4 text-sm text-[#111111] focus:outline-none focus:border-[#F4A28C] transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Quick preset chips */}
            <div>
              <div className="text-[11px] font-medium text-[#8B857F] mb-2">
                Load preset scenario:
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_SITUATIONS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSituationPrompt(preset.prompt);
                      setBudget(preset.defaultBudget);
                      handleGenerate(preset.prompt, preset.defaultBudget);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      situationPrompt === preset.prompt
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white text-[#8B857F] border-[#E4DED8] hover:text-[#111111] hover:bg-[#F7F4F1]"
                    }`}
                  >
                    {preset.chipLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Slider */}
            <div className="pt-4 border-t border-[#E4DED8] space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                  2. Budget Cap (Indian Rupees)
                </label>
                <span className="font-serif-headline text-2xl font-bold text-[#111111]">
                  ₹{budget.toLocaleString("en-IN")}
                </span>
              </div>

              <input
                type="range"
                min="1000"
                max="20000"
                step="500"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-[#111111] cursor-pointer"
              />

              {/* Ticks */}
              <div className="flex justify-between text-[11px] font-mono text-[#8B857F]">
                <span>₹1,000</span>
                <span>₹5,000</span>
                <span>₹10,000</span>
                <span>₹20,000</span>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={() => handleGenerate()}
              disabled={isLoading}
              className="w-full py-4 rounded-full text-sm font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Solving Knapsack SKUs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F4A28C]" />
                  <span>Generate Plan</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Dynamic Plan Output Card (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-[32px] border border-[#E4DED8] p-6 sm:p-8 shadow-editorial-card space-y-6">
            {isLoading ? (
              /* Realistic Loading Skeleton State */
              <div className="space-y-6 animate-pulse py-4">
                <div className="flex justify-between items-start pb-4 border-b border-[#E4DED8]">
                  <div className="space-y-2">
                    <div className="h-6 w-48 bg-[#F7F4F1] rounded-lg" />
                    <div className="h-4 w-72 bg-[#F7F4F1] rounded-lg" />
                  </div>
                  <div className="h-10 w-28 bg-[#F7F4F1] rounded-2xl" />
                </div>
                <div className="h-3 w-full bg-[#F7F4F1] rounded-full" />
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-2xl bg-[#F7F4F1] flex items-center justify-between"
                    >
                      <div className="space-y-2">
                        <div className="h-4 w-40 bg-white rounded" />
                        <div className="h-3 w-24 bg-white rounded" />
                      </div>
                      <div className="h-5 w-16 bg-white rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Render Active Plan */
              <>
                {/* Header: Title, Total Cost vs Budget */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E4DED8]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45]">
                        v{currentPlan.version} Approved
                      </span>
                      <span className="text-xs text-[#8B857F]">
                        {currentPlan.items.length} Curated Items
                      </span>
                    </div>
                    <h3 className="font-serif-headline text-3xl font-medium text-[#111111]">
                      {currentPlan.title}
                    </h3>
                  </div>

                  {/* Summary Metric */}
                  <div className="text-right bg-[#F7F4F1] px-4 py-2.5 rounded-2xl border border-[#E4DED8]">
                    <div className="text-xs text-[#8B857F]">Total Allocated</div>
                    <div className="font-serif-headline text-2xl font-bold text-[#111111]">
                      ₹{currentPlan.totalAmount.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-[#8B857F] ml-1">
                        / ₹{currentPlan.budget.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar (Green if under budget, Red if over) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#8B857F]">
                      Budget Consumption ({percentageUsed}%)
                    </span>
                    <span
                      className={`font-semibold ${
                        isUnderBudget ? "text-[#1F4D45]" : "text-red-600"
                      }`}
                    >
                      {isUnderBudget
                        ? `₹${currentPlan.remainingAmount.toLocaleString("en-IN")} remaining`
                        : "Budget Exceeded"}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#F7F4F1] overflow-hidden border border-[#E4DED8]/60">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isUnderBudget ? "bg-[#1F4D45]" : "bg-red-500"
                      }`}
                      style={{ width: `${percentageUsed}%` }}
                    />
                  </div>
                </div>

                {/* Out of Stock Notice Banner */}
                {currentPlan.outOfStockNotice && (
                  <div className="p-4 rounded-2xl bg-[#FFF8F3] border border-[#F4A28C]/60 text-[#111111] flex items-start gap-3 shadow-2xs">
                    <div className="w-8 h-8 rounded-xl bg-[#F4A28C]/20 text-[#D96B50] flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#111111]">
                        Inventory Status: {currentPlan.outOfStockNotice.itemName}
                      </div>
                      <div className="text-xs text-[#666666] leading-relaxed mt-1">
                        {currentPlan.outOfStockNotice.message}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty State when no items in plan */}
                {currentPlan.items.length === 0 && (
                  <div className="p-8 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] text-center text-[#8B857F] text-xs space-y-1">
                    <p className="font-medium text-[#111111]">No in-stock items allocated</p>
                    <p>Please check the notice above or try searching for another catalog category (e.g. notebooks, pens, bottles, power banks, snacks).</p>
                  </div>
                )}

                {/* Items List (Product Cards) */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {currentPlan.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] hover:border-[#F4A28C]/60 transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs text-xs font-semibold"
                            style={{ background: item.imagePlaceholder }}
                          >
                            <Package className="w-4 h-4 text-white/90" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-[#111111]">
                                {item.name}
                              </h4>
                              {item.badge && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#E4DED8] text-[#111111]">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#8B857F] mt-0.5">
                              <span>{item.category}</span>
                              <span>•</span>
                              <span>₹{item.unitPrice} each</span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Price */}
                        <div className="flex items-center gap-3 text-right">
                          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-[#E4DED8]">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, -1)}
                              className="text-[#8B857F] hover:text-[#111111] transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-[#111111] px-1">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, 1)}
                              className="text-[#8B857F] hover:text-[#111111] transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-sm font-bold text-[#111111] min-w-[60px] text-right">
                            ₹{item.totalPrice.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      {/* Expandable "Why this item?" rationale */}
                      <div>
                        <button
                          onClick={() => toggleRationale(item.id)}
                          className="flex items-center gap-1.5 text-xs text-[#1F4D45] hover:underline font-medium cursor-pointer"
                        >
                          <span>Why this item?</span>
                          {expandedRationales[item.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedRationales[item.id] && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-xs text-[#8B857F] pt-1.5 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-[#E4DED8]/60 mt-1"
                            >
                              {item.rationale}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Row */}
                <div className="pt-4 border-t border-[#E4DED8] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#8B857F]">
                    <ShieldCheck className="w-4 h-4 text-[#1F4D45]" />
                    <span>Plan Hash:</span>
                    <code className="text-[#111111] bg-[#F7F4F1] px-2 py-0.5 rounded border border-[#E4DED8]">
                      {currentPlan.planHash.slice(0, 10)}...{currentPlan.planHash.slice(-6)}
                    </code>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          try {
                            sessionStorage.setItem("intora_active_plan", JSON.stringify(currentPlan));
                          } catch (_) {}
                        }
                        onEditInFullPlanner?.(currentPlan);
                      }}
                      className="px-5 py-2.5 rounded-full text-xs font-semibold bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition shadow-xs cursor-pointer"
                    >
                      Edit in Full Planner
                    </button>
                    <button
                      onClick={() => onApproveAndRecord?.(currentPlan, currentPlan.planHash)}
                      disabled={currentPlan.items.length === 0}
                      className="px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#1F4D45] text-white hover:bg-[#163a34] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Plan & Record on Chain</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
