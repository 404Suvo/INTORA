"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Plus,
  Minus,
  Sliders,
  Package,
  RotateCcw,
  Copy,
  CheckCheck,
  Wallet,
  PlusCircle,
  AlertCircle,
  ExternalLink,
  Zap,
  Scale,
} from "lucide-react";
import { MOCK_PLANS, ShoppingPlanData, ProductItem, PRESET_SITUATIONS } from "@/data/mockData";
import { generatePlan, hashPlan, connectWallet, optimizePlan, restorePlan, getDemoFallbackPlan, simulateWhatIfScenario } from "@/lib/stubs";
import { TransactionApprovalModal } from "@/components/editorial/TransactionApprovalModal";
import { AddProductModal } from "@/components/catalog/AddProductModal";
import { TradeOffComparisonModal } from "@/components/editorial/TradeOffComparisonModal";
import { UserTradeOffPreference, ProductComparisonItem } from "@/lib/trade-off-engine";
import { getProductById } from "@/lib/catalog";
import { WhatIfSimulatorPanel } from "@/components/what-if/WhatIfSimulatorPanel";
import { ScenarioTimeline } from "@/components/what-if/ScenarioTimeline";
import { VersionComparisonModal } from "@/components/what-if/VersionComparisonModal";
import { PlanVersionRecord, PlanComparisonResult } from "@/lib/what-if/types";

