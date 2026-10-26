"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/editorial/Navbar";
import { Hero } from "@/components/editorial/Hero";
import { TrustStrip } from "@/components/editorial/TrustStrip";
import { HowItWorks } from "@/components/editorial/HowItWorks";
import { LivePlannerDemo } from "@/components/editorial/LivePlannerDemo";
import { BlockchainVerification } from "@/components/editorial/BlockchainVerification";
import { UseCasesBento } from "@/components/editorial/UseCasesBento";
import { StatsGrid } from "@/components/editorial/StatsGrid";
import { FaqSection } from "@/components/editorial/FaqSection";
import { FinalCtaBand } from "@/components/editorial/FinalCtaBand";
import { Footer } from "@/components/editorial/Footer";
import { FloatingChat } from "@/components/editorial/FloatingChat";
import { TransactionApprovalModal } from "@/components/editorial/TransactionApprovalModal";
import { ShoppingPlanData, MOCK_PLANS } from "@/data/mockData";
import { connectWallet } from "@/lib/stubs";

export default function Home() {
  // Wallet State
  const [walletAccount, setWalletAccount] = useState<string | null>(null);

  // Active Plan & Modal State for On-Chain Commitments
  const [activePlan, setActivePlan] = useState<ShoppingPlanData | null>(
    MOCK_PLANS["college-fest"]
  );
  const [activePlanHash, setActivePlanHash] = useState<string | null>(
    MOCK_PLANS["college-fest"].planHash
  );
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // Cross-component prompt coordination (Hero -> Live Demo)
  const [activePrompt, setActivePrompt] = useState<string>("");
  const [activeBudget, setActiveBudget] = useState<number>(3000);

  // Wallet Connection Handler
  const handleConnectWallet = async () => {
    try {
      const { address } = await connectWallet();
      setWalletAccount(address);
    } catch (err: any) {
      console.warn("Wallet connect note:", err.message);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAccount(null);
  };

  // Called when user selects a prompt chip in Hero or Bento
  const handleSelectPrompt = (prompt: string, budget: number) => {
    setActivePrompt(prompt);
    setActiveBudget(budget);
  };

  // Called when user clicks "Approve Plan & Record on Chain" in Demo
  const handleApproveAndRecord = (plan: ShoppingPlanData, hash: string) => {
    setActivePlan(plan);
    setActivePlanHash(hash);
    setIsApprovalModalOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-[#EEE9E4] text-[#111111] font-editorial-sans selection:bg-[#F4A28C]/30 selection:text-[#111111] overflow-x-clip">
      {/* 1. Sticky Editorial Navbar with 4-Column Mega-Menu */}
      <Navbar
        walletAccount={walletAccount}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
      />

      {/* 2. Hero Section with Two-Tone Headline, Interactive Prompt Bar & Mockup */}
      <Hero
        onSelectPrompt={handleSelectPrompt}
        onStartPlanning={() => {
          const demo = document.getElementById("demo");
          demo?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {/* 3. Trust / Ecosystem Marquee */}
      <TrustStrip />

      {/* 4. "How It Works" 3-Step Editorial Layout */}
      <HowItWorks />

      {/* 5. Interactive Live Planner Demo (Centerpiece) */}
      <LivePlannerDemo
        externalPrompt={activePrompt}
        externalBudget={activeBudget}
        onApproveAndRecord={handleApproveAndRecord}
        onEditInFullPlanner={(plan) => {
          window.location.href = "/planner";
        }}
      />

      {/* 6. Blockchain Verification Section (Timeline v1-v3, Hash Explorer, Diff) */}
      <BlockchainVerification
        walletAccount={walletAccount}
        onConnectWallet={handleConnectWallet}
      />

      {/* 7. Use Cases Showcase (Bento Grid) */}
      <UseCasesBento onSelectUseCase={handleSelectPrompt} />

      {/* 8. Stats / Proof Numbers (4-Column Minimal Grid) */}
      <StatsGrid />

      {/* 9. FAQ Accordion Section */}
      <FaqSection />

      {/* 10. Final CTA Band + Multi-Column Footer */}
      <FinalCtaBand />
      <Footer />

      {/* 11. Floating Interaction: Peach-to-Lavender Pill + Slide-Over Chat */}
      <FloatingChat
        onPlanCreated={(prompt, budget) => {
          setActivePrompt(prompt);
          setActiveBudget(budget);
        }}
        initialContext={{
          pathname: "/",
          hasPlan: Boolean(activePlan),
          planSummary: activePlan
            ? {
                id: activePlan.id,
                title: activePlan.title,
                situation: activePlan.situation,
                budget: activePlan.budget,
                totalAmount: activePlan.totalAmount,
                remainingAmount: activePlan.remainingAmount,
                itemCount: activePlan.items?.length || 0,
                version: activePlan.version || 1,
                planHash: activePlan.planHash,
                isBudgetCompliant: activePlan.validation?.budgetCompliant !== false,
              }
            : undefined,
          activeBudget,
          walletAccount,
        }}
      />

      {/* Transaction Approval Modal (MetaMask-style popup) */}
      <TransactionApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        plan={activePlan}
        planHash={activePlanHash}
        walletAccount={walletAccount}
        onWalletConnected={(account) => setWalletAccount(account)}
        onSuccess={(txHash, block) => {
          console.log("Successfully committed on Base Sepolia:", txHash, block);
        }}
      />
    </div>
  );
}
