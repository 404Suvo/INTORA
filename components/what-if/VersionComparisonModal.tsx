"use client";

import React, { useState } from "react";
import {
  X,
  Scale,
  Plus,
  Minus,
  Check,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { comparePlanVersions } from "@/lib/what-if/diff-engine";
import { PlanComparisonResult, PlanVersionRecord } from "@/lib/what-if/types";

interface VersionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: PlanVersionRecord[];
  initialFromVersion?: number;
  initialToVersion?: number;
}

export function VersionComparisonModal({
  isOpen,
  onClose,
  versions,
  initialFromVersion,
  initialToVersion,
}: VersionComparisonModalProps) {
  if (!isOpen || !versions || versions.length === 0) return null;

  const [fromVersionNum, setFromVersionNum] = useState<number>(
    initialFromVersion ?? (versions.length > 1 ? versions[0].version : versions[0].version)
  );
  const [toVersionNum, setToVersionNum] = useState<number>(
    initialToVersion ?? (versions.length > 1 ? versions[versions.length - 1].version : versions[0].version)
  );

  const versionFrom = versions.find((v) => v.version === fromVersionNum) || versions[0];
  const versionTo = versions.find((v) => v.version === toVersionNum) || versions[versions.length - 1];

  const diff: PlanComparisonResult = comparePlanVersions(versionFrom, versionTo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#EEE9E4] rounded-[32px] border border-[#E4DED8] max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E4DED8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1F4D45]/10 text-[#1F4D45] flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-headline text-2xl font-medium text-[#111111]">
                Version Comparison View
              </h3>
              <p className="text-xs text-[#8B857F]">
                Side-by-side analysis of budget, product substitutions, and trade-offs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version Pickers */}
        <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8B857F]">Base Version:</span>
            <select
              value={fromVersionNum}
              onChange={(e) => setFromVersionNum(Number(e.target.value))}
              className="bg-[#F7F4F1] border border-[#E4DED8] rounded-xl px-3 py-1.5 text-xs font-bold text-[#111111] focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} — {v.scenarioDescription.slice(0, 30)}...
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-[#8B857F]" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8B857F]">Compare With:</span>
            <select
              value={toVersionNum}
              onChange={(e) => setToVersionNum(Number(e.target.value))}
              className="bg-[#F7F4F1] border border-[#E4DED8] rounded-xl px-3 py-1.5 text-xs font-bold text-[#111111] focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} — {v.scenarioDescription.slice(0, 30)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Concise Grounded Explanation Banner */}
        <div className="p-4 rounded-2xl bg-[#E8F3EE] border border-[#1F4D45]/30 text-[#1F4D45] space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#1F4D45]">
            Plan Revision Analysis
          </div>
          <p className="text-xs leading-relaxed text-[#111111]">
            {diff.explanation}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] space-y-1">
            <span className="text-[11px] text-[#8B857F]">Budget</span>
            <div className="font-serif-headline text-lg font-bold text-[#111111]">
              ₹{diff.budgetTo.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] font-mono text-[#8B857F]">
              {diff.budgetDelta !== 0 ? (
                <span className={diff.budgetDelta > 0 ? "text-emerald-700 font-semibold" : "text-amber-800 font-semibold"}>
                  {diff.budgetDelta > 0 ? "+" : ""}₹{diff.budgetDelta.toLocaleString("en-IN")} from v{diff.fromVersion}
                </span>
              ) : (
                "Unchanged"
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] space-y-1">
            <span className="text-[11px] text-[#8B857F]">Estimated Total</span>
            <div className="font-serif-headline text-lg font-bold text-[#111111]">
              ₹{diff.totalTo.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] font-mono">
              {diff.totalDelta !== 0 ? (
                <span className={diff.totalDelta < 0 ? "text-emerald-700 font-semibold" : "text-amber-800 font-semibold"}>
                  {diff.totalDelta > 0 ? "+" : ""}₹{diff.totalDelta.toLocaleString("en-IN")}
                </span>
              ) : (
                <span className="text-[#8B857F]">No cost difference</span>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] space-y-1">
            <span className="text-[11px] text-[#8B857F]">Calculated Savings</span>
            <div className="font-serif-headline text-lg font-bold text-[#1F4D45]">
              {diff.savings > 0 ? `₹${diff.savings.toLocaleString("en-IN")}` : "₹0"}
            </div>
            <div className="text-[10px] text-[#8B857F]">
              {diff.savings > 0 ? "Factual calculated savings" : "No net savings"}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] space-y-1">
            <span className="text-[11px] text-[#8B857F]">Budget Status</span>
            <div className="font-serif-headline text-lg font-bold">
              {diff.overrunTo === 0 ? (
                <span className="text-[#1F4D45]">Within Budget</span>
              ) : (
                <span className="text-red-600">Over Budget</span>
              )}
            </div>
            <div className="text-[10px] text-[#8B857F]">
              {diff.overrunTo === 0
                ? `₹${diff.remainingTo.toLocaleString("en-IN")} remaining`
                : `₹${diff.overrunTo.toLocaleString("en-IN")} overrun`}
            </div>
          </div>
        </div>

        {/* Product Changes Accordion / List */}
        <div className="space-y-4">
          {/* Added Products */}
          {diff.addedProducts.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                <Plus className="w-3.5 h-3.5" />
                <span>Products Added in v{diff.toVersion} ({diff.addedProducts.length})</span>
              </div>
              <div className="space-y-1.5">
                {diff.addedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100"
                  >
                    <div>
                      <span className="font-semibold text-emerald-950">{p.name}</span>
                      <span className="text-emerald-700 ml-2">x{p.quantity}</span>
                    </div>
                    <span className="font-bold text-emerald-900">
                      ₹{p.totalPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed Products */}
          {diff.removedProducts.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-rose-200 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-bold uppercase tracking-wider">
                <Minus className="w-3.5 h-3.5" />
                <span>Products Removed from v{diff.fromVersion} ({diff.removedProducts.length})</span>
              </div>
              <div className="space-y-1.5">
                {diff.removedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs bg-rose-50/60 p-2.5 rounded-xl border border-rose-100"
                  >
                    <div>
                      <span className="font-semibold text-rose-950 line-through">{p.name}</span>
                      <span className="text-rose-700 ml-2">x{p.quantity}</span>
                    </div>
                    <span className="font-bold text-rose-900">
                      -₹{p.totalPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Changes */}
          {diff.quantityChanges.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] space-y-2">
              <div className="flex items-center gap-2 text-[#111111] text-xs font-bold uppercase tracking-wider">
                <Scale className="w-3.5 h-3.5 text-[#1F4D45]" />
                <span>Quantity Adjustments ({diff.quantityChanges.length})</span>
              </div>
              <div className="space-y-1.5">
                {diff.quantityChanges.map((q) => (
                  <div
                    key={q.product.id}
                    className="flex items-center justify-between text-xs bg-[#F7F4F1] p-2.5 rounded-xl border border-[#E4DED8]"
                  >
                    <div>
                      <span className="font-semibold text-[#111111]">{q.product.name}</span>
                      <span className="text-[#8B857F] ml-2">
                        {q.oldQuantity} units → {q.newQuantity} units ({q.delta > 0 ? `+${q.delta}` : q.delta})
                      </span>
                    </div>
                    <span className="font-bold text-[#111111]">
                      {q.costDelta >= 0 ? "+" : ""}₹{q.costDelta.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retained Products */}
          {diff.retainedProducts.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#E4DED8] space-y-2">
              <div className="flex items-center gap-2 text-[#8B857F] text-xs font-bold uppercase tracking-wider">
                <Check className="w-3.5 h-3.5 text-[#1F4D45]" />
                <span>Retained Products ({diff.retainedProducts.length})</span>
              </div>
              <div className="text-xs text-[#8B857F]">
                {diff.retainedProducts.map((r) => r.to.name).join(", ")}
              </div>
            </div>
          )}

          {/* Key Trade-Offs & Unknown Info */}
          {(diff.keyTradeOffs.length > 0 || diff.unknownOrStaleInfo.length > 0) && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Key Trade-Offs & Cost Details
              </div>
              {diff.keyTradeOffs.length > 0 && (
                <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-950">
                  {diff.keyTradeOffs.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              )}
              {diff.unknownOrStaleInfo.map((info, idx) => (
                <div key={idx} className="text-[11px] text-amber-800">
                  {info}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-[#E4DED8]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full text-xs font-semibold bg-[#111111] text-white hover:bg-black transition cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
