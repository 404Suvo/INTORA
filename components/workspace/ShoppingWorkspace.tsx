"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CircleAlert,
  MessageSquare,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddProductModal } from "@/components/catalog/AddProductModal";
import { AgentActivityTracker, AgentStep } from "./AgentActivityTracker";
import { BudgetSummaryCard } from "./BudgetSummaryCard";
import { PlanControls } from "./PlanControls";
import { ProductBundleEditor } from "./ProductBundleEditor";
import { SituationInputPanel } from "./SituationInputPanel";
import { getProductById } from "@/lib/catalog";
import { computePlanHash } from "@/lib/plan-hash";
import { validatePlan } from "@/lib/plan-validator";
import { PlanDiff, PriceMismatch, ShoppingPlan, ShoppingPlanItem } from "@/lib/types";

interface ShoppingWorkspaceProps {
  activePlan: ShoppingPlan | null;
  setActivePlan: (plan: ShoppingPlan | null) => void;
  reviewedPlanHash: `0x${string}` | null;
  setReviewedPlanHash: (hash: `0x${string}` | null) => void;
  activeDiff: PlanDiff | null;
  setActiveDiff: (diff: PlanDiff | null) => void;
  priceMismatches: PriceMismatch[];
  setPriceMismatches: (mismatches: PriceMismatch[]) => void;
  activeIntentId: `0x${string}` | null;
  setActiveIntentId: (id: `0x${string}` | null) => void;
  activeVersion: number | null;
  setActiveVersion: (version: number | null) => void;
  onNavigateToVerification: () => void;
  initialPrompt?: string;
  initialBudget?: number;
}

type Message = { role: "user" | "agent"; text: string; steps?: AgentStep[]; error?: boolean };

