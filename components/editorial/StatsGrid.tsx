"use client";

import React from "react";

export function StatsGrid() {
  const stats = [
    {
      number: "100%",
      label: "Catalog-Grounded",
      caption: "Zero hallucinated items or ghost SKUs.",
    },
    {
      number: "< 2s",
      label: "Average Plan Generation",
      caption: "Fast reasoning powered by Google Gemini.",
    },
    {
      number: "₹0",
      label: "Gas Fees on Testnet",
      caption: "Sub-cent commitments powered by Base Sepolia.",
    },
    {
      number: "SHA-256",
      label: "Cryptographic Integrity",
      caption: "Immutable tamper-proof plan verification.",
    },
  ];

  return (
    <section className="py-20 bg-[#F7F4F1] border-b border-[#E4DED8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4DED8] border-y border-[#E4DED8]">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="py-10 sm:py-8 px-6 text-center sm:text-left flex flex-col justify-between"
            >
              <div className="font-serif-headline text-5xl sm:text-6xl text-[#111111] mb-3 tracking-tight">
                {stat.number}
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-[#111111] mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-[#8B857F] leading-relaxed">
                  {stat.caption}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
