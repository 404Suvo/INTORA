"use client";

import React from "react";
import { TRUST_BADGES } from "@/data/mockData";
import { Cpu, ShieldCheck, Wallet, Sparkles, CheckCircle2 } from "lucide-react";

export function TrustStrip() {
  const items = [
    { name: "Powered by Google Gemini 2.5", icon: Sparkles },
    { name: "Base Sepolia Testnet", icon: ShieldCheck },
    { name: "MetaMask Ready", icon: Wallet },
    { name: "ERC-721 / Hash Verification", icon: CheckCircle2 },
    { name: "Zero Hallucination Catalog", icon: Cpu },
    { name: "Integer Paise Precision (₹)", icon: ShieldCheck },
  ];

  return (
    <div className="w-full bg-[#EEE9E4] border-y border-[#E4DED8] py-5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative w-full overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
          {/* Continuous scrolling track */}
          <div className="flex w-max items-center gap-12 animate-[marquee_30s_linear_infinite] opacity-75 hover:opacity-100 transition-opacity">
            {[...items, ...items, ...items].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-wider text-[#8B857F] hover:text-[#111111] transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-[#8B857F]" />
                  <span>{item.name}</span>
                  <span className="w-1 h-1 rounded-full bg-[#E4DED8] ml-6" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
