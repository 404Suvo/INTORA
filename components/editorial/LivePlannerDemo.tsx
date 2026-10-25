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
  ExternalLink,
  Scale,
} from "lucide-react";
import { PRESET_SITUATIONS, MOCK_PLANS, ShoppingPlanData, ProductItem } from "@/data/mockData";
import { generatePlan, hashPlan, optimizePlan, restorePlan, getDemoFallbackPlan } from "@/lib/stubs";
import { TradeOffComparisonModal } from "./TradeOffComparisonModal";
import { UserTradeOffPreference, ProductComparisonItem } from "@/lib/trade-off-engine";
import { X402PaymentModal } from "@/components/commerce/X402PaymentModal";

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
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [structuredError, setStructuredError] = useState<{
    message: string;
    errorCode?: string;
    isRetryable?: boolean;
    isTimeout?: boolean;
  } | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // x402 Protocol Deep Research State
  const [x402ModalOpen, setX402ModalOpen] = useState(false);
  const [x402ResearchQuery, setX402ResearchQuery] = useState("essential supplies");
  const [x402ResearchProduct, setX402ResearchProduct] = useState<string | undefined>(undefined);

  // Track elapsed seconds while searching to show progress
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (isLoading) {
      setLoadingElapsed(0);
      timer = setInterval(() => {
        setLoadingElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setLoadingElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

  // Abort any in-flight requests on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  const [currentPlan, setCurrentPlan] = useState<ShoppingPlanData>(
    MOCK_PLANS["college-fest"]
  );
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({
    "prod-bottle-01": true,
  });
  const [tradeOffItem, setTradeOffItem] = useState<ProductItem | null>(null);
  const [isTradeOffOpen, setIsTradeOffOpen] = useState(false);
  const [userPreference, setUserPreference] = useState<UserTradeOffPreference>("balanced");

  // Sync when externalPrompt or externalBudget changes from Hero prompt chips
  useEffect(() => {
    if (externalPrompt) {
      setSituationPrompt(externalPrompt);
      if (externalBudget) setBudget(externalBudget);
      handleGenerate(externalPrompt, externalBudget || budget, userPreference);
    }
  }, [externalPrompt, externalBudget]);

  const toggleRationale = (itemId: string) => {
    setExpandedRationales((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleGenerate = async (
    promptOverride?: string,
    budgetOverride?: number,
    preferenceOverride?: UserTradeOffPreference
  ) => {
    // Prevent duplicate submissions while a search is already running
    if (isLoading) return;

    // Abort previous in-flight request to prevent duplicate/race requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setApiError(null);
    setStructuredError(null);
    const p = promptOverride || situationPrompt;
    const b = budgetOverride !== undefined ? budgetOverride : budget;
    const pref = preferenceOverride || userPreference;

    if (typeof b !== "number" || isNaN(b) || b <= 0) {
      setApiError("A positive rupee 'budget' amount is required.");
      setIsLoading(false);
      return;
    }
    if (b < 100) {
      setApiError("Budget must be at least ₹100.");
      setIsLoading(false);
      return;
    }
    if (b > 200000) {
      setApiError("Budget cannot exceed ₹2,00,000 (2 lakh INR).");
      setIsLoading(false);
      return;
    }

    try {
      const generated = await generatePlan(p, b, { preference: pref, signal: controller.signal });
      const computedHash = await hashPlan(generated);
      setCurrentPlan({
        ...generated,
        planHash: computedHash,
        userPreference: pref,
      });
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        return; // User initiated a new request or unmounted
      }
      const errMsg = err?.userFriendlyMessage || err?.message || String(err);
      console.warn("[Live Planner Notice]", errMsg);
      const isTimeout =
        err?.errorCode === "PROVIDER_TIMEOUT" ||
        err?.statusCode === 504 ||
        errMsg.toLowerCase().includes("timed out") ||
        errMsg.toLowerCase().includes("taking too long") ||
        errMsg.includes("ETIMEDOUT");

      setApiError(errMsg);
      setStructuredError({
        message: isTimeout ? "Live product search is taking too long. Please retry." : errMsg,
        errorCode: err?.errorCode || (isTimeout ? "PROVIDER_TIMEOUT" : undefined),
        isRetryable: err?.isRetryable ?? (isTimeout || err?.statusCode === 429),
        isTimeout,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemoPlan = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    const demo = getDemoFallbackPlan(situationPrompt, budget, userPreference);
    const computedHash = await hashPlan(demo);
    setCurrentPlan({
      ...demo,
      planHash: computedHash,
    });
    setApiError(null);
    setStructuredError(null);
  };

  const handlePreferenceChange = (newPref: UserTradeOffPreference) => {
    if (isLoading) return;
    setUserPreference(newPref);
    handleGenerate(situationPrompt, budget, newPref);
  };

  const handleSwitchAlternative = async (alt: ProductComparisonItem) => {
    if (!tradeOffItem) return;

    const updatedItems = currentPlan.items.map((item) => {
      if (item.id === tradeOffItem.id) {
        return {
          ...item,
          id: alt.productId,
          asin: alt.asin || alt.productId,
          name: alt.name,
          unitPrice: alt.cost.unitPrice,
          totalPrice: alt.cost.unitPrice * item.quantity,
          subtotal: alt.cost.unitPrice * item.quantity,
          estimatedTotalCost: alt.cost.estimatedTotalCost,
          costBreakdown: alt.cost,
          rating: alt.rating || item.rating,
          totalReviews: alt.reviewCount || item.totalReviews,
          url: alt.productUrl || item.url,
          merchant: alt.merchant,
          shippingCost: alt.cost.shippingCost,
          taxes: alt.cost.taxes,
          discounts: alt.cost.discounts,
          specifications: alt.specifications,
          features: alt.features,
          rationale: alt.selectionReason || `Alternative product selected with ${userPreference} priority.`,
          optimizationNote: `Manually switched to alternative: ${alt.name}`,
        };
      }
      return item;
    });

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
    setTradeOffItem(null);
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

  const handleTogglePriority = async (itemId: string) => {
    const updatedItems = currentPlan.items.map((item) => {
      if (item.id === itemId) {
        const nextEssential = !item.essential;
        return {
          ...item,
          essential: nextEssential,
          optional: !nextEssential,
          priority: nextEssential ? 1 : 2,
        };
      }
      return item;
    });

    const updatedPlan: ShoppingPlanData = {
      ...currentPlan,
      items: updatedItems,
    };

    // If budget is exceeded or plan has active optimization, re-optimize respecting manual priority override
    if (updatedPlan.totalAmount > updatedPlan.budget || currentPlan.changes?.length) {
      setIsLoading(true);
      try {
        const optimized = await optimizePlan(updatedPlan, currentPlan.budget, {
          userConstraints: {
            priorityOverrides: {
              [itemId]: {
                essential: updatedItems.find((i) => i.id === itemId)?.essential,
                optional: updatedItems.find((i) => i.id === itemId)?.optional,
              },
            },
          },
        });
        const newHash = await hashPlan(optimized);
        optimized.planHash = newHash;
        setCurrentPlan(optimized);
      } catch (err: any) {
        setApiError(err.message || String(err));
      } finally {
        setIsLoading(false);
      }
    } else {
      const newHash = await hashPlan(updatedPlan);
      updatedPlan.planHash = newHash;
      setCurrentPlan(updatedPlan);
    }
  };

  const handleOptimizeBudget = async () => {
    if (budget > 200000) {
      setApiError("Budget cannot exceed ₹2,00,000 (2 lakh INR).");
      return;
    }
    if (budget < 100) {
      setApiError("Budget must be at least ₹100.");
      return;
    }
    setIsLoading(true);
    setApiError(null);
    try {
      const optimized = await optimizePlan(currentPlan, budget);
      const newHash = await hashPlan(optimized);
      optimized.planHash = newHash;
      setCurrentPlan(optimized);
    } catch (err: any) {
      setApiError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreOriginal = async () => {
    if (!currentPlan.originalPlan) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const restored = await restorePlan(currentPlan);
      const newHash = await hashPlan(restored);
      restored.planHash = newHash;
      setCurrentPlan(restored);
    } catch (err: any) {
      setApiError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
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

            {/* Budget Slider & Input */}
            <div className="pt-4 border-t border-[#E4DED8] space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                  2. Budget Cap (Indian Rupees)
                </label>
                <div className="flex items-center gap-1.5 bg-[#F7F4F1] border border-[#E4DED8] rounded-lg px-2.5 py-1">
                  <span className="text-sm font-semibold text-[#8B857F]">₹</span>
                  <input
                    type="number"
                    min="100"
                    max="200000"
                    step="500"
                    value={budget || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBudget(val);
                    }}
                    className="w-28 text-right font-serif-headline text-xl font-bold text-[#111111] bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <input
                type="range"
                min="500"
                max="200000"
                step="500"
                value={Math.min(200000, Math.max(500, budget || 500))}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-[#111111] cursor-pointer"
              />

              {/* Ticks */}
              <div className="flex justify-between text-[11px] font-mono text-[#8B857F]">
                <span>₹500</span>
                <span>₹50,000</span>
                <span>₹1,00,000</span>
                <span>₹1,50,000</span>
                <span>₹2,00,000</span>
              </div>
              {budget > 200000 && (
                <p className="text-xs text-red-600 font-medium">
                  Budget cannot exceed ₹2,00,000 (2 lakh INR).
                </p>
              )}
              {budget < 100 && budget > 0 && (
                <p className="text-xs text-red-600 font-medium">
                  Budget must be at least ₹100.
                </p>
              )}
            </div>

            {/* Trade-Off Priority Selector */}
            <div className="pt-4 border-t border-[#E4DED8] space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                3. Trade-Off Optimization Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "balanced", label: "Balanced Value" },
                  { id: "lowest_cost", label: "Lowest Total Cost" },
                  { id: "quality", label: "Quality & Evidence" },
                  { id: "features", label: "Feature-Rich" },
                ].map((pref) => (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => handlePreferenceChange(pref.id as UserTradeOffPreference)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      userPreference === pref.id
                        ? "bg-[#111111] text-white border-[#111111] shadow-2xs"
                        : "bg-[#F7F4F1] text-[#8B857F] border-[#E4DED8] hover:text-[#111111] hover:bg-white"
                    }`}
                  >
                    {pref.label}
                  </button>
                ))}
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
                  <span>Searching Amazon India ({loadingElapsed}s)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F4A28C]" />
                  <span>Generate Plan</span>
                </>
              )}
            </button>
            {isLoading && (
              <div className="text-[11px] text-zinc-500 text-center animate-pulse pt-1">
                {loadingElapsed < 8
                  ? "Extracting intent & querying Amazon India live catalog..."
                  : loadingElapsed < 20
                  ? "Retrieving live ASIN pricing, ratings, and stock status..."
                  : "Finalizing knapsack optimization & verifying constraints..."}
              </div>
            )}
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
                {/* Demo Fallback Disclaimer Banner */}
                {currentPlan.isDemoFallback && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-wrap items-start justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-amber-950">
                          Sample Demo Plan (Offline Mode)
                        </div>
                        <div className="text-xs text-amber-800 leading-relaxed mt-0.5">
                          {currentPlan.demoDisclaimer ||
                            "Sample demonstration plan using pre-saved catalog items. Live Amazon India prices were NOT verified in real-time."}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerate()}
                      disabled={isLoading}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-200 text-amber-950 hover:bg-amber-300 transition cursor-pointer"
                    >
                      Try Live Search
                    </button>
                  </div>
                )}

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

                {/* API Error Notice Banner with Retry and Demo Fallback */}
                {apiError && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-xs text-red-950">
                          {structuredError?.isTimeout
                            ? "Live Product Search Timeout (ScraperAPI)"
                            : "ScraperAPI Live Request Error"}
                        </div>
                        <div className="text-xs text-red-700 leading-relaxed mt-1 font-mono">
                          {structuredError?.message || apiError}
                        </div>
                        <div className="text-[11px] text-red-600 mt-1">
                          Per Intora integrity rules, mock products are never silently substituted on failure.
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-200/60">
                      <button
                        type="button"
                        onClick={() => handleGenerate()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Search</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadDemoPlan}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-900 text-xs font-semibold hover:bg-red-100/50 transition cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-amber-600" />
                        <span>Load Sample Demo Plan</span>
                      </button>
                    </div>
                  </div>
                )}

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
                {currentPlan.items.length === 0 && !apiError && (
                  <div className="p-8 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] text-center text-[#8B857F] text-xs space-y-1">
                    <p className="font-medium text-[#111111]">No in-stock items allocated</p>
                    <p>Please check the notice above or try searching for another catalog category (e.g. notebooks, pens, bottles, power banks, snacks).</p>
                  </div>
                )}

                {/* Intelligent Budget Optimization Notice / Changes Banner */}
                {currentPlan.changes && currentPlan.changes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#E8F3EE] border border-[#1F4D45]/30 text-[#111111] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#1F4D45]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#1F4D45]">
                          Intelligent Budget Optimization Applied
                        </span>
                      </div>
                      {currentPlan.totalSavings ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1F4D45] text-white">
                          Saved ₹{currentPlan.totalSavings.toLocaleString("en-IN")}
                        </span>
                      ) : null}
                    </div>
                    {currentPlan.optimizationSummary && (
                      <p className="text-xs text-[#2A433D] leading-relaxed">
                        {currentPlan.optimizationSummary}
                      </p>
                    )}
                    <div className="space-y-1.5 pt-1">
                      {currentPlan.changes.map((change, cIdx) => (
                        <div
                          key={cIdx}
                          className="text-[11px] text-[#2A433D]/90 bg-white/70 p-2 rounded-xl border border-[#1F4D45]/15 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <span className="font-semibold">{change.itemName}: </span>
                            <span>{change.reason}</span>
                            {change.tradeOff && (
                              <div className="text-[10px] text-[#8B857F] italic">
                                Trade-off: {change.tradeOff}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 font-bold text-[#1F4D45]">
                            +₹{change.savings.toLocaleString("en-IN")} saved
                          </span>
                        </div>
                      ))}
                    </div>
                    {currentPlan.originalPlan && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={handleRestoreOriginal}
                          className="text-[11px] font-semibold text-[#1F4D45] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore Original Plan</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Infeasibility / Budget Overrun Alert */}
                {(!isUnderBudget || currentPlan.feasible === false) && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-2 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <div className="font-semibold text-xs text-amber-900">
                          {currentPlan.feasible === false
                            ? "Plan Infeasible with Current Requirements"
                            : "Shopping Plan Exceeds Budget"}
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          {currentPlan.optimizationResult?.infeasibilityReason ||
                            `Current total (₹${currentPlan.totalAmount.toLocaleString("en-IN")}) exceeds your ₹${currentPlan.budget.toLocaleString("en-IN")} budget by ₹${(currentPlan.totalAmount - currentPlan.budget).toLocaleString("en-IN")}.`}
                        </p>
                        {currentPlan.optimizationResult?.suggestedCompromises && (
                          <div className="pt-1 space-y-1 text-[11px] text-amber-900">
                            <span className="font-semibold">Suggested Options:</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                              {currentPlan.optimizationResult.suggestedCompromises.map((s, sIdx) => (
                                <li key={sIdx}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={handleOptimizeBudget}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#111111] text-white hover:bg-black transition cursor-pointer flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-[#F4A28C]" />
                        <span>Run Budget Optimizer</span>
                      </button>
                    </div>
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
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center bg-white border border-[#E4DED8] shrink-0 shadow-2xs overflow-hidden"
                            style={{ background: item.imagePlaceholder?.startsWith("http") ? "#ffffff" : item.imagePlaceholder }}
                          >
                            {item.imagePlaceholder?.startsWith("http") ? (
                              <img
                                src={item.imagePlaceholder}
                                alt={item.name}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-[#8B857F]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-medium text-[#111111] line-clamp-1">
                                {item.name}
                              </h4>
                              {/* Item Priority Toggle Badge */}
                              <button
                                type="button"
                                onClick={() => handleTogglePriority(item.id)}
                                title="Click to toggle Essential vs Optional"
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                                  item.essential
                                    ? "bg-[#1F4D45]/10 text-[#1F4D45] border-[#1F4D45]/30 hover:bg-[#1F4D45]/20"
                                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${item.essential ? "bg-[#1F4D45]" : "bg-amber-500"}`} />
                                <span>{item.essential ? "Essential" : "Optional"}</span>
                                <span className="opacity-60 text-[9px]">(P{item.priority || (item.essential ? 1 : 2)})</span>
                              </button>
                              {item.badge && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#E4DED8] text-[#111111] shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B857F] mt-0.5">
                              <span>{item.category}</span>
                              <span>•</span>
                              <span>₹{item.unitPrice} each</span>
                              {item.estimatedTotalCost && item.estimatedTotalCost !== item.totalPrice && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-[#1F4D45]">
                                    Est. Total: ₹{item.estimatedTotalCost.toLocaleString("en-IN")}
                                  </span>
                                </>
                              )}
                              {item.rating && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-700 font-medium">
                                    ★ {item.rating} {item.totalReviews ? `(${item.totalReviews})` : ""}
                                  </span>
                                </>
                              )}
                              {item.url && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#1F4D45] hover:underline font-semibold"
                                  >
                                    <span>Amazon.in</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Price */}
                        <div className="flex items-center gap-3 text-right shrink-0">
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

                      {/* Expandable "Why this item?" rationale & Trade-Offs Button */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-3">
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

                          {/* Trade-Offs & Alternatives Inspector Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setTradeOffItem(item);
                              setIsTradeOffOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F4D45] hover:text-black bg-[#E8F3EE] hover:bg-[#d8ece2] px-2.5 py-0.5 rounded-full border border-[#1F4D45]/30 transition cursor-pointer"
                          >
                            <Scale className="w-3 h-3" />
                            <span>Trade-Offs & Alts</span>
                          </button>
                        </div>

                        {item.retrievedAt && (
                          <span className="text-[10px] text-[#8B857F] font-mono">
                            Retrieved: {new Date(item.retrievedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>

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
                  ))}
                </div>

                {/* ScraperAPI Live Data Disclaimer */}
                <div className="text-[11px] text-[#8B857F] bg-[#F7F4F1] p-3 rounded-xl border border-[#E4DED8]/60 leading-relaxed">
                  <strong>Notice:</strong> Real product search and pricing retrieved live from Amazon India via ScraperAPI structured data endpoints. Prices are subject to dynamic changes on Amazon.in and are not guaranteed at checkout.
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
                      type="button"
                      onClick={() => {
                        setX402ResearchQuery(situationPrompt || currentPlan.items[0]?.name || "essential supplies");
                        setX402ResearchProduct(currentPlan.items[0]?.name);
                        setX402ModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/30 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      title="Run paid market research and counterfeit check via x402 on Base Sepolia"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Deep Research (x402)</span>
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

      {tradeOffItem && (
        <TradeOffComparisonModal
          isOpen={isTradeOffOpen}
          onClose={() => {
            setIsTradeOffOpen(false);
            setTradeOffItem(null);
          }}
          currentItem={tradeOffItem}
          tradeOffData={tradeOffItem.tradeOffComparison}
          currentPreference={userPreference}
          onPreferenceChange={handlePreferenceChange}
          onSelectAlternative={handleSwitchAlternative}
        />
      )}

      <X402PaymentModal
        isOpen={x402ModalOpen}
        onClose={() => setX402ModalOpen(false)}
        defaultQuery={x402ResearchQuery}
        productName={x402ResearchProduct}
      />
    </section>
  );
}
