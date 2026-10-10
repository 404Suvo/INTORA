"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Coins,
  Cpu,
  ExternalLink,
  Eye,
  FileCheck2,
  Hash,
  Layers,
  Lock,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Wand2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INTENT_REGISTRY_ADDRESS } from "@/lib/contract-config";
import { formatInr } from "@/lib/catalog";

interface LandingPageProps {
  onStartPlanning: (situation: string, budget?: number) => void;
  onExploreCatalog: () => void;
}

const PRESET_PROMPTS = [
  {
    title: "College 3-Day Event (₹3,000)",
    prompt:
      "I am going to college for a three-day event in Kolkata. My budget is ₹3,000. I need essential supplies, comfortable items, and anything else I might have forgotten.",
    budget: 3000,
    tag: "Kolkata Event",
    badgeColor: "text-[#ff5a3c] border-[#e0231c]/30 bg-[#e0231c]/10",
    description: "Focuses on hydration, heat protection, power bank & durable campus supplies.",
  },
  {
    title: "Semester Exam Prep (₹1,500)",
    prompt:
      "I need semester exam notebooks, highlighters, fine gel pens, and sticky notes under ₹1,500.",
    budget: 1500,
    tag: "Academics",
    badgeColor: "text-[#dfe7e0] border-white/20 bg-white/5",
    description: "Prioritizes 300-page spiral notebooks, pastel markers, and writing sets.",
  },
  {
    title: "Campus Tech & Power (₹2,500)",
    prompt:
      "Need a fast portable power bank, 64GB flash drive, and earphones for laboratory presentations within ₹2,500.",
    budget: 2500,
    tag: "Tech Gear",
    badgeColor: "text-[#c9a24a] border-[#c9a24a]/30 bg-[#c9a24a]/10",
    description: "High-speed storage, 10,000mAh battery pack, and audio hardware.",
  },
  {
    title: "Essentials Revision (₹2,000)",
    prompt:
      "Budget is now ₹2,000. Keep the essential stationery and hydration, remove expensive electronics.",
    budget: 2000,
    tag: "Version 2 Revision",
    badgeColor: "text-[#ff5a3c] border-[#ff5a3c]/30 bg-[#ff5a3c]/10",
    description: "Trims non-essentials to fit a tightened budget cap while preserving intent.",
  },
];

// Interactive Pipeline Stages for Demonstration
const PIPELINE_STAGES = [
  {
    id: "intent",
    number: "01",
    title: "Intent Parsing",
    tool: "analyze_situation",
    color: "from-[#e0231c]/20 to-[#ff5a3c]/20",
    borderColor: "border-[#e0231c]/30",
    textColor: "text-[#ff5a3c]",
    summary: "Gemini analyzes situation context, location (e.g. Kolkata weather), duration, and integer budget in paise.",
    sampleInput: "\"Going to a 3-day college fest in Kolkata with ₹3,000\"",
    sampleOutput: "Duration: 3 days | Location: Kolkata | Budget: 300,000 paise (Integer minor units)",
  },
  {
    id: "catalog",
    number: "02",
    title: "Catalog Grounding",
    tool: "search_products",
    color: "from-[#ff5a3c]/20 to-[#c9a24a]/20",
    borderColor: "border-[#ff5a3c]/30",
    textColor: "text-[#ff5a3c]",
    summary: "Zero AI Hallucinations: All items, prices, and stock figures are strictly fetched from the authoritative catalog.",
    sampleInput: "Query: supplies, stationery, electronics",
    sampleOutput: "15 Authoritative SKUs queried. Hallucinated prices strictly overwritten.",
  },
  {
    id: "optimize",
    number: "03",
    title: "Knapsack Optimization",
    tool: "optimize_bundle",
    color: "from-[#c9a24a]/20 to-[#e0231c]/20",
    borderColor: "border-[#c9a24a]/30",
    textColor: "text-[#c9a24a]",
    summary: "Integer paise calculation ensures the optimal bundle of necessary goods without exceeding the user's budget ceiling.",
    sampleInput: "Budget ceiling: 300,000 paise",
    sampleOutput: "Optimal Bundle: 7 items | Total: 279,700 paise (₹2,797.00) | Remaining: 20,300 paise",
  },
  {
    id: "hash",
    number: "04",
    title: "Deterministic Keccak-256",
    tool: "canonicalize & hash",
    color: "from-[#dfe7e0]/10 to-[#e0231c]/20",
    borderColor: "border-[#dfe7e0]/20",
    textColor: "text-[#dfe7e0]",
    summary: "Produces canonical UTF-8 JSON with sorted keys and computes a deterministic 32-byte cryptographic hash.",
    sampleInput: "Canonical Plan JSON v1",
    sampleOutput: "keccak256: 0x9b4f2c91823ab... (32-byte cryptographic proof)",
  },
  {
    id: "verify",
    number: "05",
    title: "Base Sepolia Commitment",
    tool: "ShoppingIntentRegistry",
    color: "from-[#e0231c]/20 to-[#a31510]/20",
    borderColor: "border-[#e0231c]/40",
    textColor: "text-[#ff5a3c]",
    summary: "User explicitly approves MetaMask transaction to anchor the hash on-chain, preserving immutable version history.",
    sampleInput: "recordIntent(bytes32 intentHash, uint256 version, string metadataUri)",
    sampleOutput: "Tx Confirmed on Base Sepolia | Block #18,421,904 | Basescan Verified",
  },
];

