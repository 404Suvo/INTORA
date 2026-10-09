"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  History,
  Layers,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/catalog";
import { StoredPlanRecord } from "@/lib/types";

interface VerificationPanelProps {
  intentId: `0x${string}`;
  currentVersion: number;
  userWallet: string | null;
  onSelectVersion?: (version: number) => void;
}

export function VerificationPanel({
  intentId,
  currentVersion,
  userWallet,
  onSelectVersion,
}: VerificationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [allVersions, setAllVersions] = useState<StoredPlanRecord[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);

  async function fetchVerification(ver: number) {
    setLoading(true);
    try {
      // 1. Fetch off-chain records and all versions
      const planRes = await fetch(`/api/plan?intentId=${intentId}`);
      if (planRes.ok) {
        const planData = await planRes.json();
        setAllVersions(planData.versions || []);
      }

      // 2. Fetch on-chain verification
      const intentRes = await fetch(`/api/intent?intentId=${intentId}&version=${ver}`);
      if (intentRes.ok) {
        const intentData = await intentRes.json();
        setData(intentData);
      }
    } catch (err) {
      console.error("Verification query error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedVersion(currentVersion);
    fetchVerification(currentVersion);
  }, [intentId, currentVersion]);

  function handleVersionSwitch(v: number) {
    setSelectedVersion(v);
    fetchVerification(v);
    onSelectVersion?.(v);
  }

  const onChain = data?.onChain;
  const offChain = data?.offChainStored;
  const match = data?.hashMatch;
  const isAvailable = data?.onChainAvailable;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h3 className="font-bold text-base tracking-tight uppercase">
            Cryptographic Verification Panel
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchVerification(selectedVersion)}
          disabled={loading}
          className="h-7 text-xs font-mono"
        >
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh On-Chain State
        </Button>
      </div>

      {/* Version Selector Tabs */}
      {allVersions.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <History className="size-3.5" /> Versions:
          </span>
          {allVersions.map((rec) => (
            <Button
              key={rec.version}
              size="sm"
              variant={selectedVersion === rec.version ? "default" : "outline"}
              onClick={() => handleVersionSwitch(rec.version)}
              className="h-7 text-xs font-mono"
            >
              v{rec.version} {rec.version === currentVersion ? "(Latest)" : ""}
            </Button>
          ))}
        </div>
      )}

      {/* Verification Result Badge */}
      <div
        className={`flex items-center justify-between p-3 rounded-lg border text-xs font-semibold ${
          match
            ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
            : isAvailable
              ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
              : "bg-muted border-border/50 text-muted-foreground"
        }`}
      >
        <div className="flex items-center gap-2">
          {match ? (
            <CheckCircle2 className="size-5 text-emerald-400" />
          ) : isAvailable ? (
            <XCircle className="size-5 text-rose-500" />
          ) : (
            <Layers className="size-5 text-muted-foreground" />
          )}
          <div>
            <div className="font-bold text-sm">
              {match
                ? "ON-CHAIN COMMITMENT VERIFIED (PASS ✅)"
                : isAvailable
                  ? "CRITICAL HASH MISMATCH (FAIL ❌)"
                  : "NOT YET COMMITTED ON-CHAIN"}
            </div>
            <div className="text-[11px] font-normal opacity-90">
              {match
                ? "The on-chain keccak256 hash precisely matches the recomputed canonical plan hash."
                : isAvailable
                  ? "The hash recorded on Base Sepolia does not match the off-chain stored plan."
                  : "This plan version is prepared locally and awaiting MetaMask commitment recording."}
            </div>
          </div>
        </div>

        <Badge variant={match ? "default" : "outline"} className="font-mono text-xs">
          Version {selectedVersion}
        </Badge>
      </div>

      {/* Detailed Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono bg-background p-3.5 rounded-lg border border-border/60">
        <div>
          <span className="text-muted-foreground block text-[11px]">Intent ID:</span>
          <span className="text-foreground break-all">{intentId}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Network:</span>
          <span className="text-foreground">Base Sepolia (Chain ID: 84532)</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Target Contract:</span>
          <span className="text-foreground break-all">{data?.contractAddress || "Configured Contract"}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Signer Wallet:</span>
          <span className="text-foreground">
            {onChain?.owner ? (
              <span className="text-primary">{onChain.owner}</span>
            ) : userWallet ? (
              <span className="text-muted-foreground">{userWallet} (Ready to sign)</span>
            ) : (
              "None connected"
            )}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">On-Chain Hash:</span>
          <span className="text-foreground break-all">
            {onChain?.planHash || "Awaiting transaction"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[11px]">Off-Chain Canonical Hash:</span>
          <span className="text-primary break-all font-semibold">
            {offChain?.planHash || "N/A"}
          </span>
        </div>
        {onChain?.expiry && (
          <div>
            <span className="text-muted-foreground block text-[11px]">On-Chain Expiry:</span>
            <span className="text-foreground">
              {new Date(onChain.expiry * 1000).toLocaleString()}
            </span>
          </div>
        )}
        {onChain?.isValid !== undefined && (
          <div>
            <span className="text-muted-foreground block text-[11px]">Commitment Validity:</span>
            <span className={onChain.isValid ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {onChain.isValid ? "ACTIVE & UNEXPIRED" : "EXPIRED / INACTIVE"}
            </span>
          </div>
        )}
      </div>

      {/* Explorer Link */}
      {data?.contractAddress && data.contractAddress !== "0x0000000000000000000000000000000000000000" && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <span>View contract on Basescan:</span>
          <a
            href={`https://sepolia.basescan.org/address/${data.contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
          >
            Basescan Explorer <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </div>
  );
}
