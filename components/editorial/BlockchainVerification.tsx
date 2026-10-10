"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  CheckCheck,
  Wallet,
  Clock,
  Layers,
  ExternalLink,
  ChevronRight,
  GitCommit,
  GitCompare,
} from "lucide-react";
import { MOCK_VERSION_HISTORY, PlanVersionRecord } from "@/data/mockData";
import { connectWallet } from "@/lib/stubs";

interface BlockchainVerificationProps {
  walletAccount?: string | null;
  onConnectWallet?: () => void;
}

export function BlockchainVerification({
  walletAccount,
  onConnectWallet,
}: BlockchainVerificationProps) {
  const [selectedVersion, setSelectedVersion] = useState<number>(3);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const activeRecord =
    MOCK_VERSION_HISTORY.find((r) => r.version === selectedVersion) ||
    MOCK_VERSION_HISTORY[0];

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (onConnectWallet) {
        onConnectWallet();
      } else {
        await connectWallet();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <section id="verification" className="scroll-mt-24 md:scroll-mt-28 py-24 md:py-32 bg-[#F7F4F1] border-b border-[#E4DED8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white border border-[#E4DED8] text-[#8B857F] mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1F4D45]" />
            <span>Cryptographic Proof</span>
          </div>
          <h2 className="font-serif-headline text-5xl sm:text-6xl text-[#111111] leading-tight mb-4">
            Why record shopping plans{" "}
            <span className="text-[#8B857F] italic font-normal">on the blockchain?</span>
          </h2>
          <p className="font-editorial-sans text-base sm:text-lg text-[#8B857F] leading-relaxed">
            Every approved plan is hashed and committed to Base Sepolia. Prove
            what was planned, when, and for what budget — tamper-proof.
          </p>
        </div>

        {/* 2-Column Explorer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Visual Timeline (v1 -> v2 -> v3) (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-[32px] border border-[#E4DED8] p-6 sm:p-8 shadow-editorial-card space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E4DED8]">
              <div>
                <h3 className="font-serif-headline text-2xl font-medium text-[#111111]">
                  Version Lineage
                </h3>
                <p className="text-xs text-[#8B857F]">
                  Click any revision to inspect on-chain diffs
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1F4D45]/10 text-[#1F4D45]">
                Base Sepolia
              </span>
            </div>

            {/* Timeline Items */}
            <div className="space-y-4">
              {MOCK_VERSION_HISTORY.map((ver) => {
                const isSelected = ver.version === selectedVersion;
                return (
                  <button
                    key={ver.version}
                    onClick={() => setSelectedVersion(ver.version)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#F7F4F1] border-[#1F4D45] shadow-xs"
                        : "bg-white border-[#E4DED8] hover:bg-[#F7F4F1]/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                            isSelected
                              ? "bg-[#1F4D45] text-white"
                              : "bg-[#E4DED8] text-[#111111]"
                          }`}
                        >
                          v{ver.version}
                        </span>
                        <span className="text-xs font-semibold text-[#111111]">
                          {ver.version === 3
                            ? "Approved & Committed"
                            : ver.version === 2
                            ? "Budget Refinement"
                            : "Genesis Draft"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[#8B857F]">
                        {ver.timestamp.split(",")[0]}
                      </span>
                    </div>

                    <p className="text-xs text-[#8B857F] line-clamp-2 mb-2 leading-relaxed">
                      {ver.notes}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#8B857F] pt-2 border-t border-[#E4DED8]/60">
                      <span>Total: ₹{ver.total.toLocaleString("en-IN")}</span>
                      <span>{ver.itemCount} Items</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Connect MetaMask Stub Card */}
            <div className="pt-4 border-t border-[#E4DED8] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-[#8B857F]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#111111]">
                    {walletAccount
                      ? `${walletAccount.slice(0, 6)}...${walletAccount.slice(-4)}`
                      : "MetaMask Disconnected"}
                  </div>
                  <div className="text-[10px] text-[#8B857F]">
                    {walletAccount ? "Ready for Base Sepolia (84532)" : "Connect to record"}
                  </div>
                </div>
              </div>

              {!walletAccount && (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#111111] text-white hover:bg-black/85 transition cursor-pointer"
                >
                  {isConnecting ? "Connecting..." : "Connect MetaMask"}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Hash Explorer & Version Diff (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-[32px] border border-[#E4DED8] p-6 sm:p-8 shadow-editorial-card space-y-6">
            {/* Top Badge: Verified on Base Sepolia with Pulsing Dot */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[#E4DED8]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F4D45] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1F4D45]" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#1F4D45]">
                    Verified on Base Sepolia
                  </span>
                </div>
                <h3 className="font-serif-headline text-3xl font-medium text-[#111111]">
                  Commitment Ledger v{activeRecord.version}
                </h3>
              </div>

              <div className="text-right">
                <div className="text-xs text-[#8B857F]">Block Height</div>
                <div className="font-mono text-sm font-semibold text-[#111111]">
                  #{activeRecord.blockNumber}
                </div>
              </div>
            </div>

            {/* SHA-256 Plan Hash Callout */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                Plan Hash (Keccak-256 / SHA-256)
              </label>
              <div className="flex items-center justify-between bg-[#F7F4F1] p-3.5 rounded-2xl border border-[#E4DED8]">
                <code className="text-xs font-mono text-[#111111] truncate max-w-[420px]">
                  {activeRecord.planHash}
                </code>
                <button
                  onClick={() => handleCopy(activeRecord.planHash)}
                  className="flex items-center gap-1 text-xs text-[#1F4D45] hover:text-[#111111] transition font-medium ml-2 cursor-pointer"
                >
                  {copiedHash ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Transaction Hash */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B857F]">
                Transaction Hash
              </label>
              <div className="flex items-center justify-between bg-[#F7F4F1] p-3.5 rounded-2xl border border-[#E4DED8]">
                <code className="text-xs font-mono text-[#8B857F] truncate max-w-[420px]">
                  {activeRecord.txHash}
                </code>
                <a
                  href={`https://sepolia.basescan.org/tx/${activeRecord.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-[#8B857F] hover:text-[#111111] transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Version Diff View (What Changed Between Versions) */}
            <div className="bg-[#F7F4F1] rounded-2xl p-4 border border-[#E4DED8] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#111111]">
                <GitCompare className="w-4 h-4 text-[#1F4D45]" />
                <span>Version Change Analysis</span>
              </div>

              {activeRecord.version === 3 && (
                <div className="text-xs text-[#8B857F] space-y-2 leading-relaxed">
                  <p>
                    • <strong className="text-[#111111]">Swapped:</strong> Removed ₹900
                    stand-alone noise-isolating earphones in favor of compact power bank +
                    UV umbrella.
                  </p>
                  <p>
                    • <strong className="text-[#111111]">Budget delta:</strong> Reduced total
                    from ₹3,420 to ₹2,890, achieving 100% compliance under ₹3,000 cap.
                  </p>
                  <p>
                    • <strong className="text-[#1F4D45]">Integrity:</strong> Signed and
                    recorded by wallet on Base Sepolia.
                  </p>
                </div>
              )}

              {activeRecord.version === 2 && (
                <div className="text-xs text-[#8B857F] space-y-2 leading-relaxed">
                  <p>
                    • <strong className="text-[#111111]">Refinement:</strong> User added
                    fast-charging power bank for evening concert longevity.
                  </p>
                  <p>
                    • <strong className="text-[#111111]">Budget delta:</strong> Total went
                    from ₹3,950 to ₹3,420.
                  </p>
                </div>
              )}

              {activeRecord.version === 1 && (
                <div className="text-xs text-[#8B857F] space-y-2 leading-relaxed">
                  <p>
                    • <strong className="text-[#111111]">Genesis generation:</strong> Initial
                    unfiltered plan created from natural language prompt.
                  </p>
                  <p>
                    • <strong className="text-[#111111]">Initial Total:</strong> ₹3,950
                    across 8 catalog SKUs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
