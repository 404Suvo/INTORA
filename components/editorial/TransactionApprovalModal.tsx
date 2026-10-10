"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wallet,
  ArrowRight,
  Flame,
} from "lucide-react";
import { ShoppingPlanData } from "@/data/mockData";
import { recordPlanOnChain, recordPlanSandbox } from "@/lib/stubs";

interface TransactionApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ShoppingPlanData | null;
  planHash: string | null;
  walletAccount: string | null;
  onSuccess?: (txHash: string, blockNumber: number) => void;
  onWalletConnected?: (address: string) => void;
}

export function TransactionApprovalModal({
  isOpen,
  onClose,
  plan,
  planHash,
  walletAccount,
  onSuccess,
  onWalletConnected,
}: TransactionApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{ txHash: string; blockNumber: number } | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRejected, setIsRejected] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(walletAccount);
  const [activeChainId, setActiveChainId] = useState<number | null>(null);
  const hasPromptedRef = React.useRef(false);

  // Sync connected wallet when prop changes
  React.useEffect(() => {
    if (walletAccount) {
      setConnectedWallet(walletAccount);
    }
  }, [walletAccount]);

  const hashToDisplay =
    planHash ||
    plan?.planHash ||
    "0x7a3f81e4b9c02d76f1839a5c8e2b4f91048a6d7c3e5a1b9f8d2c4e6a0b1c3e5d";

  // Core function to trigger live MetaMask pop up and take permission
  const handleConfirmMetaMask = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setIsRejected(false);
    try {
      const version = plan?.version || 1;
      const result = await recordPlanOnChain(hashToDisplay, version, plan);
      setTxResult(result);
      if (result.account) {
        setConnectedWallet(result.account);
        onWalletConnected?.(result.account);
      }
      onSuccess?.(result.txHash, result.blockNumber);
    } catch (err: any) {
      const msg = err.message || "Failed to submit transaction.";
      if (
        msg.includes("rejected") ||
        msg.includes("denied") ||
        msg.includes("canceled") ||
        err.code === 4001
      ) {
        setIsRejected(true);
        setErrorMessage(
          "MetaMask Permission Denied: You declined the request in MetaMask. No record was committed to the blockchain."
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback sandbox simulation if user doesn't have MetaMask or testnet gas
  const handleConfirmSandbox = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setIsRejected(false);
    try {
      const version = plan?.version || 1;
      const result = await recordPlanSandbox(hashToDisplay, version, plan);
      setTxResult(result);
      if (result.account) {
        setConnectedWallet(result.account);
      }
      onSuccess?.(result.txHash, result.blockNumber);
    } catch (err: any) {
      setErrorMessage(err.message || "Sandbox simulation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check active MetaMask account and chain silently when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTxResult(null);
      setErrorMessage(null);
      setIsRejected(false);
      setIsSubmitting(false);

      if (typeof window !== "undefined" && (window as any).ethereum) {
        const eth = (window as any).ethereum;
        // Check already connected accounts silently (does not open pop up)
        eth
          .request({ method: "eth_accounts" })
          .then((accounts: string[]) => {
            if (accounts && accounts.length > 0) {
              setConnectedWallet(accounts[0]);
            }
          })
          .catch(() => {});

        // Check active chain silently (does not open pop up)
        eth
          .request({ method: "eth_chainId" })
          .then((hex: string) => setActiveChainId(parseInt(hex, 16)))
          .catch(() => {});
      }
    } else {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-white rounded-[32px] border border-[#E4DED8] shadow-editorial-elevated p-6 sm:p-8 relative overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#E8F0EE] border border-[#1F4D45]/20 flex items-center justify-center text-[#1F4D45]">
            <ShieldCheck className="w-6 h-6 text-[#1F4D45]" />
          </div>
          <div>
            <h3 className="font-serif-headline text-2xl font-medium text-[#111111]">
              Record Plan Commitment
            </h3>
            <p className="text-xs text-[#8B857F]">
              Commit SHA-256 fingerprint on Base Sepolia Testnet (84532)
            </p>
          </div>
        </div>

        {txResult ? (
          /* Transaction Succeeded View */
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#E8F0EE] text-[#1F4D45] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#1F4D45]" />
            </div>
            <div>
              <h4 className="font-serif-headline text-2xl font-medium text-[#111111]">
                Plan Recorded On-Chain
              </h4>
              <p className="text-xs text-[#8B857F] mt-1">
                Your shopping plan is now permanently timestamped and cryptographically verified.
              </p>
            </div>

            <div className="bg-[#F7F4F1] p-4 rounded-2xl border border-[#E4DED8] text-left text-xs font-mono space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#8B857F]">Tx Hash: </span>
                <a
                  href={`https://sepolia.basescan.org/tx/${txResult.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#1F4D45] hover:underline"
                >
                  <span className="truncate max-w-[200px]">{txResult.txHash}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <span className="text-[#8B857F]">Block: </span>
                <span className="text-[#111111]">#{txResult.blockNumber}</span>
              </div>
              <div>
                <span className="text-[#8B857F]">Network: </span>
                <span className="text-[#1F4D45]">Base Sepolia (Chain ID 84532)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-1/2 py-3.5 rounded-full text-xs font-semibold bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition shadow-xs cursor-pointer"
              >
                Close
              </button>
              <a
                href="/history"
                className="w-1/2 py-3.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white hover:bg-black/85 transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View in Explorer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          /* Approval Details View */
          <div className="space-y-6">
            {/* Plan Info Card */}
            <div className="p-4 rounded-2xl bg-[#F7F4F1] border border-[#E4DED8] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8B857F]">Intent Title:</span>
                <span className="font-medium text-[#111111]">{plan?.title || "Shopping Intent"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8B857F]">Approved Budget:</span>
                <span className="font-medium text-[#111111]">
                  ₹{plan?.totalAmount.toLocaleString("en-IN") || "2,890"} / ₹{plan?.budget.toLocaleString("en-IN") || "3,000"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8B857F]">Plan Version:</span>
                <span className="px-2 py-0.5 rounded bg-white border border-[#E4DED8] font-mono text-[11px]">
                  v{plan?.version || 1}
                </span>
              </div>
            </div>

            {/* Cryptographic SHA-256 Hash */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8B857F] mb-1.5">
                Canonical SHA-256 Hash
              </label>
              <div className="p-3 bg-[#F7F4F1] rounded-2xl border border-[#E4DED8] font-mono text-xs text-[#111111] break-all">
                {hashToDisplay}
              </div>
              <p className="text-[11px] text-[#8B857F] mt-1">
                Only this 32-byte hash is recorded on-chain. Your private shopping items stay local.
              </p>
            </div>

            {/* Estimated Gas & Signer */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E4DED8] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#8B857F]">Signing Wallet:</span>
                <span className="font-mono text-[#111111]">
                  {connectedWallet
                    ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
                    : "MetaMask (Base Sepolia Testnet)"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8B857F]">Estimated Gas Fee:</span>
                <span className="font-medium text-[#111111]">0.000042 ETH (~₹11.20)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8B857F]">Target Network:</span>
                <span className="inline-flex items-center gap-1.5 text-[#1F4D45] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45]" />
                  Base Sepolia Testnet (84532)
                </span>
              </div>
              {activeChainId && activeChainId !== 84532 && (
                <div className="flex justify-between items-center pt-1 border-t border-[#E4DED8]/60 text-amber-700">
                  <span>Current MetaMask Chain:</span>
                  <span className="font-mono">ID {activeChainId} (Switch Required)</span>
                </div>
              )}
            </div>

            {/* Active MetaMask Pop Up Status Banner */}
            {isSubmitting && (
              <div className="p-4 rounded-2xl bg-[#E8F0EE] border border-[#1F4D45]/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F4D45] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1F4D45]" />
                  </div>
                  <span className="text-xs font-semibold text-[#1F4D45] uppercase tracking-wider">
                    MetaMask Testnet Pop Up Active
                  </span>
                </div>
                <p className="text-xs text-[#1F4D45]/90 leading-relaxed">
                  Please review the prompt in your MetaMask pop up window. Authorize switching to <strong>Base Sepolia Testnet (84532)</strong> and confirm transaction permissions before anything is recorded on-chain.
                </p>
              </div>
            )}

            {/* User Rejection Alert */}
            {isRejected && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Permission Denied in MetaMask</span>
                </div>
                <p className="text-amber-700 leading-relaxed">
                  You canceled or rejected the transaction in MetaMask. The transaction was stopped, and no changes were made on Base Sepolia testnet.
                </p>
              </div>
            )}

            {/* General Error Message */}
            {errorMessage && !isRejected && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="break-words">{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 rounded-full text-xs font-semibold bg-white border border-[#E4DED8] text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMetaMask}
                  disabled={isSubmitting}
                  className="w-2/3 py-3.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#1F4D45] text-white hover:bg-[#163a34] disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Opening MetaMask...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>CONFIRM & COMMIT HASH</span>
                    </>
                  )}
                </button>
              </div>

              {/* Faucet Link & Sandbox Fallback */}
              <div className="flex items-center justify-between text-[11px] text-[#8B857F] pt-1 px-1">
                <a
                  href="https://faucets.chain.link/base-sepolia"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#111111] underline transition flex items-center gap-1"
                >
                  <span>Need Base Sepolia testnet ETH?</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={handleConfirmSandbox}
                  disabled={isSubmitting}
                  className="hover:text-[#111111] underline transition cursor-pointer"
                >
                  Sandbox Mode
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
