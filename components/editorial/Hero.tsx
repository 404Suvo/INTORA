"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ShoppingBag,
  Clock,
  Compass,
} from "lucide-react";
import { PRESET_SITUATIONS } from "@/data/mockData";

interface HeroProps {
  onSelectPrompt?: (prompt: string, budget: number) => void;
  onStartPlanning?: () => void;
}

export function Hero({ onSelectPrompt, onStartPlanning }: HeroProps) {
  const [promptText, setPromptText] = useState("");
  const [selectedBudget, setSelectedBudget] = useState(3000);

  const handleChipClick = (preset: (typeof PRESET_SITUATIONS)[number]) => {
    setPromptText(preset.prompt);
    setSelectedBudget(preset.defaultBudget);
    onSelectPrompt?.(preset.prompt, preset.defaultBudget);

    // Smooth scroll to interactive demo
    const demoSection = document.getElementById("demo");
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) {
      handleChipClick(PRESET_SITUATIONS[0]);
      return;
    }
    onSelectPrompt?.(promptText, selectedBudget);
    const demoSection = document.getElementById("demo");
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden bg-[#EEE9E4] pattern-dots">
      {/* Background Soft Peach/Lavender Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[550px] bg-gradient-to-tr from-[#F9D5CB]/40 via-[#F4A28C]/25 to-[#E9D8FF]/35 rounded-full blur-[100px] pointer-events-none -z-0" />
      <div className="absolute -top-12 right-12 w-[350px] h-[350px] bg-[#F9D5CB]/20 rounded-full blur-[80px] pointer-events-none -z-0" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Subtle pill eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-[#E4DED8] shadow-sm mb-8"
        >
          <img
            src="/intora-logo.png"
            alt="Intora Logo"
            className="w-5 h-5 rounded-md object-cover"
          />
          <span className="text-xs font-medium tracking-wider uppercase text-[#111111]">
            Intora AI Agent • Base Sepolia
          </span>
        </motion.div>

        {/* Giant Serif Two-Tone Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-serif-headline text-6xl sm:text-7xl md:text-8xl lg:text-[92px] leading-[1.02] tracking-tight mb-8"
        >
          <span className="text-[#111111] block">Describe the moment.</span>
          <span className="text-[#8B857F] block italic font-normal">
            We plan the shopping.
          </span>
        </motion.h1>

        {/* Subhead in clean Inter */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-editorial-sans text-lg sm:text-xl text-[#8B857F] max-w-2xl mx-auto leading-relaxed mb-10"
        >
          From college fests to weekend treks, tell Intora what you&apos;re preparing
          for. Get a curated, budget-capped shopping plan grounded in real catalog
          items — verified and immutable on Base Sepolia.
        </motion.p>

        {/* Two Primary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-14"
        >
          <button
            onClick={() => {
              onStartPlanning?.();
              const demoSection = document.getElementById("demo");
              if (demoSection) {
                demoSection.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium bg-[#111111] text-white hover:bg-black/85 transition-all shadow-md hover:scale-[1.02] cursor-pointer"
          >
            <span>Start Planning — it&apos;s free</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#demo"
            className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full text-sm font-medium bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition shadow-sm cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-[#F7F4F1] flex items-center justify-center text-[#111111]">
              <Play className="w-3 h-3 fill-current ml-0.5" />
            </div>
            <span>Watch 60s Demo</span>
          </a>
        </motion.div>

        {/* Real-time Interactive Prompt Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <form
            onSubmit={handleFormSubmit}
            className="relative flex items-center bg-white rounded-full p-2 border border-[#E4DED8] shadow-editorial-elevated focus-within:border-[#F4A28C] transition-all"
          >
            <div className="pl-4 pr-2 text-[#8B857F]">
              <Sparkles className="w-5 h-5 text-[#F4A28C]" />
            </div>
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. 3-day trek in the Western Ghats under ₹4,500..."
              className="flex-1 bg-transparent border-none text-[#111111] placeholder:text-[#8B857F] text-base focus:outline-none py-2"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 transition shadow cursor-pointer shrink-0"
            >
              <span>Generate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick-Fill Chip Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="text-xs text-[#8B857F] font-medium mr-1">
              Quick prompts:
            </span>
            {PRESET_SITUATIONS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleChipClick(preset)}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/90 border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] hover:border-[#F4A28C] transition-colors shadow-2xs cursor-pointer"
              >
                {preset.chipLabel} (₹{preset.defaultBudget / 1000}k)
              </button>
            ))}
          </div>
        </motion.div>

        {/* Hero Visual Mockup with Peach/Lavender Glow & Floating Glassmorphic Chat Bubbles */}
        <div className="relative max-w-4xl mx-auto pt-4 pb-8">
          {/* Main Device / Plan Card Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="relative bg-white rounded-[32px] border border-[#E4DED8] shadow-editorial-elevated p-6 sm:p-8 text-left overflow-hidden"
          >
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between pb-6 border-b border-[#E4DED8] gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F7F4F1] flex items-center justify-center border border-[#E4DED8] overflow-hidden shadow-2xs">
                  <img
                    src="/intora-logo.png"
                    alt="Intora Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif-headline text-xl font-medium text-[#111111]">
                      Intora Plan: Kolkata Campus Fest
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45]">
                      v1 Approved
                    </span>
                  </div>
                  <p className="text-xs text-[#8B857F]">
                    Optimized for 3-day humidity & concert emergency power
                  </p>
                </div>
              </div>

              {/* Budget Progress Meter */}
              <div className="bg-[#F7F4F1] px-4 py-2 rounded-2xl border border-[#E4DED8] text-right">
                <div className="text-xs text-[#8B857F]">Budget Allocated</div>
                <div className="text-sm font-semibold text-[#111111]">
                  ₹2,890 <span className="text-xs text-[#8B857F] font-normal">/ ₹3,000</span>
                </div>
              </div>
            </div>

            {/* Generated Items Preview List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Item 1 */}
              <div className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8]/80 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white text-[#8B857F] border border-[#E4DED8]">
                    Hydration
                  </span>
                  <span className="text-xs font-bold text-[#111111]">₹599</span>
                </div>
                <h4 className="text-sm font-medium text-[#111111] line-clamp-1">
                  Insulated Steel Flask (750ml)
                </h4>
                <p className="text-[11px] text-[#8B857F] line-clamp-2">
                  Double-wall vacuum retains ice cold water for 18h in outdoor heat.
                </p>
              </div>

              {/* Item 2 */}
              <div className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8]/80 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white text-[#8B857F] border border-[#E4DED8]">
                    Electronics
                  </span>
                  <span className="text-xs font-bold text-[#111111]">₹999</span>
                </div>
                <h4 className="text-sm font-medium text-[#111111] line-clamp-1">
                  10,000 mAh Fast Power Bank
                </h4>
                <p className="text-[11px] text-[#8B857F] line-clamp-2">
                  Dual-output USB-C for keeping phones alive during evening concert stages.
                </p>
              </div>

              {/* Item 3 */}
              <div className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8]/80 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white text-[#8B857F] border border-[#E4DED8]">
                    Protection
                  </span>
                  <span className="text-xs font-bold text-[#111111]">₹449</span>
                </div>
                <h4 className="text-sm font-medium text-[#111111] line-clamp-1">
                  Windproof Compact UV Umbrella
                </h4>
                <p className="text-[11px] text-[#8B857F] line-clamp-2">
                  Guards against sudden tropical Kolkata showers and heavy noon sun.
                </p>
              </div>
            </div>

            {/* Bottom On-Chain Verification Pill Bar */}
            <div className="mt-6 pt-4 border-t border-[#E4DED8] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1F4D45] animate-ping" />
                <span className="font-mono text-[11px] text-[#8B857F]">
                  Hash: 0x7a3f81e4...3e5d
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#1F4D45]/10 text-[#1F4D45] text-[10px] font-semibold">
                  Base Sepolia Block #18421904
                </span>
              </div>
              <div className="text-[11px] text-[#8B857F]">
                Remaining: <span className="font-semibold text-[#1F4D45]">₹110 left</span>
              </div>
            </div>
          </motion.div>

          {/* Floating Glassmorphic Chat Bubble Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="hidden lg:block absolute -left-12 top-24 bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-[#E4DED8] shadow-editorial-card max-w-[260px] text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F4A28C]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8B857F]">
                User Prompt
              </span>
            </div>
            <p className="text-xs text-[#111111] font-medium leading-snug">
              &ldquo;I need emergency power and hydration for Kolkata heat under ₹3,000.&rdquo;
            </p>
          </motion.div>

          {/* Floating Glassmorphic Chat Bubble Right */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="hidden lg:block absolute -right-12 bottom-12 bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-[#E4DED8] shadow-editorial-card max-w-[270px] text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <img
                src="/intora-logo.png"
                alt="Intora Logo"
                className="w-4 h-4 rounded-md object-cover"
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1F4D45]">
                Intora Reasoning
              </span>
            </div>
            <p className="text-xs text-[#111111] leading-snug">
              &ldquo;Matched 6 real catalog SKUs totaling ₹2,890. Kept ₹110 margin. Plan commitment signed.&rdquo;
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
