"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface IntentHistoryProps {
  onSelectIntent: (intentId: string) => void;
  activeIntentId?: string | null;
}

export function IntentHistory({ onSelectIntent, activeIntentId }: IntentHistoryProps) {
  const [intents, setIntents] = useState<{ intentId: string; latestVersion: number; updatedAt: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadIntents() {
    setLoading(true);
    try {
      const res = await fetch("/api/plan");
      if (res.ok) {
        const data = await res.json();
        setIntents(data.intents || []);
      }
    } catch (err) {
      console.error("Failed to load intents history", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntents();
  }, [activeIntentId]);

  if (intents.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h4 className="font-semibold text-xs uppercase tracking-wider">Saved Intent History</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={loadIntents} disabled={loading} className="h-6 px-1.5 text-xs">
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {intents.map((item) => {
          const isSelected = item.intentId.toLowerCase() === activeIntentId?.toLowerCase();
          return (
            <button
              key={item.intentId}
              onClick={() => onSelectIntent(item.intentId)}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors ${
                isSelected
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-background/60 border-border/60 hover:bg-muted/50 text-foreground"
              }`}
            >
              <div className="flex flex-col">
                <span className="font-mono font-medium">{item.intentId.slice(0, 10)}...{item.intentId.slice(-6)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                v{item.latestVersion}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
