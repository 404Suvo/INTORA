"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Zap,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  TrendingDown,
  UserPlus,
  Calendar,
  Award,
  Layers,
  Send,
} from "lucide-react";
import { ShoppingPlanData } from "@/data/mockData";
import { PlanComparisonResult, PlanVersionRecord, ValidatedScenario } from "@/lib/what-if/types";

interface WhatIfSimulatorPanelProps {
  currentPlan: ShoppingPlanData;
  isLoading: boolean;
  onSimulate: (scenarioPrompt: string) => Promise<void>;
  ambiguityPrompt?: string | null;
  onAnswerAmbiguity?: (answer: string) => void;
  apiError?: string | null;
  onRetry?: () => void;
  onOpenComparison?: () => void;
  latestDiff?: PlanComparisonResult | null;
}

const SUGGESTED_CHIPS = [
  {
    label: "Reduce budget to ₹2,000",
    prompt: "What if my budget drops to ₹2,000?",
    icon: TrendingDown,
  },
  {
    label: "Add one person",
    prompt: "What if I need to include one more person?",
    icon: UserPlus,
  },
  {
    label: "Increase budget to ₹5,000",
    prompt: "What if I increase my budget to ₹5,000?",
    icon: Sparkles,
  },
  {
    label: "Extend to 5 days",
    prompt: "What if I need this for five days instead of three?",
    icon: Calendar,
  },
  {
    label: "Prioritize quality",
    prompt: "What if I prioritize quality over price?",
    icon: Award,
  },
  {
    label: "Remove power bank",
    prompt: "What if I remove the power bank?",
    icon: Layers,
  },
  {
    label: "Keep essentials & spend less",
    prompt: "What if I want to keep all the essentials but spend less?",
    icon: Zap,
  },
];

export function WhatIfSimulatorPanel({
  currentPlan,
  isLoading,
  onSimulate,
  ambiguityPrompt,
  onAnswerAmbiguity,
  apiError,
  onRetry,
  onOpenComparison,
  latestDiff,
}: WhatIfSimulatorPanelProps) {
  const [scenarioInput, setScenarioInput] = useState("");
  const [ambiguityAnswer, setAmbiguityAnswer] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioInput.trim() || isLoading) return;
    await onSimulate(scenarioInput.trim());
  };

  const handleChipClick = (prompt: string) => {
    setScenarioInput(prompt);
  };

  const handleAmbiguitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ambiguityAnswer.trim()) return;
    onAnswerAmbiguity?.(ambiguityAnswer.trim());
    setAmbiguityAnswer("");
  };

  return (
    <div className="bg-white rounded-[32px] border border-[#E4DED8] p-6 shadow-editorial-card space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4DED8]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1F4D45]/10 text-[#1F4D45] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif-headline text-lg font-medium text-[#111111]">
              What-if Shopping Simulator
            </h3>
            <p className="text-[11px] text-[#8B857F]">
              Modify requirements in natural language • Intelligent versioned recalculation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]">
            Active: v{currentPlan.version || 1}
          </span>
          {latestDiff && onOpenComparison && (
            <button
              type="button"
              onClick={onOpenComparison}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45] hover:bg-[#1F4D45]/20 transition cursor-pointer"
            >
              Compare with v{latestDiff.fromVersion}
            </button>
          )}
        </div>
      </div>

      {/* Suggested Scenario Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-[#8B857F]">
          Suggested Scenarios:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_CHIPS.map((chip, idx) => {
            const Icon = chip.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip.prompt)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[#F7F4F1] border border-[#E4DED8] text-[#111111] hover:bg-[#E4DED8] transition disabled:opacity-50 cursor-pointer"
              >
                <Icon className="w-3 h-3 text-[#1F4D45]" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Natural Language Scenario Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={scenarioInput}
            onChange={(e) => setScenarioInput(e.target.value)}
            disabled={isLoading}
            rows={3}
            placeholder='Ask any what-if scenario... e.g. "What if my budget drops to ₹2,000 and I add 1 person?"'
            className="w-full rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] p-3.5 text-xs text-[#111111] focus:outline-none focus:border-[#F4A28C] leading-relaxed resize-none disabled:opacity-60"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-[#8B857F]">
            Max budget limit: ₹2,00,000 • Original plan is never overwritten
          </span>

          <button
            type="submit"
            disabled={isLoading || !scenarioInput.trim()}
            className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 disabled:opacity-50 transition shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Simulating Changes...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-[#F4A28C]" />
                <span>Simulate Changes</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Ambiguity Clarification Prompt Banner */}
      {ambiguityPrompt && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2.5 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-xs text-amber-900">
                Clarification Needed
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                {ambiguityPrompt}
              </p>
            </div>
          </div>

          <form onSubmit={handleAmbiguitySubmit} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={ambiguityAnswer}
              onChange={(e) => setAmbiguityAnswer(e.target.value)}
              placeholder="e.g. ₹2,000 or 2 people"
              className="flex-1 rounded-xl bg-white border border-amber-300 px-3 py-1.5 text-xs text-amber-950 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition flex items-center gap-1 cursor-pointer"
            >
              <span>Submit</span>
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}

      {/* Simulation Error Alert with Retry */}
      {apiError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-xs text-red-950">
                Simulation Validation Notice
              </div>
              <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                {apiError}
              </p>
            </div>
          </div>
          {onRetry && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onRetry}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Simulation</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