export default function FullPlannerPage() {
  const [currentPlan, setCurrentPlan] = useState<ShoppingPlanData>(
    MOCK_PLANS["college-fest"]
  );
  const [situationPrompt, setSituationPrompt] = useState(
    currentPlan.situation
  );
  const [budget, setBudget] = useState(currentPlan.budget);
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

  // Clean up any pending in-flight request when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [tradeOffItem, setTradeOffItem] = useState<ProductItem | null>(null);
  const [isTradeOffOpen, setIsTradeOffOpen] = useState(false);
  const [userPreference, setUserPreference] = useState<UserTradeOffPreference>("balanced");
  const [copiedHash, setCopiedHash] = useState(false);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);

  // What-if Simulator and Version History state
  const [versionHistory, setVersionHistory] = useState<PlanVersionRecord[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [ambiguityPrompt, setAmbiguityPrompt] = useState<string | null>(null);
  const [latestDiff, setLatestDiff] = useState<PlanComparisonResult | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonFromVersion, setComparisonFromVersion] = useState<number | undefined>();
  const [comparisonToVersion, setComparisonToVersion] = useState<number | undefined>();
  const [planForCommitment, setPlanForCommitment] = useState<ShoppingPlanData | null>(null);
  const [lastScenarioPrompt, setLastScenarioPrompt] = useState<string>("");

  // Load customized plan from Landing Page if user navigated via "Edit in Full Planner"
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("intora_active_plan");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.items && parsed.budget) {
            setCurrentPlan(parsed);
            setSituationPrompt(parsed.situation || parsed.title);
            setBudget(parsed.budget);
          }
        }
      } catch (err) {
        console.warn("Could not load stored plan:", err);
      }
    }
  }, []);

  // Sync and persist version history across refreshes
  useEffect(() => {
    if (typeof window !== "undefined" && currentPlan) {
      try {
        const storedVersionsRaw = localStorage.getItem(`intora_versions_${currentPlan.id}`);
        if (storedVersionsRaw) {
          const parsed = JSON.parse(storedVersionsRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVersionHistory(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not load local version history:", e);
      }

      // If no stored history, bootstrap v1 from currentPlan
      setVersionHistory((prev) => {
        if (prev.length > 0 && prev.some((v) => v.version === currentPlan.version)) return prev;
        const v1Record: PlanVersionRecord = {
          intentId: currentPlan.id,
          version: currentPlan.version || 1,
          parentVersion: null,
          scenarioDescription: currentPlan.situation || "Initial Shopping Plan",
          plan: currentPlan,
          shoppingPlan: {
            schemaVersion: "1.0.0",
            intentId: currentPlan.id as any,
            version: currentPlan.version || 1,
            currency: "INR",
            budgetMinor: Math.round(currentPlan.budget * 100),
            items: currentPlan.items.map((i) => ({
              productId: i.id,
              quantity: i.quantity,
              unitPriceMinor: Math.round(i.unitPrice * 100),
            })),
            totalMinor: Math.round(currentPlan.totalAmount * 100),
            expiry: Math.floor(Date.now() / 1000) + 7 * 86400,
          },
          planHash: currentPlan.planHash,
          canonicalString: "",
          createdAt: new Date().toISOString(),
          budget: currentPlan.budget,
          totalAmount: currentPlan.totalAmount,
          remainingAmount: currentPlan.remainingAmount,
          budgetOverrun: currentPlan.budgetOverrun || 0,
          peopleCount: 1,
          durationDays: 3,
          summaryOfChanges: "Initial baseline plan created.",
          reasonsForChanges: [],
          onChainCommitment: { status: "uncommitted" },
        };
        const initial = [v1Record];
        try {
          localStorage.setItem(`intora_versions_${currentPlan.id}`, JSON.stringify(initial));
        } catch {}
        return initial;
      });
    }
  }, [currentPlan.id]);

  const handleSimulateWhatIf = async (promptToSimulate: string) => {
    setIsSimulating(true);
    setSimulationError(null);
    setAmbiguityPrompt(null);
    setLastScenarioPrompt(promptToSimulate);

    try {
      const result = await simulateWhatIfScenario(currentPlan, promptToSimulate, {
        preference: userPreference,
      });

      if (result.ambiguityQuestion) {
        setAmbiguityPrompt(result.ambiguityQuestion);
        return;
      }

      if (result.plan && result.versionRecord) {
        const newPlan = result.plan;
        const newRecord = result.versionRecord;

        setCurrentPlan(newPlan);
        setBudget(newPlan.budget);
        if (newPlan.situation) setSituationPrompt(newPlan.situation);
        setLatestDiff(result.diff);

        setVersionHistory((prev) => {
          const updated = [...prev.filter((v) => v.version !== newRecord.version), newRecord];
          updated.sort((a, b) => a.version - b.version);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`intora_versions_${newPlan.id}`, JSON.stringify(updated));
              sessionStorage.setItem("intora_active_plan", JSON.stringify(newPlan));
            } catch {}
          }
          return updated;
        });
      }
    } catch (err: any) {
      console.error("Simulation failure:", err);
      setSimulationError(err?.message || "Failed to recalculate what-if scenario.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleAnswerAmbiguity = (clarification: string) => {
    const combined = `${lastScenarioPrompt} (Specifically: ${clarification})`;
    handleSimulateWhatIf(combined);
  };

  const handleSelectVersion = (record: PlanVersionRecord) => {
    setCurrentPlan(record.plan);
    setBudget(record.plan.budget);
    setSituationPrompt(record.plan.situation || record.scenarioDescription);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("intora_active_plan", JSON.stringify(record.plan));
      } catch {}
    }
  };

  const handleCompareVersions = (vA: PlanVersionRecord, vB: PlanVersionRecord) => {
    setComparisonFromVersion(Math.min(vA.version, vB.version));
    setComparisonToVersion(Math.max(vA.version, vB.version));
    setIsComparisonOpen(true);
  };

  const handleSimulateFromVersion = (record: PlanVersionRecord) => {
    handleSelectVersion(record);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRecordVersionOnChain = (record: PlanVersionRecord) => {
    setPlanForCommitment(record.plan);
    setIsModalOpen(true);
  };

  const handleConnectWallet = async () => {
    try {
      const { address } = await connectWallet();
      setWalletAccount(address);
    } catch (err: any) {
      console.warn("Wallet connect error:", err.message);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAccount(null);
  };

  const handleGenerate = async (prefOverride?: UserTradeOffPreference) => {
    // Prevent duplicate submissions while a search is already running
    if (isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setApiError(null);
    setStructuredError(null);
    const pref = prefOverride || userPreference;

    if (typeof budget !== "number" || isNaN(budget) || budget <= 0) {
      setApiError("A positive rupee 'budget' amount is required.");
      setIsLoading(false);
      return;
    }
    if (budget < 100) {
      setApiError("Budget must be at least ₹100.");
      setIsLoading(false);
      return;
    }
    if (budget > 200000) {
      setApiError("Budget cannot exceed ₹2,00,000 (2 lakh INR).");
      setIsLoading(false);
      return;
    }

    try {
      const generated = await generatePlan(situationPrompt, budget, {
        preference: pref,
        signal: controller.signal,
      });
      const computedHash = await hashPlan(generated);
      setCurrentPlan({
        ...generated,
        planHash: computedHash,
        userPreference: pref,
      });
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      const errMsg = err?.userFriendlyMessage || err?.message || String(err);
      console.warn("[Full Planner Notice]", errMsg);
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
    handleGenerate(newPref);
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
    const updated = currentPlan.items.map((i) => {
      if (i.id === itemId) {
        const qty = Math.max(1, i.quantity + delta);
        return {
          ...i,
          quantity: qty,
          totalPrice: i.unitPrice * qty,
        };
      }
      return i;
    });

    const total = updated.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const remaining = Math.max(0, currentPlan.budget - total);

    const updatedPlan: ShoppingPlanData = {
      ...currentPlan,
      items: updated,
      totalAmount: total,
      remainingAmount: remaining,
      validation: {
        ...currentPlan.validation,
        budgetCompliant: total <= currentPlan.budget,
      },
    };

    const newHash = await hashPlan(updatedPlan);
    updatedPlan.planHash = newHash;
    setCurrentPlan(updatedPlan);
  };

  const handleRemoveItem = async (itemId: string) => {
    const updated = currentPlan.items.filter((i) => i.id !== itemId);
    const total = updated.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const remaining = Math.max(0, currentPlan.budget - total);

    const updatedPlan: ShoppingPlanData = {
      ...currentPlan,
      items: updated,
      totalAmount: total,
      remainingAmount: remaining,
      validation: {
        ...currentPlan.validation,
        budgetCompliant: total <= currentPlan.budget,
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

  const handleAddProduct = async (productId: string) => {
    const catalogItem = getProductById(productId);
    if (!catalogItem) return;

    const existingIndex = currentPlan.items.findIndex((i) => i.id === productId);
    let updatedItems: ProductItem[];

    if (existingIndex >= 0) {
      updatedItems = currentPlan.items.map((item, idx) => {
        if (idx === existingIndex) {
          const qty = item.quantity + 1;
          return { ...item, quantity: qty, totalPrice: item.unitPrice * qty };
        }
        return item;
      });
    } else {
      const unitPriceInr = Math.round(catalogItem.priceMinor / 100);
      const newItem: ProductItem = {
        id: catalogItem.id,
        asin: catalogItem.asin || catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        quantity: 1,
        unitPrice: unitPriceInr,
        totalPrice: unitPriceInr,
        rationale: catalogItem.description,
        inStock: catalogItem.inStock,
        imagePlaceholder: catalogItem.imageUrl || "linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)",
        badge: catalogItem.source === "scraperapi" ? "Amazon India" : "Added SKU",
        url: catalogItem.url,
        imageUrl: catalogItem.imageUrl,
        rating: catalogItem.rating,
        totalReviews: catalogItem.totalReviews,
        retrievedAt: catalogItem.retrievedAt,
        source: catalogItem.source,
      };
      updatedItems = [...currentPlan.items, newItem];
    }

    const total = updatedItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const remaining = Math.max(0, currentPlan.budget - total);

    const updatedPlan: ShoppingPlanData = {
      ...currentPlan,
      items: updatedItems,
      totalAmount: total,
      remainingAmount: remaining,
      validation: {
        ...currentPlan.validation,
        budgetCompliant: total <= currentPlan.budget,
      },
    };

    const newHash = await hashPlan(updatedPlan);
    updatedPlan.planHash = newHash;
    setCurrentPlan(updatedPlan);
  };

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(currentPlan.planHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const isUnderBudget = currentPlan.totalAmount <= currentPlan.budget;
  const percentage = Math.min(
    100,
    Math.round((currentPlan.totalAmount / currentPlan.budget) * 100)
  );

  return (
    <div className="min-h-screen bg-[#EEE9E4] text-[#111111] font-editorial-sans pattern-dots">
      {/* Top Banner / Header */}
      <header className="sticky top-0 z-40 bg-[#EEE9E4]/90 backdrop-blur-md border-b border-[#E4DED8] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E4DED8] text-xs font-semibold text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <img
                src="/intora-logo.png"
                alt="Intora Logo"
                className="w-9 h-9 rounded-xl object-cover border border-[#E4DED8]"
              />
              <h1 className="font-serif-headline text-2xl font-medium text-[#111111]">
                Intora Planning Workspace
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45]">
                v{currentPlan.version} Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {walletAccount ? (
              <button
                onClick={handleDisconnectWallet}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-mono bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                title="Click to disconnect"
              >
                <span className="w-2 h-2 rounded-full bg-[#1F4D45]" />
                <span>{walletAccount.slice(0, 6)}...{walletAccount.slice(-4)}</span>
              </button>
            ) : (
              <button
                onClick={handleConnectWallet}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition shadow-xs cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5 text-[#8B857F]" />
                <span>Connect Wallet</span>
              </button>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#1F4D45] text-white hover:bg-[#163a34] transition shadow-md cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Record on Base Sepolia</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Controls (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-[32px] border border-[#E4DED8] p-6 shadow-editorial-card space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8B857F] mb-2">
                Situation Prompt
              </label>
              <textarea
                value={situationPrompt}
                onChange={(e) => setSituationPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] p-3.5 text-xs text-[#111111] focus:outline-none focus:border-[#F4A28C] leading-relaxed resize-none"
              />
            </div>

            {/* Budget Slider & Input */}
            <div className="space-y-3 pt-3 border-t border-[#E4DED8]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#8B857F]">
                  Budget Cap
                </span>
                <div className="flex items-center gap-1.5 bg-[#F7F4F1] border border-[#E4DED8] rounded-lg px-2.5 py-1">
                  <span className="text-sm font-semibold text-[#8B857F]">₹</span>
                  <input
                    type="number"
                    min="100"
                    max="200000"
                    step="500"
                    value={budget || ""}
                    onChange={(e) => setBudget(Number(e.target.value))}
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
              <div className="flex justify-between text-[10px] font-mono text-[#8B857F]">
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

            {/* Presets */}
            <div className="space-y-2 pt-3 border-t border-[#E4DED8]">
              <div className="text-[11px] font-medium text-[#8B857F]">
                Load Scenario Preset:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SITUATIONS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSituationPrompt(p.prompt);
                      setBudget(p.defaultBudget);
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-[#F7F4F1] border border-[#E4DED8] text-[#111111] hover:bg-[#E4DED8] transition cursor-pointer"
                  >
                    {p.chipLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade-Off Priority Selector */}
            <div className="pt-3 border-t border-[#E4DED8] space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                Optimization Priority
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

            <button
              onClick={() => handleGenerate()}
              disabled={isLoading}
              className="w-full py-3.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Searching Amazon India ({loadingElapsed}s)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F4A28C]" />
                  <span>Re-run Optimization</span>
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

          {/* Right Product Workspace (8 Cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Dedicated What-if Shopping Simulator */}
            <WhatIfSimulatorPanel
              currentPlan={currentPlan}
              isLoading={isSimulating}
              onSimulate={handleSimulateWhatIf}
              ambiguityPrompt={ambiguityPrompt}
              onAnswerAmbiguity={handleAnswerAmbiguity}
              apiError={simulationError}
              onRetry={() => lastScenarioPrompt && handleSimulateWhatIf(lastScenarioPrompt)}
              onOpenComparison={() => setIsComparisonOpen(true)}
              latestDiff={latestDiff}
            />

            {/* Product Workspace Card */}
            <div className="bg-white rounded-[32px] border border-[#E4DED8] p-6 sm:p-8 shadow-editorial-card space-y-6">
            {/* Demo Fallback Disclaimer Banner */}
            {currentPlan.isDemoFallback && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-wrap items-start justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-amber-950">
                      Sample Offline Demo Plan
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

            {/* Header / Summary */}
            <div className="flex flex-wrap items-center justify-between pb-6 border-b border-[#E4DED8] gap-4">
              <div>
                <h2 className="font-serif-headline text-3xl font-medium text-[#111111]">
                  {currentPlan.title}
                </h2>
                <p className="text-xs text-[#8B857F] mt-1">
                  {currentPlan.items.length} Catalog-Grounded Items Curated
                </p>
              </div>

              <div className="bg-[#F7F4F1] px-5 py-2.5 rounded-2xl border border-[#E4DED8] text-right">
                <div className="text-xs text-[#8B857F]">Total Allocated</div>
                <div className="font-serif-headline text-2xl font-bold text-[#111111]">
                  ₹{currentPlan.totalAmount.toLocaleString("en-IN")}{" "}
                  <span className="text-xs font-normal text-[#8B857F]">
                    / ₹{currentPlan.budget.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Budget Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8B857F]">
                  Budget Utilized ({percentage}%)
                </span>
                <span
                  className={`font-semibold ${
                    isUnderBudget ? "text-[#1F4D45]" : "text-red-600"
                  }`}
                >
                  {isUnderBudget
                    ? `₹${currentPlan.remainingAmount.toLocaleString("en-IN")} remaining`
                    : "Over budget limit"}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F7F4F1] overflow-hidden border border-[#E4DED8]/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isUnderBudget ? "bg-[#1F4D45]" : "bg-red-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* API Error Alert Banner */}
            {apiError && (
              <div className="p-4 sm:p-5 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-xs text-red-950">
                      {structuredError?.isTimeout
                        ? "Live Product Search Timeout (ScraperAPI)"
                        : "Live Plan Optimization Notice"}
                    </div>
                    <div className="text-xs text-red-800 leading-relaxed mt-1 font-mono">
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
                    Inventory Notice: {currentPlan.outOfStockNotice.itemName}
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
                <p>Please check the notice above or add products from the catalog or re-run optimization.</p>
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

            {/* Items Header & Add Product Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                Curated Bundle Items ({currentPlan.items.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111] hover:bg-[#E4DED8] transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#1F4D45]" />
                <span>Add Product from Catalog</span>
              </button>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              {currentPlan.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center bg-white border border-[#E4DED8] shrink-0 shadow-2xs overflow-hidden"
                      style={{
                        background:
                          item.imageUrl || item.imagePlaceholder?.startsWith("http")
                            ? "#ffffff"
                            : item.imagePlaceholder,
                      }}
                    >
                      {item.imageUrl || item.imagePlaceholder?.startsWith("http") ? (
                        <img
                          src={item.imageUrl || item.imagePlaceholder}
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
                        <button
                          type="button"
                          onClick={() => {
                            setTradeOffItem(item);
                            setIsTradeOffOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F4D45] hover:text-black bg-[#E8F3EE] hover:bg-[#d8ece2] px-2.5 py-0.5 rounded-full border border-[#1F4D45]/30 transition cursor-pointer ml-1"
                        >
                          <Scale className="w-3 h-3" />
                          <span>Trade-Offs & Alts</span>
                        </button>
                        {item.retrievedAt && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-[#8B857F] font-mono">
                              Retrieved: {new Date(item.retrievedAt).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-[#E4DED8]">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="text-[#8B857F] hover:text-[#111111] p-1 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-[#111111] px-1.5">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="text-[#8B857F] hover:text-[#111111] p-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-sm font-bold text-[#111111] min-w-[70px] text-right">
                      ₹{item.totalPrice.toLocaleString("en-IN")}
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-[#8B857F] hover:text-red-600 p-1.5 transition cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ScraperAPI Live Data Disclaimer */}
            <div className="text-[11px] text-[#8B857F] bg-[#F7F4F1] p-3 rounded-xl border border-[#E4DED8]/60 leading-relaxed">
              <strong>Notice:</strong> Real product search and pricing retrieved live from Amazon India via ScraperAPI structured data endpoints. Prices are subject to dynamic changes on Amazon.in and are not guaranteed at checkout.
            </div>

            {/* Bottom Proof Bar */}
            <div className="pt-4 border-t border-[#E4DED8] flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1F4D45]" />
                <span className="font-mono text-[#8B857F]">Plan Fingerprint:</span>
                <code className="text-[#111111] bg-[#F7F4F1] px-2 py-1 rounded border border-[#E4DED8] font-mono">
                  {currentPlan.planHash.slice(0, 14)}...{currentPlan.planHash.slice(-8)}
                </code>
                <button
                  onClick={handleCopyHash}
                  className="text-[#8B857F] hover:text-[#111111] transition ml-1 cursor-pointer"
                >
                  {copiedHash ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[#1F4D45]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#1F4D45] text-white hover:bg-[#163a34] transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Record on Chain</span>
              </button>
            </div>
          </div>

          {/* Scenario Version History Timeline */}
          <ScenarioTimeline
            versions={versionHistory}
            activeVersionNumber={currentPlan.version || 1}
            onSelectVersion={handleSelectVersion}
            onCompareVersions={handleCompareVersions}
            onSimulateFromVersion={handleSimulateFromVersion}
            onRecordOnChain={handleRecordVersionOnChain}
          />
        </div>
      </div>
    </main>

      {/* Add Product from Catalog Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onAddProduct={handleAddProduct}
        existingProductIds={currentPlan.items.map((i) => i.id)}
      />

      {/* Transaction Approval Modal */}
      <TransactionApprovalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPlanForCommitment(null);
        }}
        plan={planForCommitment || currentPlan}
        planHash={(planForCommitment || currentPlan).planHash}
        walletAccount={walletAccount}
        onWalletConnected={(account) => setWalletAccount(account)}
        onSuccess={(tx, block) => {
          const committedPlan = planForCommitment || currentPlan;
          console.log("Committed:", tx, block, "for version:", committedPlan.version);
          setVersionHistory((prev) => {
            const updated = prev.map((v) =>
              v.version === committedPlan.version
                ? {
                    ...v,
                    onChainCommitment: {
                      txHash: tx as any,
                      blockNumber: block,
                      status: "confirmed" as const,
                      timestamp: Math.floor(Date.now() / 1000),
                    },
                  }
                : v
            );
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(`intora_versions_${committedPlan.id}`, JSON.stringify(updated));
              } catch {}
            }
            return updated;
          });
          // Also sync to server endpoint
          fetch("/api/plan/versions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intentId: committedPlan.id,
              version: committedPlan.version,
              txHash: tx,
              blockNumber: block,
              status: "confirmed",
            }),
          }).catch((err) => console.warn("Could not sync commitment to server:", err));
        }}
      />

      {/* Version Comparison Modal */}
      <VersionComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        versions={versionHistory}
        initialFromVersion={comparisonFromVersion}
        initialToVersion={comparisonToVersion}
      />

      {/* Trade-Off Comparison Modal */}
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
          onSelectAlternative={handleSwitchAlternative}
          onPreferenceChange={handlePreferenceChange}
        />
      )}
    </div>
  );
}
