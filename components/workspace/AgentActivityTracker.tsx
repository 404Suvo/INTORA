"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  Code2,
  Copy,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AgentStep = {
  tool: string;
  args: any;
  result: any;
  error?: boolean;
};

interface AgentActivityTrackerProps {
  steps: AgentStep[];
  thinking: boolean;
  agentModel?: string;
}

const STAGES = [
  { id: "understand", label: "Understanding Situation", tools: ["analyze_situation"] },
  { id: "constraints", label: "Extracting Constraints & Budget", tools: ["analyze_situation"] },
  { id: "catalog", label: "Searching Authoritative Catalog", tools: ["search_products"] },
  { id: "compare", label: "Comparing Inventory & Stock", tools: ["search_products", "optimize_bundle"] },
  { id: "optimize", label: "Optimizing Integer Bundle", tools: ["optimize_bundle"] },
  { id: "validate", label: "Validating Plan & Expiry", tools: ["verify_plan", "prepare_intent"] },
];

export function AgentActivityTracker({ steps, thinking, agentModel = "gemini-2.5-flash" }: AgentActivityTrackerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const executedTools = new Set(steps.map((s) => s.tool));

  function handleCopy(idx: number, data: any) {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#0E131F]/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Agent Execution Pipeline</h3>
            <p className="text-[11px] text-muted-foreground">Multi-stage controlled tool invocation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-[10px] border-white/[0.1] text-muted-foreground bg-white/[0.02]"
          >
            Model: {agentModel}
          </Badge>
          {thinking && (
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-400 bg-emerald-950/30 text-[10px] animate-pulse"
            >
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Stages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {STAGES.map((stage, idx) => {
          const isDone = stage.tools.some((t) => executedTools.has(t));
          const isActive = thinking && !isDone;

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-2 rounded-2xl p-2.5 border text-xs transition-all ${
                isDone
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                  : isActive
                    ? "border-primary/40 bg-primary/10 text-primary animate-pulse"
                    : "border-white/[0.06] bg-white/[0.02] text-muted-foreground/70"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              ) : isActive ? (
                <Sparkles className="size-4 shrink-0 text-primary animate-spin" />
              ) : (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-[10px] font-mono">
                  {idx + 1}
                </span>
              )}
              <span className="text-[11px] font-medium leading-tight line-clamp-1">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Detailed Tool Traces */}
      {steps.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Controlled Tool Execution Traces ({steps.length})</span>
            <span className="text-[10px] font-mono lowercase">grounded catalog results</span>
          </span>

          <div className="flex flex-col gap-2">
            {steps.map((step, idx) => {
              const isOpen = expandedIndex === idx;
              const hasError = Boolean(step.error);

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-colors ${
                    hasError
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-white/[0.08] bg-[#090B10]/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors rounded-2xl"
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="size-3.5 text-primary" />
                      <span className="font-mono text-xs font-bold text-foreground">
                        {step.tool}()
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[9px] py-0 px-1.5 h-4 ${
                          hasError
                            ? "border-destructive/40 text-destructive"
                            : "border-emerald-500/30 text-emerald-400 bg-emerald-950/20"
                        }`}
                      >
                        {hasError ? "Error" : "Success"}
                      </Badge>
                      <ChevronDown
                        className={`size-3.5 text-muted-foreground transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-3 pt-0 border-t border-white/[0.04] flex flex-col gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Arguments:
                        </span>
                        <pre className="p-2 rounded-xl bg-black/40 text-[10px] text-foreground/80 overflow-x-auto mt-1">
                          {JSON.stringify(step.args, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase text-emerald-400 font-semibold">
                            Returned Output:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(idx, step.result)}
                            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          >
                            {copiedIndex === idx ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <pre className="p-2 rounded-xl bg-black/40 text-[10px] text-emerald-300/90 overflow-x-auto mt-1 max-h-48">
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
