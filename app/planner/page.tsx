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
} from "lucide-react";
import { MOCK_PLANS, ShoppingPlanData, ProductItem, PRESET_SITUATIONS } from "@/data/mockData";
import { generatePlan, hashPlan, connectWallet } from "@/lib/stubs";
import { TransactionApprovalModal } from "@/components/editorial/TransactionApprovalModal";
import { AddProductModal } from "@/components/catalog/AddProductModal";
import { getProductById } from "@/lib/catalog";

export default function FullPlannerPage() {
  const [currentPlan, setCurrentPlan] = useState<ShoppingPlanData>(
    MOCK_PLANS["college-fest"]
  );
  const [situationPrompt, setSituationPrompt] = useState(
    currentPlan.situation
  );
  const [budget, setBudget] = useState(currentPlan.budget);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const generated = await generatePlan(situationPrompt, budget);
      const computedHash = await hashPlan(generated);
      setCurrentPlan({
        ...generated,
        planHash: computedHash,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
        name: catalogItem.name,
        category: catalogItem.category,
        quantity: 1,
        unitPrice: unitPriceInr,
        totalPrice: unitPriceInr,
        rationale: catalogItem.description,
        inStock: catalogItem.inStock,
        imagePlaceholder: "linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)",
        badge: "Added SKU",
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

            {/* Budget Slider */}
            <div className="space-y-3 pt-3 border-t border-[#E4DED8]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#8B857F]">
                  Budget Cap
                </span>
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
              <div className="flex justify-between text-[10px] font-mono text-[#8B857F]">
                <span>₹1,000</span>
                <span>₹10,000</span>
                <span>₹20,000</span>
              </div>
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

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-3.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Re-optimizing Plan...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F4A28C]" />
                  <span>Re-run Optimization</span>
                </>
              )}
            </button>
          </div>

          {/* Right Product Workspace (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-[32px] border border-[#E4DED8] p-6 sm:p-8 shadow-editorial-card space-y-6">
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
                      <div className="text-xs text-[#8B857F]">
                        {item.category} • ₹{item.unitPrice} each
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
        onClose={() => setIsModalOpen(false)}
        plan={currentPlan}
        planHash={currentPlan.planHash}
        walletAccount={walletAccount}
        onWalletConnected={(account) => setWalletAccount(account)}
        onSuccess={(tx, block) => {
          console.log("Committed:", tx, block);
        }}
      />
    </div>
  );
}