export function LandingPage({ onStartPlanning, onExploreCatalog }: LandingPageProps) {
  const [situationText, setSituationText] = useState(
    "I am going to college for a three-day event in Kolkata. My budget is ₹3,000. I need essential supplies, comfortable items, and anything else I might have forgotten."
  );
  const [budgetSlider, setBudgetSlider] = useState<number>(3000);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState(0);

  // Tamper Sandbox State
  const [tamperedState, setTamperedState] = useState(false);

  const originalCanonicalPlan = {
    budgetMinor: 300000,
    currency: "INR",
    intentId: "0x3e18a9fc77c10d3e5b882190aa6e541b9c287612f00a469d82f7198bb6c301ae",
    items: [
      { productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 },
      { productId: "gel-pen-set", quantity: 1, unitPriceMinor: 12000 },
      { productId: "power-bank-10000", quantity: 1, unitPriceMinor: 99900 },
      { productId: "stainless-water-bottle", quantity: 1, unitPriceMinor: 45000 },
    ],
    totalMinor: 181900,
    version: 1,
  };

  const tamperedCanonicalPlan = {
    ...originalCanonicalPlan,
    items: [
      { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 }, // modified!
      { productId: "gel-pen-set", quantity: 1, unitPriceMinor: 12000 },
      { productId: "power-bank-10000", quantity: 1, unitPriceMinor: 99900 },
      { productId: "stainless-water-bottle", quantity: 1, unitPriceMinor: 45000 },
    ],
    totalMinor: 206900,
  };

  const originalHash = "0x9b4f2c91823ab67d8120e53a19fc820a4b10de67a329ef001c9a05bc18432a10";
  const tamperedHash = "0x4e83f098aa71b2d049c301ae715b9c287612f00a469d82f7198bb6c301ae59fc";

  function handlePromptClick(preset: (typeof PRESET_PROMPTS)[0]) {
    setSituationText(preset.prompt);
    setBudgetSlider(preset.budget);
  }

  function handleBuildMyPlan(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const effectivePrompt =
      situationText.trim() ||
      "I am going to college for a three-day event in Kolkata. My budget is ₹3,000. I need essential supplies, comfortable items, and anything else I might have forgotten.";
    onStartPlanning(effectivePrompt, budgetSlider);
  }

  return (
    <div className="flex flex-col gap-24 pb-24 max-w-7xl mx-auto w-full">
      {/* Hero Section */}
      <section className="relative pt-8 sm:pt-14 md:pt-20">
        <div className="mx-auto max-w-5xl text-center flex flex-col items-center">
          {/* Top Live Badge - Kage Eyebrow Style */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="eyebrow inline-flex items-center gap-2.5 rounded-full border border-[rgba(223,231,224,0.15)] bg-[#0a0e12]/90 px-4 py-1.5 text-xs text-[#aab4ad] mb-6 backdrop-blur-md shadow-sm"
          >
            <span className="size-2 rounded-full bg-[#e0231c] animate-pulse" />
            <span>影 KAGE INTELLIGENCE &bull; COMMERCE ON BASE SEPOLIA</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="display text-3xl sm:text-5xl md:text-6xl font-normal tracking-tight text-[#dfe7e0] leading-[1.08] max-w-4xl"
          >
            Where stillness reveals the unseen &bull;{" "}
            <span className="bg-gradient-to-r from-[#e0231c] via-[#ff5a3c] to-[#dfe7e0] bg-clip-text text-transparent">
              Intelligent Shopping Plans
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-[#b4bfb7] max-w-3xl leading-relaxed font-light"
          >
            Describe real-life shopping needs in natural language. Grounded in authoritative catalog inventory, optimized to integer paise, and verified with deterministic Keccak-256 commitments on Base Sepolia.
          </motion.p>

          {/* Prominent Situation Launchpad Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="w-full mt-10 rounded-3xl border border-[rgba(223,231,224,0.12)] bg-[#0a0e12]/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#e0231c]/5 blur-3xl pointer-events-none" />

            {/* Launchpad Top Row */}
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[rgba(223,231,224,0.08)] mb-5 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[#e0231c]/15 text-[#ff5a3c] border border-[#e0231c]/30">
                  <BrainCircuit className="size-4" />
                </div>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#dfe7e0]">
                  Describe Your Situation & Budget
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#ff5a3c] bg-[#e0231c]/10 px-2 py-0.5 rounded-md border border-[#e0231c]/25">
                  ₹{budgetSlider.toLocaleString()} = {(budgetSlider * 100).toLocaleString()} paise
                </span>
                <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                  &bull; Zero Floating Point Drift
                </span>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleBuildMyPlan} className="flex flex-col gap-5">
              <div className="relative">
                <textarea
                  rows={3}
                  value={situationText}
                  onChange={(e) => setSituationText(e.target.value)}
                  placeholder="e.g. I am going to college for a three-day event in Kolkata. My budget is ₹3,000. I need essential supplies, comfortable items, and anything else I might have forgotten."
                  className="w-full resize-none rounded-2xl border border-[rgba(223,231,224,0.1)] bg-[#05070a]/90 p-4 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0231c] leading-relaxed"
                />
              </div>

              {/* Dynamic Budget Slider & Rupee Control */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center bg-[#05070a]/60 p-4 rounded-2xl border border-[rgba(223,231,224,0.08)]">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-[#ff5a3c]" />
                      Adjust Budget Ceiling:
                    </span>
                    <span className="font-mono text-[#ff5a3c] font-bold text-sm">
                      ₹{budgetSlider.toLocaleString()} INR
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={100}
                    value={budgetSlider}
                    onChange={(e) => setBudgetSlider(Number(e.target.value))}
                    className="w-full accent-[#e0231c] h-1.5 bg-white/[0.1] rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Min: ₹500</span>
                    <span>Preset: ₹3,000</span>
                    <span>Max: ₹10,000</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 px-6 rounded-2xl bg-gradient-to-r from-[#e0231c] to-[#ff5a3c] hover:from-[#c81e18] hover:to-[#e0231c] text-white font-bold text-sm gap-2.5 shadow-lg shadow-[#e0231c]/25 transition-all group shrink-0"
                >
                  <Wand2 className="size-4 text-white group-hover:rotate-12 transition-transform" />
                  <span>Build My Shopping Plan</span>
                  <ArrowRight className="size-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </form>

            {/* Clickable Realistic Situation Presets */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col gap-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Or Select a Real-World Scenario:</span>
                <span className="text-[10px] font-mono lowercase">click to preload prompt</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PRESET_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePromptClick(item)}
                    className="group flex flex-col p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#e0231c]/40 hover:bg-[#e0231c]/10 text-left transition-all"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${item.badgeColor}`}>
                        {item.tag}
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        ₹{item.budget.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-foreground group-hover:text-[#ff5a3c] transition-colors">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive AI Execution Pipeline Demonstration */}
      <section className="mx-auto max-w-6xl w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="outline" className="border-primary/40 text-primary font-mono text-xs uppercase px-3 py-1 mb-3">
            Interactive Architecture
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            How Intent-to-Commerce Actually Works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            From natural language to an on-chain commitment on Base Sepolia in 5 disciplined stages. Click any stage to inspect the operational logic.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isSelected = selectedPipelineStage === idx;
            return (
              <button
                key={stage.id}
                onClick={() => setSelectedPipelineStage(idx)}
                className={`flex flex-col p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-[#e0231c]/60 bg-[#e0231c]/15 shadow-md shadow-[#e0231c]/15"
                    : "border-white/[0.06] bg-[#0a0e12]/80 hover:border-white/[0.15]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-xs font-bold ${isSelected ? "text-[#ff5a3c]" : "text-muted-foreground"}`}>
                    {stage.number}
                  </span>
                  {isSelected && <span className="size-1.5 rounded-full bg-[#e0231c] animate-ping" />}
                </div>
                <span className={`text-xs font-bold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stage Detail Card */}
        {(() => {
          const stage = PIPELINE_STAGES[selectedPipelineStage];
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-[rgba(223,231,224,0.12)] bg-[#0a0e12]/90 p-6 sm:p-8 backdrop-blur-xl shadow-xl flex flex-col gap-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#e0231c]/15 text-[#ff5a3c] font-mono font-bold text-sm border border-[#e0231c]/30">
                    {stage.number}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{stage.title}</h3>
                    <p className="text-xs text-muted-foreground font-mono">Controlled Tool: {stage.tool}</p>
                  </div>
                </div>

                <Badge variant="outline" className={`font-mono text-xs ${stage.borderColor} ${stage.textColor} bg-white/[0.02]`}>
                  Stage {selectedPipelineStage + 1} of 5
                </Badge>
              </div>

              <p className="text-sm text-foreground/90 leading-relaxed max-w-3xl">
                {stage.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.06] bg-[#05070a]/90 p-4">
                  <span className="text-[11px] font-mono uppercase text-muted-foreground block mb-1">
                    Input Context:
                  </span>
                  <code className="text-xs font-mono text-foreground break-all">
                    {stage.sampleInput}
                  </code>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-[#05070a]/90 p-4">
                  <span className="text-[11px] font-mono uppercase text-[#ff5a3c] block mb-1">
                    Verified Execution Output:
                  </span>
                  <code className="text-xs font-mono text-[#dfe7e0] break-all">
                    {stage.sampleOutput}
                  </code>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </section>

      {/* Interactive Cryptographic Tamper & Avalanche Test Sandbox */}
      <section className="mx-auto max-w-6xl w-full">
        <div className="rounded-3xl border border-[#e0231c]/30 bg-gradient-to-b from-[#e0231c]/10 via-[#0a0e12] to-[#05070a] p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#ff5a3c] mb-1">
                <Hash className="size-4" />
                <span>Deterministic Cryptographic Avalanche Demo</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                Why On-Chain Hashes Guarantee Plan Integrity
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
                The smart contract only needs a 32-byte <code className="text-[#ff5a3c]">keccak256</code> hash to prove the user&apos;s approved plan was not secretly altered. Toggle the switch below to witness the cryptographic avalanche effect in real time.
              </p>
            </div>

            <Button
              variant={tamperedState ? "destructive" : "outline"}
              onClick={() => setTamperedState(!tamperedState)}
              className="h-10 rounded-xl text-xs font-semibold gap-2 shrink-0 border-white/[0.15]"
            >
              <RefreshCw className="size-3.5" />
              <span>{tamperedState ? "Reset to Clean Plan" : "Simulate Altering 1 Item Qty (+1)"}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Canonical JSON Side */}
            <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[#05070a]/90 p-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-xs font-mono font-semibold text-muted-foreground">
                  Canonical UTF-8 Plan Payload
                </span>
                <Badge
                  variant={tamperedState ? "destructive" : "outline"}
                  className="text-[10px] font-mono"
                >
                  {tamperedState ? "TAMPERED PAYLOAD" : "APPROVED CANONICAL"}
                </Badge>
              </div>

              <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto p-2 bg-black/40 rounded-xl max-h-56 leading-relaxed">
                {JSON.stringify(tamperedState ? tamperedCanonicalPlan : originalCanonicalPlan, null, 2)}
              </pre>

              {tamperedState ? (
                <div className="flex items-center gap-2 text-xs text-rose-400 p-2 rounded-lg bg-rose-950/20 border border-rose-500/30">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>Modified: Notebooks quantity increased from 1 to 2.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#dfe7e0] p-2 rounded-lg bg-[#e0231c]/10 border border-[#e0231c]/30">
                  <ShieldCheck className="size-4 shrink-0 text-[#ff5a3c]" />
                  <span>Exact plan approved by user prior to signing.</span>
                </div>
              )}
            </div>

            {/* Resulting Hash Side */}
            <div className="flex flex-col gap-4 justify-between rounded-2xl border border-white/[0.08] bg-[#05070a]/90 p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground">
                    Computed Keccak-256 Hash
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">32-Byte Digest</span>
                </div>

                <div className={`p-4 rounded-xl border font-mono text-xs sm:text-sm break-all transition-all duration-300 ${
                  tamperedState
                    ? "border-rose-500/50 bg-rose-950/30 text-rose-300 animate-avalanche"
                    : "border-[#e0231c]/50 bg-[#e0231c]/15 text-[#dfe7e0]"
                }`}>
                  {tamperedState ? tamperedHash : originalHash}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Notice that altering a single line item creates an entirely completely distinct 64-character hash. If someone changes even a single rupee, the on-chain verification will immediately fail (<code className="text-rose-400">onChainHash != recomputedHash</code>).
                </p>
              </div>

              <div className="flex items-center justify-between text-xs font-mono p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-muted-foreground">Smart Contract Validation:</span>
                <span className={`font-bold ${tamperedState ? "text-rose-400" : "text-[#ff5a3c]"}`}>
                  {tamperedState ? "REJECTED ❌ (Hash Mismatch)" : "VERIFIED ✅ (Byte-Perfect Match)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Hard Rules & Feature Highlights Grid */}
      <section className="mx-auto max-w-6xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-[rgba(223,231,224,0.1)] bg-[#0a0e12]/80 p-6 sm:p-7 flex flex-col gap-3 backdrop-blur-md hover:border-[#e0231c]/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#e0231c]/15 text-[#ff5a3c] border border-[#e0231c]/30">
                <Cpu className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Zero AI Price Hallucination</h3>
                <span className="text-xs text-muted-foreground font-mono">Hard Rule 3 &bull; Grounded Truth</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Every item, stock figure, and unit price is verified against the authoritative catalog. If the language model suggests an altered price, our independent validator flags the mismatch and overwrites it with catalog truth.
            </p>
          </div>

          <div className="rounded-3xl border border-[rgba(223,231,224,0.1)] bg-[#0a0e12]/80 p-6 sm:p-7 flex flex-col gap-3 backdrop-blur-md hover:border-[#ff5a3c]/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#ff5a3c]/15 text-[#ff5a3c] border border-[#ff5a3c]/30">
                <Coins className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Paise-Accurate Integer Math</h3>
                <span className="text-xs text-muted-foreground font-mono">Hard Rule 4 &bull; Zero Float Drift</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              All financial values are calculated in integer paise (₹1 = 100 paise). Budget ceilings, subtotals, and deltas are calculated strictly in application code, ensuring zero rounding anomalies or floating point drift.
            </p>
          </div>

          <div className="rounded-3xl border border-[rgba(223,231,224,0.1)] bg-[#0a0e12]/80 p-6 sm:p-7 flex flex-col gap-3 backdrop-blur-md hover:border-[#c9a24a]/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#c9a24a]/15 text-[#c9a24a] border border-[#c9a24a]/30">
                <Lock className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Immutable Versioning & Diffs</h3>
                <span className="text-xs text-muted-foreground font-mono">Base Sepolia Sequential Revisions</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              When you adjust your budget or modify preferences, the existing intent ID is preserved and bumped to Version 2+. A human-readable diff is computed, and previous versions remain permanently readable on-chain.
            </p>
          </div>

          <div className="rounded-3xl border border-[rgba(223,231,224,0.1)] bg-[#0a0e12]/80 p-6 sm:p-7 flex flex-col gap-3 backdrop-blur-md hover:border-[rgba(223,231,224,0.3)] transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[rgba(223,231,224,0.1)] text-[#dfe7e0] border border-[rgba(223,231,224,0.2)]">
                <FileCheck2 className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">User-Approved MetaMask Signing</h3>
                <span className="text-xs text-muted-foreground font-mono">Hard Rule 2 &bull; Non-Custodial</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              The AI agent and server never sign or submit transactions. They solely prepare deterministic calldata; you review every line item and explicitly approve the transaction in MetaMask.
            </p>
          </div>
        </div>
      </section>

      {/* Base Sepolia Contract Explorer Card */}
      <section className="mx-auto max-w-5xl w-full rounded-3xl border border-[rgba(223,231,224,0.12)] bg-[#0a0e12]/90 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#ff5a3c]">
              <ShieldCheck className="size-4" />
              <span>Base Sepolia Verified Contract</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              ShoppingIntentRegistry.sol
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Live on Base Sepolia Testnet (Chain ID <code className="text-foreground">84532</code>). Verifies immutable plans without ever exposing private line items or executing fiat orders.
            </p>
            <div className="mt-2 text-xs font-mono text-[#ff5a3c] bg-[#e0231c]/10 p-2.5 rounded-xl border border-[#e0231c]/25 break-all">
              {INTENT_REGISTRY_ADDRESS}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href={`https://sepolia.basescan.org/address/${INTENT_REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-white/[0.15] bg-white/[0.04] text-xs font-mono text-foreground hover:bg-white/[0.08] transition-colors"
            >
              <span>View on BaseScan</span>
              <ExternalLink className="size-3.5" />
            </a>

            <Button
              onClick={() => onStartPlanning(situationText, budgetSlider)}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#e0231c] to-[#ff5a3c] hover:from-[#c81e18] hover:to-[#e0231c] text-white text-xs font-semibold gap-2 shadow-md shadow-[#e0231c]/25"
            >
              <span>Launch AI Workspace</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
