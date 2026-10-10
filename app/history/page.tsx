"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Copy,
  CheckCheck,
  ExternalLink,
  Layers,
  Clock,
  Sparkles,
  Search,
  Filter,
  X,
} from "lucide-react";
import { MOCK_VERSION_HISTORY, PlanVersionRecord } from "@/data/mockData";

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState<PlanVersionRecord[]>(MOCK_VERSION_HISTORY);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<PlanVersionRecord | null>(null);

  // Load any newly committed plans saved during current session
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedRaw = localStorage.getItem("intora_committed_plans");
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          if (Array.isArray(stored) && stored.length > 0) {
            // Deduplicate by txHash
            const existingHashes = new Set(stored.map((s: any) => s.txHash));
            const merged = [
              ...stored,
              ...MOCK_VERSION_HISTORY.filter((m) => !existingHashes.has(m.txHash)),
            ];
            setHistoryList(merged);
          }
        }
      } catch (err) {
        console.warn("Could not load user commitments:", err);
      }
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const filteredHistory = historyList.filter(
    (item) =>
      item.situation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.planHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.txHash.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalVerifiedVolume = historyList.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="min-h-screen bg-[#EEE9E4] text-[#111111] font-editorial-sans pattern-dots">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#EEE9E4]/90 backdrop-blur-md border-b border-[#E4DED8] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E4DED8] text-xs font-semibold text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <img
                src="/intora-logo.png"
                alt="Intora Logo"
                className="w-9 h-9 rounded-xl object-cover border border-[#E4DED8]"
              />
              <h1 className="font-serif-headline text-2xl font-medium text-[#111111]">
                Intora On-Chain Explorer
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1F4D45]/10 text-[#1F4D45]">
                Base Sepolia (84532)
              </span>
            </div>
          </div>

          <Link
            href="/planner"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 transition shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F4A28C]" />
            <span>New Shopping Plan</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        {/* Editorial Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#E4DED8] shadow-editorial-card">
            <div className="text-xs text-[#8B857F] uppercase tracking-wider font-semibold">
              Total Plans Committed
            </div>
            <div className="font-serif-headline text-4xl font-bold text-[#111111] mt-1">
              {historyList.length}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E4DED8] shadow-editorial-card">
            <div className="text-xs text-[#8B857F] uppercase tracking-wider font-semibold">
              Verified Volume
            </div>
            <div className="font-serif-headline text-4xl font-bold text-[#111111] mt-1">
              ₹{totalVerifiedVolume.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E4DED8] shadow-editorial-card">
            <div className="text-xs text-[#8B857F] uppercase tracking-wider font-semibold">
              Average Gas Cost
            </div>
            <div className="font-serif-headline text-4xl font-bold text-[#1F4D45] mt-1">
              ₹0.00
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E4DED8] shadow-editorial-card">
            <div className="text-xs text-[#8B857F] uppercase tracking-wider font-semibold">
              Network Target
            </div>
            <div className="font-serif-headline text-2xl font-bold text-[#111111] mt-2 truncate">
              Base Sepolia (L2)
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E4DED8] shadow-editorial-card">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-[#8B857F] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by situation keyword, tx hash, or plan hash..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-[#F7F4F1] border border-[#E4DED8] rounded-full text-[#111111] focus:outline-none focus:border-[#F4A28C]"
            />
          </div>

          <div className="text-xs text-[#8B857F]">
            Showing <strong>{filteredHistory.length}</strong> verified commitments
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-[32px] border border-[#E4DED8] overflow-hidden shadow-editorial-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4F1] border-b border-[#E4DED8] text-[#8B857F] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-4 px-6">Version</th>
                  <th className="py-4 px-6">Situation / Title</th>
                  <th className="py-4 px-6">Budget Cap</th>
                  <th className="py-4 px-6">Committed Total</th>
                  <th className="py-4 px-6">Plan Hash</th>
                  <th className="py-4 px-6">Transaction Hash</th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DED8]">
                {filteredHistory.map((row) => (
                  <tr
                    key={`${row.txHash}_${row.version}`}
                    onClick={() => setSelectedRecord(row)}
                    className="hover:bg-[#F7F4F1]/60 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6 font-mono font-semibold text-[#111111]">
                      <span className="px-2 py-0.5 rounded-full bg-[#1F4D45]/10 text-[#1F4D45]">
                        v{row.version}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-[#111111] max-w-xs truncate">
                      {row.situation}
                    </td>
                    <td className="py-4 px-6 text-[#8B857F]">
                      ₹{row.budget.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 font-semibold text-[#111111]">
                      ₹{row.total.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 font-mono text-[#8B857F]">
                      <div className="flex items-center gap-1.5">
                        <span>
                          {row.planHash.slice(0, 6)}...{row.planHash.slice(-4)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(row.planHash, `p-${row.version}-${row.txHash}`);
                          }}
                          className="hover:text-[#111111] cursor-pointer"
                        >
                          {copiedTx === `p-${row.version}-${row.txHash}` ? (
                            <CheckCheck className="w-3 h-3 text-[#1F4D45]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-[#8B857F]">
                      <div className="flex items-center gap-1.5">
                        <span>
                          {row.txHash.slice(0, 6)}...{row.txHash.slice(-4)}
                        </span>
                        <a
                          href={`https://sepolia.basescan.org/tx/${row.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-[#111111]"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#8B857F] whitespace-nowrap">
                      {row.timestamp}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#E8F0EE] text-[#1F4D45]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45]" />
                        Block #{row.blockNumber}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Selected Record Detail Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-[32px] border border-[#E4DED8] shadow-editorial-elevated p-6 sm:p-8 relative">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#E8F0EE] flex items-center justify-center text-[#1F4D45]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif-headline text-2xl font-medium text-[#111111]">
                  Commitment Details (v{selectedRecord.version})
                </h3>
                <p className="text-xs text-[#8B857F]">
                  Recorded on Base Sepolia Testnet (84532)
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] space-y-2">
                <div>
                  <span className="text-[#8B857F] block">Situation / Event:</span>
                  <span className="font-medium text-[#111111]">{selectedRecord.situation}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E4DED8]">
                  <span>
                    <strong className="text-[#8B857F]">Budget Cap: </strong>
                    ₹{selectedRecord.budget.toLocaleString("en-IN")}
                  </span>
                  <span>
                    <strong className="text-[#8B857F]">Committed: </strong>
                    <strong className="text-[#1F4D45]">₹{selectedRecord.total.toLocaleString("en-IN")}</strong>
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#8B857F] block mb-1 font-semibold uppercase tracking-wider text-[11px]">
                  Canonical Plan Hash (Keccak-256)
                </span>
                <code className="p-3 bg-[#F7F4F1] rounded-2xl border border-[#E4DED8] font-mono text-[11px] text-[#111111] block break-all">
                  {selectedRecord.planHash}
                </code>
              </div>

              <div>
                <span className="text-[#8B857F] block mb-1 font-semibold uppercase tracking-wider text-[11px]">
                  Transaction Hash
                </span>
                <code className="p-3 bg-[#F7F4F1] rounded-2xl border border-[#E4DED8] font-mono text-[11px] text-[#111111] block break-all">
                  {selectedRecord.txHash}
                </code>
              </div>

              <div className="flex justify-between items-center p-3 bg-white border border-[#E4DED8] rounded-2xl">
                <span>Block #{selectedRecord.blockNumber}</span>
                <span>{selectedRecord.timestamp}</span>
                <span className="text-[#1F4D45] font-semibold">Verified ✅</span>
              </div>

              <div className="pt-2 flex gap-3">
                <a
                  href={`https://sepolia.basescan.org/tx/${selectedRecord.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-full text-center text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>View on BaseScan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
