"use client";

import { useState } from "react";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SituationInputProps {
  onPlanRequest: (situation: string, explicitBudget?: number) => void;
  loading: boolean;
  activeIntentId?: string | null;
  activeVersion?: number | null;
}

const PRESET_EXAMPLES = [
  {
    title: "College Activities Bundle (₹3,000)",
    prompt: "I need supplies for three days of college activities, my budget is Rs 3,000",
    budget: 3000,
  },
  {
    title: "Revision: Reduced Budget (₹2,000)",
    prompt: "Budget is now Rs 2,000, keep the essentials",
    budget: 2000,
    isRevision: true,
  },
  {
    title: "Study & Stationery Pack (₹1,000)",
    prompt: "I need semester notebooks, pens, and highlighters for exams under Rs 1,000",
    budget: 1000,
  },
];

export function SituationInput({
  onPlanRequest,
  loading,
  activeIntentId,
  activeVersion,
}: SituationInputProps) {
  const [situation, setSituation] = useState("");
  const [budgetInput, setBudgetInput] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!situation.trim() || loading) return;
    const numericBudget = budgetInput ? parseFloat(budgetInput) : undefined;
    onPlanRequest(situation, numericBudget);
  }

  function handleSelectPreset(example: (typeof PRESET_EXAMPLES)[0]) {
    setSituation(example.prompt);
    setBudgetInput(example.budget.toString());
    onPlanRequest(example.prompt, example.budget);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-bold uppercase tracking-tight">AI Shopping Planner</h2>
            <p className="text-xs text-muted-foreground">
              Natural language situation + budget &rarr; Catalog verified bundle &rarr; Base Sepolia commitment
            </p>
          </div>
        </div>

        {activeIntentId && (
          <div className="text-right">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Active Intent: {activeIntentId.slice(0, 8)}... (v{activeVersion || 1})
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Shopping Situation & Needs
          </label>
          <textarea
            rows={2}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. I need supplies for three days of college activities, my budget is Rs 3,000"
            className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Budget Cap (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
              <Input
                type="number"
                min="100"
                step="50"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="3000"
                className="pl-7 font-mono text-sm"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={loading || !situation.trim()}
              className="w-full h-10 font-mono text-xs uppercase tracking-wider gap-2"
            >
              <Wand2 className="size-4" />
              {loading
                ? "Gemini is Planning & Validating..."
                : activeIntentId
                  ? "Revise Plan (Version + 1)"
                  : "Generate Validated Plan"}
            </Button>
          </div>
        </div>
      </form>

      {/* Preset Suggestions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Preset Demonstrations:
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_EXAMPLES.map((ex, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleSelectPreset(ex)}
              className="text-xs font-mono h-auto py-1.5 text-left border-border/80 hover:border-primary"
            >
              <ArrowRight className="size-3 mr-1 text-primary" />
              {ex.title}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
