"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck, Globe, Code2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#EEE9E4] border-t border-[#E4DED8] pt-16 pb-12 text-[#111111]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-[#E4DED8]">
          {/* Brand Info (2 cols on desktop) */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/intora-logo.png"
                alt="Intora Logo"
                className="w-11 h-11 rounded-2xl object-cover shadow-xs border border-[#E4DED8]"
              />
              <span className="font-serif-headline text-3xl font-medium tracking-tight text-[#111111]">
                Intora
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase bg-white border border-[#E4DED8] text-[#8B857F]">
                AI Agent
              </span>
            </div>
            <p className="font-editorial-sans text-xs sm:text-sm text-[#8B857F] max-w-sm leading-relaxed">
              The intent-first commerce engine that turns real-world scenarios
              into budget-capped, catalog-grounded shopping plans committed on
              Base Sepolia.
            </p>
            <div className="flex items-center gap-3 pt-2 text-[#8B857F]">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center hover:text-[#111111] hover:border-[#111111] transition shadow-2xs"
                title="GitHub"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center hover:text-[#111111] hover:border-[#111111] transition shadow-2xs"
                title="X / Twitter"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://base.org"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center hover:text-[#111111] hover:border-[#111111] transition shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4 text-[#1F4D45]" />
              </a>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
              Product
            </div>
            <ul className="space-y-2 text-xs text-[#8B857F]">
              <li>
                <a href="#demo" className="hover:text-[#111111] transition">
                  Interactive Demo
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#111111] transition">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#use-cases" className="hover:text-[#111111] transition">
                  Use Cases Bento
                </a>
              </li>
              <li>
                <Link href="/planner" className="hover:text-[#111111] transition">
                  Full Planner
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Blockchain */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
              Blockchain
            </div>
            <ul className="space-y-2 text-xs text-[#8B857F]">
              <li>
                <a href="#verification" className="hover:text-[#111111] transition">
                  On-Chain Verification
                </a>
              </li>
              <li>
                <Link href="/history" className="hover:text-[#111111] transition">
                  On-Chain Explorer
                </Link>
              </li>
              <li>
                <a
                  href="https://sepolia.basescan.org"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#111111] transition"
                >
                  Base Sepolia Scan
                </a>
              </li>
              <li>
                <span className="text-[11px] font-mono text-[#8B857F]">
                  Chain ID: 84532
                </span>
              </li>
            </ul>
          </div>

          {/* Column 3: Developers & Legal */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
              Developers
            </div>
            <ul className="space-y-2 text-xs text-[#8B857F]">
              <li>
                <span className="text-[#111111]">Google Gemini 2.5</span>
              </li>
              <li>
                <span className="text-[#111111]">MetaMask EIP-1193</span>
              </li>
              <li>
                <span className="text-[#111111]">Viem & Hardhat</span>
              </li>
              <li>
                <a href="#faq" className="hover:text-[#111111] transition">
                  Developer FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8B857F] gap-4">
          <div>
            &copy; {new Date().getFullYear()} Intora AI Agent. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Built with React + Tailwind + Framer Motion</span>
            <span>All prices in Indian Rupees (₹)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
