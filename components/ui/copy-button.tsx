"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  label?: string;
  timeout?: number;
}

export function CopyButton({
  value,
  label = "Copy",
  timeout = 2000,
  className,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), timeout);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    },
    [value, timeout]
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded border transition-colors",
        hasCopied
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
          : "border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground",
        className
      )}
      title={hasCopied ? "Copied!" : `Copy ${label}`}
      aria-label={hasCopied ? "Copied to clipboard" : `Copy ${label} to clipboard`}
      {...props}
    >
      {hasCopied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