export function ShoppingWorkspace({
  activePlan,
  setActivePlan,
  reviewedPlanHash,
  setReviewedPlanHash,
  activeDiff,
  setActiveDiff,
  priceMismatches,
  setPriceMismatches,
  activeIntentId,
  setActiveIntentId,
  activeVersion,
  setActiveVersion,
  onNavigateToVerification,
  initialPrompt = "",
  initialBudget = 3000,
}: ShoppingWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidPlan, setIsValidPlan] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [lastUserSituation, setLastUserSituation] = useState(initialPrompt);
  const [activeTab, setActiveTab] = useState<"workspace" | "chat">("workspace");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Validate plan whenever activePlan changes
  useEffect(() => {
    if (activePlan) {
      const res = validatePlan(activePlan);
      setIsValidPlan(res.valid);
      setValidationErrors(res.errors);
      if (res.priceMismatches.length > 0) {
        setPriceMismatches(res.priceMismatches);
      }
    }
  }, [activePlan]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Extract plan data from agent steps
  function processAgentResponse(steps?: AgentStep[]) {
    if (!steps) return;
    setAgentSteps(steps);
    for (const s of steps) {
      if (s.tool === "prepare_intent" && s.result?.success) {
        const { plan, planHash, diff, intentId, version, priceMismatches: mismatches } = s.result;
        setActivePlan(plan);
        setReviewedPlanHash(planHash);
        setActiveDiff(diff || null);
        setActiveIntentId(intentId);
        setActiveVersion(version);
        if (mismatches) setPriceMismatches(mismatches);
      }
    }
  }

  // Core Agent invocation
  async function invokeAgent(promptText: string) {
    if (!promptText.trim() || thinking) return;
    const history: Message[] = [...messages, { role: "user", text: promptText }];
    setMessages(history);
    setThinking(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
        }),
      });

      const data = await res.json();
      setMessages((m) => [
        ...m,
        data.error
          ? { role: "agent", text: data.error, error: true }
          : { role: "agent", text: data.answer, steps: data.steps },
      ]);
      processAgentResponse(data.steps);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "Could not reach the server API. Please check connection and retry.",
          error: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  // Handle plan request from SituationInputPanel
  async function handlePlanRequest(
    situationText: string,
    budget?: number,
    preferences?: { category?: string; priority?: string; urgency?: string }
  ) {
    setLastUserSituation(situationText);
    let prompt = situationText;

    if (activeIntentId) {
      prompt = `For existing intent ${activeIntentId}: ${situationText}`;
    }
    if (budget) {
      prompt += ` with budget cap of Rs ${budget}`;
    }
    if (preferences?.category) {
      prompt += ` prioritizing ${preferences.category} products`;
    }
    if (preferences?.priority) {
      prompt += ` using a ${preferences.priority} bundle strategy`;
    }

    await invokeAgent(prompt);
  }

  // Interactive Product Updates: Quantity Change
  function handleUpdateQuantity(productId: string, newQty: number) {
    if (!activePlan) return;
    const clampedQty = Math.max(1, Math.min(100, newQty));
    const updatedItems = activePlan.items.map((item) => {
      if (item.productId === productId) {
        return { ...item, quantity: clampedQty };
      }
      return item;
    });

    const newTotalMinor = updatedItems.reduce(
      (acc, curr) => acc + curr.unitPriceMinor * curr.quantity,
      0
    );

    const updatedPlan: ShoppingPlan = {
      ...activePlan,
      items: updatedItems,
      totalMinor: newTotalMinor,
    };

    setActivePlan(updatedPlan);
    const { planHash } = computePlanHash(updatedPlan);
    setReviewedPlanHash(planHash);
  }

  // Interactive Product Updates: Remove Item
  function handleRemoveItem(productId: string) {
    if (!activePlan) return;
    const remainingItems = activePlan.items.filter((item) => item.productId !== productId);
    if (remainingItems.length === 0) return;

    const newTotalMinor = remainingItems.reduce(
      (acc, curr) => acc + curr.unitPriceMinor * curr.quantity,
      0
    );

    const updatedPlan: ShoppingPlan = {
      ...activePlan,
      items: remainingItems,
      totalMinor: newTotalMinor,
    };

    setActivePlan(updatedPlan);
    const { planHash } = computePlanHash(updatedPlan);
    setReviewedPlanHash(planHash);
  }

  // Interactive Product Updates: Add Item from Catalog
  function handleAddProduct(productId: string) {
    if (!activePlan) return;
    const catalogItem = getProductById(productId);
    if (!catalogItem) return;

    const existingIndex = activePlan.items.findIndex((item) => item.productId === productId);
    let updatedItems: ShoppingPlanItem[];

    if (existingIndex >= 0) {
      updatedItems = activePlan.items.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updatedItems = [
        ...activePlan.items,
        {
          productId,
          quantity: 1,
          unitPriceMinor: catalogItem.priceMinor,
        },
      ];
    }

    const newTotalMinor = updatedItems.reduce(
      (acc, curr) => acc + curr.unitPriceMinor * curr.quantity,
      0
    );

    const updatedPlan: ShoppingPlan = {
      ...activePlan,
      items: updatedItems,
      totalMinor: newTotalMinor,
    };

    setActivePlan(updatedPlan);
    const { planHash } = computePlanHash(updatedPlan);
    setReviewedPlanHash(planHash);
  }

  // Interactive Product Updates: Swap Item
  function handleSwapProduct(oldProductId: string, newProductId: string) {
    if (!activePlan) return;
    const catItem = getProductById(newProductId);
    if (!catItem) return;

    const oldIndex = activePlan.items.findIndex((item) => item.productId === oldProductId);
    if (oldIndex < 0) return;

    const updatedItems = [...activePlan.items];
    updatedItems[oldIndex] = {
      productId: newProductId,
      quantity: 1,
      unitPriceMinor: catItem.priceMinor,
    };

    const newTotalMinor = updatedItems.reduce(
      (acc, curr) => acc + curr.unitPriceMinor * curr.quantity,
      0
    );

    const updatedPlan: ShoppingPlan = {
      ...activePlan,
      items: updatedItems,
      totalMinor: newTotalMinor,
    };

    setActivePlan(updatedPlan);
    const { planHash } = computePlanHash(updatedPlan);
    setReviewedPlanHash(planHash);
  }

  // Edit Budget Action
  function handleEditBudget(newBudgetRupees: number) {
    if (!activePlan) return;
    const newBudgetMinor = Math.round(newBudgetRupees * 100);
    const updatedPlan: ShoppingPlan = {
      ...activePlan,
      budgetMinor: newBudgetMinor,
    };
    setActivePlan(updatedPlan);
    const { planHash } = computePlanHash(updatedPlan);
    setReviewedPlanHash(planHash);
  }

  // Recalculate & Validate Plan via API
  async function handleRecalculateAndValidate() {
    if (!activePlan) return;
    setIsValidating(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activePlan),
      });

      const data = await res.json();
      if (res.ok && data.success && data.stored) {
        setActivePlan(data.stored.plan);
        setReviewedPlanHash(data.stored.planHash);
        setIsValidPlan(true);
        setValidationErrors([]);
      } else {
        setIsValidPlan(false);
        setValidationErrors(data.errors || ["Plan failed validation."]);
      }
    } catch {
      setValidationErrors(["Could not validate plan with server."]);
    } finally {
      setIsValidating(false);
    }
  }

  // Regenerate Plan
  async function handleRegenerate() {
    const prompt = lastUserSituation || "Regenerate an optimal shopping plan within my budget";
    await invokeAgent(prompt);
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            AI Shopping Workspace
            {activePlan && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-xs">
                Active Version {activePlan.version}
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time catalog grounding, paise math optimization, and cryptographic preparation.
          </p>
        </div>

        {/* View toggle between Workspace and Agent Log */}
        <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-white/[0.08]">
          <button
            onClick={() => setActiveTab("workspace")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "workspace"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Workspace & Plan
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "chat"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="size-3.5" />
            <span>Agent Chat ({messages.length})</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      {activeTab === "workspace" && (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
          {/* Left Column: Situation Input & Agent Pipeline Activity */}
          <div className="flex flex-col gap-5">
            <SituationInputPanel
              onPlanRequest={handlePlanRequest}
              loading={thinking}
              activeIntentId={activeIntentId}
              activeVersion={activeVersion}
              initialPrompt={initialPrompt}
              initialBudget={initialBudget}
            />

            <AgentActivityTracker
              steps={agentSteps}
              thinking={thinking}
            />
          </div>

          {/* Right Column: Active Bundle, Budget Summary, and Plan Controls */}
          <div className="flex flex-col gap-5">
            {activePlan ? (
              <>
                {/* Budget Summary Card */}
                <BudgetSummaryCard
                  plan={activePlan}
                  budgetMinor={activePlan.budgetMinor}
                />

                {/* Plan Controls Toolbar */}
                <PlanControls
                  onRegenerate={handleRegenerate}
                  onEditBudget={handleEditBudget}
                  onRecalculateAndValidate={handleRecalculateAndValidate}
                  onApprovePlan={onNavigateToVerification}
                  isValidating={isValidating}
                  isValidPlan={isValidPlan}
                  validationErrors={validationErrors}
                  currentBudgetRupees={activePlan.budgetMinor / 100}
                />

                {/* Product Bundle Editor */}
                <ProductBundleEditor
                  plan={activePlan}
                  diff={activeDiff}
                  priceMismatches={priceMismatches}
                  userSituation={lastUserSituation}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onOpenAddModal={() => setAddProductModalOpen(true)}
                  onSwapItem={handleSwapProduct}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-md">
                <Sparkles className="size-8 text-primary/70 mb-3" />
                <h3 className="font-bold text-base text-foreground">Ready for Planning</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                  Enter your shopping situation and budget on the left, or pick one of the preset prompts.
                  Gemini will extract requirements, optimize items from the official catalog, and prepare your bundle.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent Chat Tab */}
      {activeTab === "chat" && (
        <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-card/70 backdrop-blur-md shadow-lg overflow-hidden max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
            <div className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Interactive Agent Planning Log</h3>
                <p className="text-[11px] text-muted-foreground">
                  Converse with Gemini to revise requirements or inspect items
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              disabled={messages.length === 0 || thinking}
              className="text-xs text-muted-foreground hover:text-foreground h-8"
            >
              <RotateCcw className="size-3 mr-1" /> Clear
            </Button>
          </div>

          {/* Chat Messages */}
          <div className="h-[460px] overflow-y-auto p-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Bot className="size-8 text-primary/40 mb-2" />
                <p className="text-xs">No chat history yet. Generate a plan or type a prompt below.</p>
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "agent" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Bot className="size-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium"
                      : m.error
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-background/80 text-foreground border border-white/[0.06]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Sparkles className="size-3.5 animate-spin text-primary" />
                <span>Gemini is planning & verifying catalog records...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim() || thinking) return;
              invokeAgent(chatInput);
              setChatInput("");
            }}
            className="flex items-center gap-2 p-3 border-t border-white/[0.06] bg-background/50"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g. Budget is now ₹2,000, remove the power bank and add highlighters..."
              className="h-10 text-xs font-mono rounded-xl bg-background border-white/[0.08]"
              disabled={thinking}
            />
            <Button
              type="submit"
              disabled={!chatInput.trim() || thinking}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={addProductModalOpen}
        onClose={() => setAddProductModalOpen(false)}
        onAddProduct={handleAddProduct}
        existingProductIds={activePlan ? activePlan.items.map((i) => i.productId) : []}
      />
    </div>
  );
}
