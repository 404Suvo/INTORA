"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Wallet,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Flame,
  Tent,
  BookOpen,
  Gift,
  Cpu,
  Layers,
  Menu,
  X,
} from "lucide-react";
import { MEGA_MENU_DATA } from "@/data/mockData";

interface NavbarProps {
  walletAccount?: string | null;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

export function Navbar({
  walletAccount,
  onConnectWallet,
  onDisconnectWallet,
}: NavbarProps) {
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const truncatedAddress = walletAccount
    ? `${walletAccount.slice(0, 6)}...${walletAccount.slice(-4)}`
    : null;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-200 ${
          isScrolled
            ? "bg-[#EEE9E4]/95 backdrop-blur-md border-b border-[#D8D0C7] shadow-sm shadow-[#111111]/5"
            : "bg-[#EEE9E4]/90 backdrop-blur-md border-b border-[#E4DED8]"
        }`}
      >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6 lg:gap-10">
        {/* Left: Wordmark & Pill Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="group flex items-center gap-3">
            <img
              src="/intora-logo.png"
              alt="Intora Logo"
              className="w-11 h-11 rounded-2xl object-cover shadow-xs border border-[#E4DED8] transition-transform group-hover:scale-105"
            />
            <span className="font-serif-headline text-3xl font-medium tracking-tight text-[#111111] group-hover:text-black transition">
              Intora
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase bg-white border border-[#E4DED8] text-[#8B857F] shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45]" />
              AI Agent
            </span>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2.5 text-[13px] xl:text-sm font-medium text-[#111111] px-2.5 py-1.5 rounded-full bg-white/50 border border-[#E4DED8]/80 shadow-xs">
          <a
            href="#how-it-works"
            className="px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap"
          >
            How it works
          </a>

          {/* Mega-menu trigger for Use Cases */}
          <div
            className="relative"
            onMouseEnter={() => setMegaMenuOpen(true)}
            onMouseLeave={() => setMegaMenuOpen(false)}
          >
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap cursor-pointer"
              aria-expanded={megaMenuOpen}
            >
              <span>Use cases</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  megaMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* 4-Column Mega-Menu Dropdown */}
            <AnimatePresence>
              {megaMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute top-full -left-48 w-[840px] bg-white rounded-[28px] border border-[#E4DED8] shadow-editorial-elevated p-7 z-50 mt-3"
                >
                  <div className="grid grid-cols-4 gap-6">
                    {/* Column 1: Outdoor */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                        <Tent className="w-3.5 h-3.5 text-[#F4A28C]" />
                        <span>Outdoor & Adventure</span>
                      </div>
                      <a
                        href="#use-cases"
                        onClick={() => setMegaMenuOpen(false)}
                        className="block p-2.5 rounded-2xl hover:bg-[#F7F4F1] transition group"
                      >
                        <div className="text-sm font-medium text-[#111111] group-hover:text-black">
                          Western Ghats Trek
                        </div>
                        <div className="text-xs text-[#8B857F] mt-0.5 line-clamp-2">
                          Monsoon rain ponchos, trail hydration & dry sacks under ₹4.5k.
                        </div>
                      </a>
                      <a
                        href="#use-cases"
                        onClick={() => setMegaMenuOpen(false)}
                        className="block p-2.5 rounded-2xl hover:bg-[#F7F4F1] transition group"
                      >
                        <div className="text-sm font-medium text-[#111111] group-hover:text-black">
                          Himalayan Base Camp
                        </div>
                        <div className="text-xs text-[#8B857F] mt-0.5 line-clamp-2">
                          Thermal layers, UV eyewear & high-calorie energy rations.
                        </div>
                      </a>
                    </div>

                    {/* Column 2: Campus */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                        <BookOpen className="w-3.5 h-3.5 text-[#1F4D45]" />
                        <span>Campus & Student</span>
                      </div>
                      <a
                        href="#use-cases"
                        onClick={() => setMegaMenuOpen(false)}
                        className="block p-2.5 rounded-2xl hover:bg-[#F7F4F1] transition group"
                      >
                        <div className="text-sm font-medium text-[#111111] group-hover:text-black">
                          College Cultural Fest
                        </div>
                        <div className="text-xs text-[#8B857F] mt-0.5 line-clamp-2">
                          All-day hydration, backup power banks & registration pads under ₹3k.
                        </div>
                      </a>
                      <a
                        href="#use-cases"
                        onClick={() => setMegaMenuOpen(false)}
                        className="block p-2.5 rounded-2xl hover:bg-[#F7F4F1] transition group"
                      >
                        <div className="text-sm font-medium text-[#111111] group-hover:text-black">
                          Hostel Move-In Day
                        </div>
                        <div className="text-xs text-[#8B857F] mt-0.5 line-clamp-2">
                          Bedding organizers, study LED clamp lamps & spike busters.
                        </div>
                      </a>
                    </div>

                    {/* Column 3: Festive */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                        <Gift className="w-3.5 h-3.5 text-[#F4A28C]" />
                        <span>Gifts & Celebrations</span>
                      </div>
                      <a
                        href="#use-cases"
                        onClick={() => setMegaMenuOpen(false)}
                        className="block p-2.5 rounded-2xl hover:bg-[#F7F4F1] transition group"
                      >
                        <div className="text-sm font-medium text-[#111111] group-hover:text-black">
                          Diwali Family Hampers
                        </div>
                        <div className="text-xs text-[#8B857F] mt-0.5 line-clamp-2">
                          Brass oil diyas, organic dry fruits & handmade greeting cards.
                        </div>
                      </a>
                      <a
                        href="#use-cases"
                        onClick={() => setMegaMenuOpen(false)}
                        className="block p-2.5 rounded-2xl hover:bg-[#F7F4F1] transition group"
                      >
                        <div className="text-sm font-medium text-[#111111] group-hover:text-black">
                          Housewarming Kit
                        </div>
                        <div className="text-xs text-[#8B857F] mt-0.5 line-clamp-2">
                          Scented soy candles, ceramic coasters & artisanal teas.
                        </div>
                      </a>
                    </div>

                    {/* Column 4: Featured Card */}
                    <div className="bg-[#F7F4F1] border border-[#E4DED8] rounded-2xl p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#1F4D45]/10 text-[#1F4D45]">
                          Case Study
                        </div>
                        <h4 className="text-sm font-medium text-[#111111] mt-2">
                          Kolkata 3-Day Fest Plan
                        </h4>
                        <p className="text-xs text-[#8B857F] mt-1">
                          Curated 6 items strictly under ₹3,000, verified on Base Sepolia.
                        </p>
                      </div>
                      <a
                        href="#demo"
                        onClick={() => setMegaMenuOpen(false)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111111] hover:text-[#1F4D45] pt-2"
                      >
                        <span>Inspect Plan</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <a
            href="#demo"
            className="px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap"
          >
            Demo
          </a>
          <Link
            href="/planner"
            className="px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap"
          >
            Workspace
          </Link>
          <a
            href="#verification"
            className="px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap"
          >
            Verification
          </a>
          <a
            href="#faq"
            className="px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap"
          >
            FAQ
          </a>
          <Link
            href="/history"
            className="px-3 py-1.5 rounded-full text-[#736D67] hover:text-[#111111] hover:bg-white transition-all whitespace-nowrap"
          >
            On-Chain Explorer
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Connect Wallet Pill */}
          {walletAccount ? (
            <div className="relative">
              <button
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition shadow-sm cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-[#1F4D45] animate-pulse" />
                <span>{truncatedAddress}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1F4D45]/10 text-[#1F4D45]">
                  Base Sepolia
                </span>
              </button>

              {walletDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-[#E4DED8] shadow-editorial-card p-2 z-50">
                  <div className="px-3 py-2 text-xs text-[#8B857F] border-b border-[#E4DED8]">
                    Connected Account
                  </div>
                  <button
                    onClick={() => {
                      onDisconnectWallet?.();
                      setWalletDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-[#F7F4F1] rounded-xl transition"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition shadow-sm cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 text-[#8B857F]" />
              <span>Connect Wallet</span>
            </button>
          )}

          {/* Try Demo Black Pill */}
          <a
            href="#demo"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-[#111111] text-white hover:bg-black/85 transition shadow-sm cursor-pointer"
          >
            <span>Try Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-[#E4DED8] px-6 py-5 shadow-editorial-elevated overflow-hidden"
          >
            <div className="flex flex-col gap-3 text-sm font-medium">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                How it works
              </a>
              <a
                href="#use-cases"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                Use cases
              </a>
              <a
                href="#demo"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                Interactive Demo
              </a>
              <Link
                href="/planner"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                Workspace Planner
              </Link>
              <a
                href="#verification"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                Blockchain Verification
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                FAQ
              </a>
              <Link
                href="/history"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8B857F] hover:text-[#111111] transition"
              >
                On-Chain Explorer
              </Link>
              <div className="pt-2">
                <a
                  href="#demo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 transition shadow-sm"
                >
                  <span>Start Planning</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    {/* Permanent spacer preserving layout height so document flow doesn't jump */}
    <div className="h-20 w-full shrink-0 pointer-events-none" aria-hidden="true" />
  </>
);
}
