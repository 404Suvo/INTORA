"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Sliders,
  ShieldCheck,
  Check,
  Copy,
  CheckCheck,
  Tag,
  ArrowRight,
  TrendingDown,
  Layers,
} from "lucide-react";

export function HowItWorks() {
  const [copiedHash, setCopiedHash] = useState(false);
  const sampleHash = "0x7a3f81e4b9c02d76f1839a5c8e2b4f91048a6d7c3e5a1b9f8d2c4e6a0b1c3e5d";

  const handleCopy = () => {
    navigator.clipboard?.writeText(sampleHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <section id="how-it-works" className="scroll-mt-24 md:scroll-mt-28 py-24 md:py-32 bg-[#F7F4F1] border-b border-[#E4DED8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white border border-[#E4DED8] text-[#8B857F] mb-4">
            <span>The Workflow</span>
          </div>
          <h2 className="font-serif-headline text-5xl sm:text-6xl text-[#111111] leading-tight mb-4">
            From natural thought to <span className="text-[#8B857F] italic font-normal">on-chain proof.</span>
          </h2>
          <p className="font-editorial-sans text-base sm:text-lg text-[#8B857F] leading-relaxed">
            Three simple steps transform your ambiguous shopping need into a
            deterministic, verifiable plan that respects your wallet.
          </p>
        </div>

        {/* 3 Large Numbered Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card 01: Describe the situation */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-serif-headline text-5xl font-medium text-[#111111]">
                  01
                </span>
                <div className="w-10 h-10 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-center text-[#111111]">
                  <Sparkles className="w-5 h-5 text-[#F4A28C]" />
                </div>
              </div>
              <h3 className="font-serif-headline text-2xl font-medium text-[#111111] mb-3">
                Describe the situation
              </h3>
              <p className="font-editorial-sans text-sm text-[#8B857F] leading-relaxed mb-6">
                Tell the agent your destination, timeline, and concerns. Gemini
                extracts unspoken constraints like humidity, emergency power,
                and local weather.
              </p>
            </div>

            {/* Mini-Preview Inside Card */}
            <div className="bg-[#F7F4F1] rounded-2xl p-4 border border-[#E4DED8] space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8B857F]">
                Extracted Constraints
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-[#E4DED8] text-[#111111]">
                  <Check className="w-3 h-3 text-[#1F4D45]" /> Kolkata Humidity
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-[#E4DED8] text-[#111111]">
                  <Check className="w-3 h-3 text-[#1F4D45]" /> 3-Day Duration
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-[#E4DED8] text-[#111111]">
                  <Check className="w-3 h-3 text-[#1F4D45]" /> Backup Battery
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 02: Budget optimization */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-serif-headline text-5xl font-medium text-[#111111]">
                  02
                </span>
                <div className="w-10 h-10 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-center text-[#111111]">
                  <Sliders className="w-5 h-5 text-[#1F4D45]" />
                </div>
              </div>
              <h3 className="font-serif-headline text-2xl font-medium text-[#111111] mb-3">
                Budget optimization
              </h3>
              <p className="font-editorial-sans text-sm text-[#8B857F] leading-relaxed mb-6">
                Our mathematical knapsack solver pairs real catalog SKUs with
                exact integer paise math. Zero fake items and strictly under your
                ₹ budget cap.
              </p>
            </div>

            {/* Mini-Preview Inside Card: Animated Budget Meter */}
            <div className="bg-[#F7F4F1] rounded-2xl p-4 border border-[#E4DED8] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-[#111111]">Cap: ₹3,000</span>
                <span className="text-[#1F4D45] font-semibold">Total: ₹2,890 (96%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E4DED8] overflow-hidden">
                <div className="h-full bg-[#1F4D45] rounded-full w-[96.3%]" />
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#8B857F]">
                <span>Remaining Buffer:</span>
                <span className="font-mono font-medium text-[#111111]">₹110 surplus</span>
              </div>
            </div>
          </motion.div>

          {/* Card 03: Cryptographic commitment */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-serif-headline text-5xl font-medium text-[#111111]">
                  03
                </span>
                <div className="w-10 h-10 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-center text-[#111111]">
                  <ShieldCheck className="w-5 h-5 text-[#1F4D45]" />
                </div>
              </div>
              <h3 className="font-serif-headline text-2xl font-medium text-[#111111] mb-3">
                Cryptographic commitment
              </h3>
              <p className="font-editorial-sans text-sm text-[#8B857F] leading-relaxed mb-6">
                Review your approved plan, compute its SHA-256 fingerprint, and
                commit it to Base Sepolia. Prove what was planned, when, and for
                what budget.
              </p>
            </div>

            {/* Mini-Preview Inside Card: Hash Pill */}
            <div className="bg-[#F7F4F1] rounded-2xl p-4 border border-[#E4DED8] space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#8B857F]">
                <span>Canonical Plan Hash</span>
                <span className="text-[#1F4D45]">Verified</span>
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E4DED8]">
                <code className="text-[11px] font-mono text-[#111111] truncate max-w-[190px]">
                  0x7a3f81e4b9...3e5d
                </code>
                <button
                  onClick={handleCopy}
                  className="text-[#8B857F] hover:text-[#111111] transition ml-2 cursor-pointer"
                  title="Copy full hash"
                >
                  {copiedHash ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[#1F4D45]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
