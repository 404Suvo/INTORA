"use client";

import { useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Edit3,
  FileCheck,
  Lock,
  Plus,
  Minus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PlanControlsProps {
  onRegenerate: () => void;
  onEditBudget: (newBudgetRupees: number) => void;
  onRecalculateAndValidate: () => void;
  onApprovePlan: () => void;
  isValidating: boolean;
  isValidPlan: boolean;
  validationErrors: string[];
  currentBudgetRupees: number;
}

export function PlanControls({
  onRegenerate,
  onEditBudget,
  onRecalculateAndValidate,
  onApprovePlan,
  isValidating,
  isValidPlan,
  validationErrors,
  currentBudgetRupees,
}: PlanControlsProps) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetVal, setBudgetVal] = useState(currentBudgetRupees.toString());

  function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(budgetVal);
    if (!isNaN(parsed) && parsed > 0) {
      onEditBudget(parsed);
      setEditingBudget(false);
    }
  }

  function handleQuickAdjust(delta: number) {
    const nextVal = Math.max(500, currentBudgetRupees + delta);
    onEditBudget(nextVal);
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileCheck className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Plan Controls & Verification</h3>
            <p className="text-[11px] text-muted-foreground">Adjust budget cap or proceed to cryptographic commitment</p>
          </div>
        </div>

        <Badge
          variant={isValidPlan ? "outline" : "destructive"}
          className={`font-mono text-[10px] rounded-md px-2.5 py-0.5 ${
            isValidPlan
              ? "border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
              : "border-destructive/30 text-destructive bg-destructive/10"
          }`}
        >
          {isValidPlan ? "Plan Validated (Ready)" : "Validation Issues"}
        </Badge>
      </div>

      {/* Validation Errors banner if any */}
      {!isValidPlan && validationErrors.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="size-4 shrink-0" />
            <span>Validation Errors Detected:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Inline Budget Editor modal/row */}
      {editingBudget ? (
        <form onSubmit={handleSaveBudget} className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-[#090B10]/90 border border-white/[0.08]">
          <span className="text-xs text-muted-foreground font-semibold">New Budget: ₹</span>
          <Input
            type="number"
            min="100"
            step="50"
            value={budgetVal}
            onChange={(e) => setBudgetVal(e.target.value)}
            className="h-9 w-32 font-mono text-xs bg-[#090B10] rounded-xl"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <Button type="submit" size="sm" className="h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground">
              Save & Recalculate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingBudget(false)}
              className="h-9 rounded-xl text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {/* Controls Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Edit Budget */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setBudgetVal(currentBudgetRupees.toString());
            setEditingBudget(true);
          }}
          className="h-10 rounded-2xl border-white/[0.08] hover:bg-white/[0.04] text-xs font-medium gap-1.5"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Edit Budget Cap</span>
        </Button>

        {/* Recalculate & Validate */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRecalculateAndValidate}
          disabled={isValidating}
          className="h-10 rounded-2xl border-white/[0.08] hover:bg-white/[0.04] text-xs font-medium gap-1.5"
        >
          <Calculator className="size-3.5 text-emerald-400" />
          <span>{isValidating ? "Validating..." : "Validate Plan"}</span>
        </Button>

        {/* Regenerate Plan */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isValidating}
          className="h-10 rounded-2xl border-white/[0.08] hover:bg-white/[0.04] text-xs font-medium gap-1.5"
        >
          <RefreshCw className="size-3.5 text-blue-400" />
          <span>Re-optimize AI</span>
        </Button>

        {/* Approve Plan */}
        <Button
          size="sm"
          onClick={onApprovePlan}
          disabled={!isValidPlan || isValidating}
          className="h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-background text-xs font-bold gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-40"
        >
          <Lock className="size-3.5 text-background" />
          <span>Approve Plan</span>
          <ArrowRight className="size-3.5 text-background ml-0.5" />
        </Button>
      </div>

      {/* Quick Budget Headroom Adjusters */}
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-white/[0.04]">
        <span>Quick Budget Tweak:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleQuickAdjust(-500)}
            className="px-2 py-0.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-muted-foreground hover:text-foreground"
          >
            -₹500
          </button>
          <button
            onClick={() => handleQuickAdjust(500)}
            className="px-2 py-0.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-emerald-400"
          >
            +₹500
          </button>
          <button
            onClick={() => handleQuickAdjust(1000)}
            className="px-2 py-0.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-emerald-400"
          >
            +₹1,000
          </button>
        </div>
      </div>
    </div>
  );
}
