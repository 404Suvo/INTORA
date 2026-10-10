"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  History,
  Layers,
  LogOut,
  Menu,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/contract-config";
import { ArchitectureModal } from "./ArchitectureModal";

export type NavView = "landing" | "workspace" | "catalog" | "verification" | "history" | "scene";

interface NavbarProps {
  activeView: NavView;
  setActiveView: (view: NavView) => void;
  walletAccount: string | null;
  walletChainId: number | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onSwitchNetwork: () => void;
  hasActivePlan: boolean;
  activeVersion?: number | null;
  savedIntentsCount: number;
}

export function Navbar({
  activeView,
  setActiveView,
  walletAccount,
  walletChainId,
  onConnectWallet,
  onDisconnectWallet,
  onSwitchNetwork,
  hasActivePlan,
  activeVersion,
  savedIntentsCount,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showArchModal, setShowArchModal] = useState(false);
  const isBaseSepolia = walletChainId === BASE_SEPOLIA_CHAIN_ID;

  const navItems: { id: NavView; label: string; icon: any; badge?: string }[] = [
    { id: "landing", label: "Overview", icon: Compass },
    {
      id: "workspace",
      label: "AI Workspace",
      icon: ShoppingBag,
      badge: hasActivePlan ? `v${activeVersion || 1}` : undefined,
    },
    { id: "catalog", label: "Catalog", icon: Layers, badge: "15 SKUs" },
    {
      id: "verification",
      label: "Verification",
      icon: ShieldCheck,
      badge: hasActivePlan ? "Commitment" : undefined,
    },
    {
      id: "history",
      label: "Saved Plans",
      icon: History,
      badge: savedIntentsCount > 0 ? String(savedIntentsCount) : undefined,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[rgba(223,231,224,0.1)] bg-[#05070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Identity */}
          <div
            onClick={() => setActiveView("landing")}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e0231c] to-[#ff5a3c] text-white font-bold shadow-md shadow-[#e0231c]/30 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 32 32" className="size-5 fill-current">
                <circle cx="16" cy="16" r="7" fill="#ffffff" />
                <rect x="5" y="8" width="22" height="2" fill="#ffffff" />
                <rect x="8" y="12" width="16" height="1.6" fill="#ffffff" />
              </svg>
              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#ff5a3c] border border-[#05070a] animate-ping" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm tracking-wide text-foreground flex items-center gap-2">
                <span className="font-mono text-xs tracking-widest text-[#e0231c] font-bold">影 KAGE</span>
                <span>Intent-to-Commerce</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#e0231c]/15 text-[#ff5a3c] border border-[#e0231c]/30">
                  Base Sepolia
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:block font-light">
                Autonomous commerce intelligence &bull; Kyoto temple 3D aesthetic
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links with Motion Indicator */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-white/[0.06] bg-card/70 p-1.5 backdrop-blur-md shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-pill"
                      className="absolute inset-0 rounded-xl bg-primary/15 border border-primary/30 shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={`relative z-10 size-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="relative z-10">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`relative z-10 ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/[0.08] text-muted-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Section: Architecture Info & Wallet Connection */}
          <div className="flex items-center gap-2">
            {/* Architecture Explainer Modal Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchModal(true)}
              className="hidden lg:flex h-9 rounded-xl border-white/[0.08] hover:border-emerald-500/30 hover:bg-emerald-950/20 text-xs font-medium gap-1.5 text-muted-foreground hover:text-emerald-400"
              title="View Architecture & Verification Rules"
            >
              <BookOpen className="size-3.5" />
              <span>How It Works</span>
            </Button>

            {/* Wallet Status & Connect */}
            {walletAccount ? (
              <div className="flex items-center gap-2">
                {isBaseSepolia ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 font-mono text-[11px]">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Base Sepolia Testnet</span>
                  </div>
                ) : (
                  <button
                    onClick={onSwitchNetwork}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/50 bg-amber-950/40 text-amber-300 font-mono text-[11px] hover:bg-amber-900/60 transition-all shadow-sm shadow-amber-500/20 cursor-pointer animate-pulse"
                    title="Click to trigger MetaMask popup to switch to Base Sepolia Testnet"
                  >
                    <AlertCircle className="size-3.5 text-amber-400" />
                    <span>Switch to Base Sepolia</span>
                  </button>
                )}

                <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-card/80 p-1">
                  <span className="px-2 font-mono text-xs text-foreground">
                    {walletAccount.slice(0, 6)}...{walletAccount.slice(-4)}
                  </span>
                  <button
                    onClick={onDisconnectWallet}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.08] hover:text-destructive transition-colors cursor-pointer"
                    title="Disconnect Wallet"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={onConnectWallet}
                className="h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-background font-semibold text-xs gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                title="Connect MetaMask and switch to Base Sepolia Testnet"
              >
                <Wallet className="size-3.5 text-background" />
                <span>Connect MetaMask (Testnet)</span>
              </Button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden rounded-xl border border-white/[0.08] p-2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/[0.08] bg-[#090B10] px-4 py-4 md:hidden"
            >
              <div className="flex flex-col gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setShowArchModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-950/20"
                >
                  <BookOpen className="size-4" />
                  <span>How It Works (Architecture)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Global Architecture Modal */}
      <ArchitectureModal isOpen={showArchModal} onClose={() => setShowArchModal(false)} />
    </>
  );
}
