"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Filter,
  Layers,
  MapPin,
  Sparkles,
  SunMedium,
  Wand2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SituationInputPanelProps {
  onPlanRequest: (
    situation: string,
    budget?: number,
    preferences?: { category?: string; priority?: string; urgency?: string }
  ) => void;
  loading: boolean;
  activeIntentId?: string | null;
  activeVersion?: number | null;
  initialPrompt?: string;
  initialBudget?: number;
}

const CATEGORIES = ["All", "stationery", "supplies", "electronics", "snacks", "hygiene"];

const PRESET_QUICK_CHIPS = [
  {
    label: "Kolkata 3-Day (₹3k)",
    prompt:
      "I am going to college for a three-day event in Kolkata. My budget is ₹3,000. I need essential supplies, comfortable items, and anything else I might have forgotten.",
    budget: 3000,
  },
  {
    label: "Study Pack (₹1.5k)",
    prompt:
      "I need semester exam notebooks, highlighters, fine gel pens, and sticky notes under ₹1,500.",
    budget: 1500,
  },
  {
    label: "Tech Pack (₹2.5k)",
    prompt:
      "Need a fast portable power bank, 64GB flash drive, and earphones for laboratory presentations within ₹2,500.",
    budget: 2500,
  },
  {
    label: "Revision (₹2k)",
    prompt: "Budget is now ₹2,000, keep the essentials stationery and hydration.",
    budget: 2000,
  },
];

export function SituationInputPanel({
  onPlanRequest,
  loading,
  activeIntentId,
  activeVersion,
  initialPrompt = "",
  initialBudget = 3000,
}: SituationInputPanelProps) {
  const [situation, setSituation] = useState(initialPrompt);
  const [budgetInput, setBudgetInput] = useState<string>(initialBudget.toString());
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState<"balanced" | "essentials" | "premium">(
    "balanced"
  );
  const [selectedUrgency, setSelectedUrgency] = useState<"standard" | "priority">("standard");

  useEffect(() => {
    if (initialPrompt) setSituation(initialPrompt);
    if (initialBudget) setBudgetInput(initialBudget.toString());
  }, [initialPrompt, initialBudget]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!situation.trim() || loading) return;
    const numericBudget = budgetInput ? parseFloat(budgetInput) : undefined;
    onPlanRequest(situation, numericBudget, {
      category: selectedCategory !== "All" ? selectedCategory : undefined,
      priority: selectedPriority,
      urgency: selectedUrgency,
    });
  }

  function handleSelectChip(chip: (typeof PRESET_QUICK_CHIPS)[0]) {
    setSituation(chip.prompt);
    setBudgetInput(chip.budget.toString());
    onPlanRequest(chip.prompt, chip.budget, {
      category: selectedCategory !== "All" ? selectedCategory : undefined,
      priority: selectedPriority,
      urgency: selectedUrgency,
    });
  }

  const budgetPaise = budgetInput ? Math.round(parseFloat(budgetInput) * 100) : 0;
  const isKolkataContext = situation.toLowerCase().includes("kolkata");

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <BrainCircuit className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Situation & Constraints</h2>
            <p className="text-[11px] text-muted-foreground">Natural language intent extraction by Gemini</p>
          </div>
        </div>

        {activeIntentId && (
          <Badge
            variant="outline"
            className="font-mono text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
          >
            Intent: {activeIntentId.slice(0, 8)}... (v{activeVersion || 1})
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Situation textarea */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Describe Your Real-Life Situation
            </label>
            <span className="text-[10px] text-muted-foreground">Duration &bull; Location &bull; Needs</span>
          </div>
          <textarea
            rows={3}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. I am going to college for a three-day event in Kolkata. My budget is ₹3,000. I need essential supplies, comfortable items, and anything else I might have forgotten."
            className="w-full resize-none rounded-2xl border border-white/[0.08] bg-[#090B10]/80 p-3.5 text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary leading-relaxed placeholder:text-muted-foreground/50"
            disabled={loading}
          />
        </div>

        {/* Location & Context Badge if Kolkata detected */}
        {isKolkataContext && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-teal-500/30 bg-teal-950/20 text-teal-300 text-xs">
            <MapPin className="size-3.5 shrink-0 text-teal-400" />
            <span className="font-mono text-[11px]">
              Location Context: Kolkata &bull; Climate: Warm & Humid &bull; Electrolytes & Stainless Hydration Prioritized
            </span>
          </div>
        )}

        {/* Budget input with integer paise feedback */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Budget Cap (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">₹</span>
              <Input
                type="number"
                min="100"
                step="50"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="3000"
                className="pl-7 h-10 rounded-xl font-mono text-xs bg-[#090B10]/80 border-white/[0.08]"
                disabled={loading}
              />
              <span className="absolute right-2.5 top-2.5 text-[10px] font-mono text-emerald-400">
                {budgetPaise.toLocaleString()} paise
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Optimization Priority
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(["balanced", "essentials", "premium"] as const).map((pri) => (
                <button
                  key={pri}
                  type="button"
                  onClick={() => setSelectedPriority(pri)}
                  className={`h-10 rounded-xl text-[11px] font-medium capitalize transition-all ${
                    selectedPriority === pri
                      ? "bg-primary/20 border border-primary/40 text-primary font-bold shadow-sm"
                      : "bg-[#090B10]/60 border border-white/[0.06] text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={loading}
                >
                  {pri}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          type="submit"
          disabled={loading || !situation.trim()}
          className="h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-background font-bold text-xs gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-40"
        >
          {loading ? (
            <>
              <Sparkles className="size-4 animate-spin text-background" />
              <span>Analyzing Situation & Optimizing Bundle...</span>
            </>
          ) : (
            <>
              <Wand2 className="size-4 text-background" />
              <span>{activeIntentId ? "Revise Plan & Increment Version" : "Generate Optimized Shopping Plan"}</span>
            </>
          )}
        </Button>
      </form>

      {/* Quick Situation Chips */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Preset Scenarios:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUICK_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectChip(chip)}
              disabled={loading}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-all text-left"
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
