"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus, HelpCircle } from "lucide-react";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the AI pick items without hallucinating fake products?",
      a: "Our planning agent operates under strict catalog grounding constraints. It reads real verified SKUs with exact integer pricing in Indian Rupees (₹). It solves the knapsack optimization problem mathematically, ensuring that items are real, in-stock, and strictly beneath your budget cap.",
    },
    {
      q: "Why is blockchain needed for a shopping list?",
      a: "Traditional e-commerce platforms can silently alter prices, swap recommendations, or deny promises made during planning. By recording an immutable 32-byte cryptographic hash of your approved plan on Base Sepolia, you hold mathematical proof of what was planned, when, and for what budget — tamper-proof.",
    },
    {
      q: "What is Base Sepolia and do I need real money?",
      a: "Base Sepolia is Coinbase's high-speed Layer-2 Ethereum test network. It uses free testnet ETH with zero real-world cost. Transactions confirm in under one second, enabling instantaneous cryptographic verification with ₹0 real expenditure.",
    },
    {
      q: "How do I connect MetaMask?",
      a: "Click 'Connect Wallet' in the top navbar. If you have the MetaMask browser extension installed, it will request permission to connect and auto-prompt switching to Base Sepolia Testnet (Chain ID 84532). If you don't have MetaMask installed, a simulated testnet sandbox wallet is provided automatically so you can test seamlessly.",
    },
    {
      q: "Can I edit a plan after generating it?",
      a: "Yes! You can increase or decrease item quantities, remove items, or add new items in the planner. Every time you make an update, the agent recalculates the plan and registers a new revision (v2, v3) on-chain, preserving the transparent history.",
    },
    {
      q: "Is Intent-to-Commerce AI Agent free to use?",
      a: "Yes, 100% free! All planning computations, catalog searches, and Base Sepolia testnet cryptographic commitments are free for all users.",
    },
  ];

  return (
    <section id="faq" className="scroll-mt-24 md:scroll-mt-28 py-24 md:py-32 bg-[#EEE9E4] pattern-dots">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white border border-[#E4DED8] text-[#8B857F] mb-4">
            <HelpCircle className="w-3.5 h-3.5 text-[#F4A28C]" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="font-serif-headline text-5xl sm:text-6xl text-[#111111] leading-tight mb-4">
            Everything you need to know{" "}
            <span className="text-[#8B857F] italic font-normal">about the agent.</span>
          </h2>
          <p className="font-editorial-sans text-base sm:text-lg text-[#8B857F]">
            Got questions about Gemini reasoning, catalog grounding, or on-chain proofs?
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl sm:rounded-3xl border border-[#E4DED8] overflow-hidden transition-all shadow-editorial-card"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left px-6 py-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="font-editorial-sans text-base sm:text-lg font-medium text-[#111111]">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full border border-[#E4DED8] flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-[#F7F4F1] text-[#8B857F]"
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-1 sm:px-6 sm:pb-6 text-sm text-[#8B857F] leading-relaxed border-t border-[#E4DED8]/60 mt-1">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
