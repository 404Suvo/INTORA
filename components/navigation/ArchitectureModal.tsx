"use client";

import { useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Coins,
  Cpu,
  ExternalLink,
  FileCheck2,
  Layers,
  Lock,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INTENT_REGISTRY_ADDRESS } from "@/lib/contract-config";

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  const [activeTab, setActiveTab] = useState<"pipeline" | "security" | "contract">("pipeline");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.12] bg-[#0E131F] p-6 sm:p-8 shadow-2xl text-foreground">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors"
          aria-label="Close modal"
        >
          <X className="size-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-background font-bold shadow-md shadow-emerald-500/20">
            <Sparkles className="size-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Intent-to-Commerce Architecture
              </h2>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/30 font-mono text-xs">
                Base Sepolia
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Autonomous AI Planning &bull; Integer Precision &bull; On-Chain Cryptographic Integrity
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/[0.08] mb-6 gap-2">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "pipeline"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BrainCircuit className="size-4" />
            <span>Execution Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "security"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="size-4" />
            <span>Integrity & Hard Rules</span>
          </button>
          <button
            onClick={() => setActiveTab("contract")}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "contract"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="size-4" />
            <span>Smart Contract Specs</span>
          </button>
        </div>

        {/* Tab 1: Execution Pipeline */}
        {activeTab === "pipeline" && (
          <div className="space-y-6">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              How a human sentence transforms into a mathematically verified, on-chain verifiable shopping plan:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-xs font-semibold mb-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    01
                  </span>
                  <span>1. Natural Language Intent Parsing</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Google Gemini inspects the prompt (e.g. &ldquo;Preparing for a 3-day college event in Kolkata with a budget of ₹3,000&rdquo;), extracting duration (3 days), destination nuances (Kolkata weather, hydration, stationery), and budget converted strictly to <strong>300,000 paise</strong>.
                </p>
                <div className="mt-3 text-[11px] font-mono text-emerald-400 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                  Tool: analyze_situation(situation, budgetRupees)
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2.5 text-cyan-400 font-mono text-xs font-semibold mb-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs">
                    02
                  </span>
                  <span>2. Catalog Grounding (Zero Hallucinations)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The agent queries the authoritative in-memory catalog of real SKUs. AI models are prohibited from manufacturing product IDs or setting arbitrary prices. Only authentic, in-stock products are considered.
                </p>
                <div className="mt-3 text-[11px] font-mono text-cyan-400 bg-cyan-950/20 p-2 rounded-lg border border-cyan-500/20">
                  Tool: search_products(query, category)
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2.5 text-indigo-400 font-mono text-xs font-semibold mb-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs">
                    03
                  </span>
                  <span>3. Integer Knapsack Optimization</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Products are selected and quantities allocated prioritizing essential survival and utility needs within the budget ceiling. All calculations use integer paise: zero floating-point arithmetic.
                </p>
                <div className="mt-3 text-[11px] font-mono text-indigo-400 bg-indigo-950/20 p-2 rounded-lg border border-indigo-500/20">
                  Tool: optimize_bundle(situation, budgetMinor, items)
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2.5 text-violet-400 font-mono text-xs font-semibold mb-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs">
                    04
                  </span>
                  <span>4. Deterministic Canonical Hashing</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The plan is formatted into deterministic canonical JSON (sorted keys, integer values) and hashed with <code className="text-violet-300">keccak256</code>. This produces an immutable 32-byte cryptographic footprint.
                </p>
                <div className="mt-3 text-[11px] font-mono text-violet-400 bg-violet-950/20 p-2 rounded-lg border border-violet-500/20">
                  Output: 0x9b4f... (Deterministic 32-byte hash)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security & Hard Rules */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-1">
                <CheckCircle2 className="size-4" />
                Hard Rule 1: Server-Side Gemini API Key Only
              </h4>
              <p className="text-xs text-muted-foreground">
                <code className="text-foreground">GEMINI_API_KEY</code> is never exposed to the client bundle. All calls originate securely via the Next.js API route (<code className="text-foreground">app/api/agent/route.ts</code>).
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-1">
                <CheckCircle2 className="size-4" />
                Hard Rule 2: Explicit User-Approved MetaMask Signing
              </h4>
              <p className="text-xs text-muted-foreground">
                The agent NEVER signs or sends transactions. The agent only prepares the calldata payload; the user reviews the exact items and explicitly approves the transaction via MetaMask on Base Sepolia.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-1">
                <CheckCircle2 className="size-4" />
                Hard Rule 3: Zero Trust in AI Calculations
              </h4>
              <p className="text-xs text-muted-foreground">
                Product IDs, catalog prices, stock availability, and line totals come strictly from the application catalog. Any hallucinated prices are automatically detected, flagged, and overwritten with catalog truth.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-1">
                <CheckCircle2 className="size-4" />
                Hard Rule 4: Integer Minor Units (Paise for INR)
              </h4>
              <p className="text-xs text-muted-foreground">
                No floating-point numbers anywhere in budgets, unit prices, totals, or contract calldata. ₹3,000.00 is stored as 300000 paise, preventing IEEE 754 precision drift.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Contract Specs */}
        {activeTab === "contract" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3 mb-3">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Smart Contract</span>
                  <h4 className="text-sm font-bold text-foreground">ShoppingIntentRegistry.sol</h4>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/20 font-mono text-[11px] self-start sm:self-auto">
                  Base Sepolia (84532)
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-background/60 border border-white/[0.04]">
                  <span className="text-muted-foreground">Contract Address:</span>
                  <a
                    href={`https://sepolia.basescan.org/address/${INTENT_REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-400 hover:underline flex items-center gap-1 break-all"
                  >
                    <span>{INTENT_REGISTRY_ADDRESS}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-background/60 border border-white/[0.04]">
                  <span className="text-muted-foreground">Method for v1 Plan:</span>
                  <code className="font-mono text-foreground font-semibold">
                    recordIntent(bytes32 intentHash, uint256 version, string metadataUri)
                  </code>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-background/60 border border-white/[0.04]">
                  <span className="text-muted-foreground">Method for v2+ Revisions:</span>
                  <code className="font-mono text-foreground font-semibold">
                    recordVersion(bytes32 intentId, bytes32 intentHash, uint256 version, string metadataUri)
                  </code>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">
              <span className="font-bold text-amber-300">Notice on Testnet & Privacy:</span>
              <p className="mt-1 text-amber-200/80 leading-relaxed">
                Recording an intent on Base Sepolia stores a cryptographic commitment to your approved plan. It does not store your private shopping list on-chain, and it does not execute a fiat or crypto purchase.
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-8 pt-4 border-t border-white/[0.08] flex justify-end">
          <Button
            onClick={onClose}
            className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs px-5 h-9"
          >
            Got It
          </Button>
        </div>
      </div>
    </div>
  );
}
