"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  GitBranch,
  Scale,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { PlanVersionRecord } from "@/lib/what-if/types";

interface ScenarioTimelineProps {
  versions: PlanVersionRecord[];
  activeVersionNumber: number;
  onSelectVersion: (version: PlanVersionRecord) => void;
  onCompareVersions: (versionA: PlanVersionRecord, versionB: PlanVersionRecord) => void;
  onSimulateFromVersion?: (version: PlanVersionRecord) => void;
  onRecordOnChain?: (version: PlanVersionRecord) => void;
}

export function ScenarioTimeline({
  versions,
  activeVersionNumber,
  onSelectVersion,
  onCompareVersions,
  onSimulateFromVersion,
  onRecordOnChain,
}: ScenarioTimelineProps) {
  if (!versions || versions.length === 0) {
    return null;
  }

  // Display newest first
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="bg-white rounded-[32px] border border-[#E4DED8] p-6 shadow-editorial-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E4DED8]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1F4D45]/10 text-[#1F4D45] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif-headline text-lg font-medium text-[#111111]">
              Scenario Version Timeline
            </h3>
            <p className="text-[11px] text-[#8B857F]">
              {versions.length} immutable version snapshot{versions.length > 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>
      </div>

      {/* Timeline items list */}
      <div className="space-y-3">
        {sorted.map((record) => {
          const isActive = record.version === activeVersionNumber;
          const fitsBudget = record.totalAmount <= record.budget;
          const formattedDate = new Date(record.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={record.version}
              className={`p-4 rounded-2xl border transition-all ${
                isActive
                  ? "bg-[#F7F4F1] border-[#1F4D45] shadow-xs"
                  : "bg-white border-[#E4DED8] hover:border-[#1F4D45]/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? "bg-[#1F4D45] text-white"
                          : "bg-[#1F4D45]/10 text-[#1F4D45]"
                      }`}
                    >
                      v{record.version}
                    </span>

                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45] border border-[#1F4D45]/20">
                        Active Working Version
                      </span>
                    )}

                    {record.parentVersion && (
                      <span className="text-[10px] text-[#8B857F] font-mono">
                        (branched from v{record.parentVersion})
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        fitsBudget
                          ? "bg-[#E8F3EE] text-[#1F4D45]"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {fitsBudget ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Within Budget</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-amber-700" />
                          <span>Over by ₹{(record.totalAmount - record.budget).toLocaleString("en-IN")}</span>
                        </>
                      )}
                    </span>

                    {record.onChainCommitment?.status === "confirmed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                        <ShieldCheck className="w-3 h-3 text-blue-700" />
                        <span>Base Sepolia Verified</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-medium text-[#111111]">
                    {record.scenarioDescription}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8B857F]">
                    <span>
                      Budget: <strong className="text-[#111111]">₹{record.budget.toLocaleString("en-IN")}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total: <strong className="text-[#111111]">₹{record.totalAmount.toLocaleString("en-IN")}</strong>
                    </span>
                    <span>•</span>
                    <span>{record.peopleCount} {record.peopleCount > 1 ? "people" : "person"}</span>
                    <span>•</span>
                    <span>{record.durationDays} days</span>
                    <span>•</span>
                    <span className="font-mono text-[10px]">{formattedDate}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-1.5 self-center">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSelectVersion(record)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#111111] text-white hover:bg-black/85 transition cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect Plan</span>
                    </button>
                  )}

                  {versions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        // Compare this version against active version (or v1 if active is this)
                        const targetCompare =
                          versions.find((v) => v.version === (isActive ? (record.parentVersion || 1) : activeVersionNumber)) ||
                          versions.find((v) => v.version !== record.version) ||
                          record;
                        onCompareVersions(record, targetCompare);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111] hover:bg-[#E4DED8] transition cursor-pointer"
                    >
                      <Scale className="w-3 h-3 text-[#1F4D45]" />
                      <span>Compare</span>
                    </button>
                  )}

                  {onSimulateFromVersion && (
                    <button
                      type="button"
                      onClick={() => onSimulateFromVersion(record)}
                      title="Branch a new scenario simulation starting from this version"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E8F3EE] text-[#1F4D45] hover:bg-[#d5ece1] transition cursor-pointer"
                    >
                      <GitBranch className="w-3 h-3" />
                      <span>Branch Scenario</span>
                    </button>
                  )}

                  {onRecordOnChain && (
                    <button
                      type="button"
                      onClick={() => onRecordOnChain(record)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                      title="Record this specific version snapshot on Base Sepolia"
                    >
                      <ShieldCheck className="w-3 h-3 text-[#1F4D45]" />
                      <span>Record v{record.version}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
