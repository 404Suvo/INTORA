"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Tent,
  BookOpen,
  Sparkles,
  Gift,
  ArrowRight,
  CheckCircle2,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { USE_CASES_BENTO, PRESET_SITUATIONS } from "@/data/mockData";

interface UseCasesBentoProps {
  onSelectUseCase?: (prompt: string, budget: number) => void;
}

export function UseCasesBento({ onSelectUseCase }: UseCasesBentoProps) {
  const handleLoad = (id: string) => {
    let preset = PRESET_SITUATIONS[0];
    if (id === "case-trek") preset = PRESET_SITUATIONS[1];
    else if (id === "case-hostel") preset = PRESET_SITUATIONS[2];
    else if (id === "case-festival") preset = PRESET_SITUATIONS[3];
    else if (id === "case-college") preset = PRESET_SITUATIONS[0];

    onSelectUseCase?.(preset.prompt, preset.defaultBudget);

    const demoSection = document.getElementById("demo");
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="use-cases" className="scroll-mt-24 md:scroll-mt-28 py-24 md:py-32 bg-[#EEE9E4] pattern-dots">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white border border-[#E4DED8] text-[#8B857F] mb-4">
            <span>Tailored Curations</span>
          </div>
          <h2 className="font-serif-headline text-5xl sm:text-6xl text-[#111111] leading-tight mb-4">
            Engineered for life&apos;s{" "}
            <span className="text-[#8B857F] italic font-normal">specific moments.</span>
          </h2>
          <p className="font-editorial-sans text-base sm:text-lg text-[#8B857F] leading-relaxed">
            From sudden torrential downpours to college orientation milestones,
            the agent contextualizes every Rupee spent.
          </p>
        </div>

        {/* 4 Asymmetric Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1 (Large - 7 cols on desktop): Outdoor & Adventure */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="md:col-span-7 bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F4D45]/10 text-[#1F4D45] text-xs font-semibold">
                  <Tent className="w-3.5 h-3.5" />
                  <span>Outdoor & Adventure</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]">
                  Cap: ₹4,500
                </span>
              </div>

              <h3 className="font-serif-headline text-3xl font-medium text-[#111111] mb-2">
                Western Ghats Monsoon Trek
              </h3>
              <p className="text-sm text-[#8B857F] leading-relaxed mb-6 max-w-lg">
                Heavy downpours, slippery rock paths, and river crossings require
                tactical gear. The agent selects ripstop ponchos, IPX6 dry bags,
                and high-electrolyte packs.
              </p>

              {/* Sample item tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {["Ripstop Rain Poncho", "10L Dry Sack", "Waterproof Headlamp", "ORS Electrolytes"].map(
                  (tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full text-xs bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-[#E4DED8] flex items-center justify-between">
              <span className="text-xs text-[#8B857F]">
                4 items curated in 1.1s
              </span>
              <button
                onClick={() => handleLoad("case-trek")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] hover:text-[#1F4D45] cursor-pointer"
              >
                <span>Load this plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

          {/* Card 2 (5 cols on desktop): Student Life / Hostel */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="md:col-span-5 bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9D8FF] text-[#581C87] text-xs font-semibold">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Student Life</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]">
                  Cap: ₹6,000
                </span>
              </div>

              <h3 className="font-serif-headline text-2xl font-medium text-[#111111] mb-2">
                First-Year Hostel Move-In
              </h3>
              <p className="text-sm text-[#8B857F] leading-relaxed mb-6">
                First-time hostellers forget essentials. The agent bundles multi-plug
                spike busters, bedside storage pouches, study desk lamps, and warm blankets.
              </p>

              {/* Sample item tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {["Spike Buster", "Bedside Pocket Caddy", "Study LED Lamp", "Fleece Blanket"].map(
                  (tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full text-xs bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4DED8] flex items-center justify-between">
              <span className="text-xs text-[#8B857F]">
                5 items curated
              </span>
              <button
                onClick={() => handleLoad("case-hostel")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] hover:text-[#1F4D45] cursor-pointer"
              >
                <span>Load this plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

          {/* Card 3 (5 cols on desktop): Cultural & Festive */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="md:col-span-5 bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9D5CB] text-[#9A3412] text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cultural & Festive</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]">
                  Cap: ₹3,000
                </span>
              </div>

              <h3 className="font-serif-headline text-2xl font-medium text-[#111111] mb-2">
                College Fest Cultural Day
              </h3>
              <p className="text-sm text-[#8B857F] leading-relaxed mb-6">
                Three-day outdoor concert heat protection, fast phone recharging,
                and registration notebooks tailored to city campus life.
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {["Insulated Flask", "10k mAh Battery", "Windproof Umbrella", "Gel Pens"].map(
                  (tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full text-xs bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4DED8] flex items-center justify-between">
              <span className="text-xs text-[#8B857F]">
                6 items curated
              </span>
              <button
                onClick={() => handleLoad("case-college")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] hover:text-[#1F4D45] cursor-pointer"
              >
                <span>Load this plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

          {/* Card 4 (7 cols on desktop): Gifting & Celebrations */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="md:col-span-7 bg-white rounded-[32px] border border-[#E4DED8] p-8 shadow-editorial-card flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF08A] text-[#854D0E] text-xs font-semibold">
                  <Gift className="w-3.5 h-3.5" />
                  <span>Gifting & Celebrations</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]">
                  Cap: ₹5,000
                </span>
              </div>

              <h3 className="font-serif-headline text-3xl font-medium text-[#111111] mb-2">
                Diwali Family & Neighbor Hampers
              </h3>
              <p className="text-sm text-[#8B857F] leading-relaxed mb-6 max-w-lg">
                Equitably balances artisanal brass oil diyas, organic dry fruit
                boxes, and scented soy wax candles across 4 recipients without
                surpassing the single ₹5,000 family budget.
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {["Brass Oil Diyas", "Organic Cashews & Almonds", "Soy Wax Candles", "Artisan Cards"].map(
                  (tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full text-xs bg-[#F7F4F1] border border-[#E4DED8] text-[#111111]"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4DED8] flex items-center justify-between">
              <span className="text-xs text-[#8B857F]">
                4 hampers optimized
              </span>
              <button
                onClick={() => handleLoad("case-festival")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] hover:text-[#1F4D45] cursor-pointer"
              >
                <span>Load this plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
