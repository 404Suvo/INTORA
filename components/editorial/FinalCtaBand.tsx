"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function FinalCtaBand() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-gradient-to-r from-[#F9D5CB] via-[#F4A28C] to-[#E9D8FF] border-b border-[#E4DED8]">
      {/* Decorative blurred backdrops */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-white/80 text-xs font-semibold uppercase tracking-wider text-[#111111] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#1F4D45]" />
            <span>Launch Your First Plan</span>
          </div>

          <h2 className="font-serif-headline text-5xl sm:text-6xl md:text-7xl text-[#111111] leading-[1.05] tracking-tight">
            Ready to plan your next moment?
          </h2>

          <p className="font-editorial-sans text-base sm:text-lg text-[#111111]/80 max-w-xl mx-auto leading-relaxed">
            Join thousands of travelers, students, and planners turning ambiguous
            needs into budget-capped, cryptographically verified shopping lists.
          </p>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
            <Link
              href="/planner"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 transition shadow-editorial-card cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#F4A28C]" />
              <span>Launch Full Planner</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wider bg-white/80 hover:bg-white text-[#111111] border border-white/90 transition shadow-sm cursor-pointer"
            >
              <span>Try Interactive Demo</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
