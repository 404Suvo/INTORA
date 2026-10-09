"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { IntentApproval } from "@/components/commerce/IntentApproval";
import { IntentHistory } from "@/components/commerce/IntentHistory";
import { ProductBundle } from "@/components/commerce/ProductBundle";
import { SituationInput } from "@/components/commerce/SituationInput";
import { VerificationPanel } from "@/components/commerce/VerificationPanel";
import { WalletStatus } from "@/components/commerce/WalletStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PlanDiff, PriceMismatch, ShoppingPlan } from "@/lib/types";

type Step = { tool: string; args: unknown; result: any; error?: boolean };
type Message = { role: "user" | "agent"; text: string; steps?: Step[]; error?: boolean };
type Status = { hasApiKey: boolean; model: string; tools: { name: string; description: string }[] };

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  // Intent Planning state
  const [activePlan, setActivePlan] = useState<ShoppingPlan | null>(null);
  const [reviewedPlanHash, setReviewedPlanHash] = useState<`0x${string}` | null>(null);
  const [activeDiff, setActiveDiff] = useState<PlanDiff | null>(null);
  const [priceMismatches, setPriceMismatches] = useState<PriceMismatch[]>([]);
  const [activeIntentId, setActiveIntentId] = useState<`0x${string}` | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then(setStatus)
      .catch((err) => console.error("Failed to load agent status", err));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Extract plan data from agent tool results
  function processAgentSteps(steps?: Step[]) {
    if (!steps) return;
    for (const s of steps) {
      if (s.tool === "prepare_intent" && s.result?.success) {
        const { plan, planHash, diff, intentId, version, priceMismatches: mismatches } = s.result;
        setActivePlan(plan);
        setReviewedPlanHash(planHash);
        setActiveDiff(diff || null);
        setActiveIntentId(intentId);
        setActiveVersion(version);
        if (mismatches) setPriceMismatches(mismatches);
      }
    }
  }

  async function send(text: string) {
    if (!text.trim() || thinking) return;
    const history: Message[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => !m.error)
            .map(({ role, text }) => ({ role, text })),
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        data.error
          ? { role: "agent", text: data.error, error: true }
          : { role: "agent", text: data.answer, steps: data.steps },
      ]);
      processAgentSteps(data.steps);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "Could not reach the server. Is `npm run dev` running?",
          error: true,
        },
      ]);
    }
    setThinking(false);
  }

  async function handlePlanRequest(situationText: string, budget?: number) {
    let prompt = situationText;
    if (activeIntentId) {
      prompt = `For existing intent ${activeIntentId}: ${situationText}`;
    }
    if (budget) {
      prompt += ` with budget of Rs ${budget}`;
    }
    await send(prompt);
  }

  async function handleSelectSavedIntent(selectedId: string) {
    try {
      const res = await fetch(`/api/plan?intentId=${selectedId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.latest) {
          setActivePlan(data.latest.plan);
          setReviewedPlanHash(data.latest.planHash);
          setActiveIntentId(data.latest.intentId);
          setActiveVersion(data.latest.version);
          setActiveDiff(null);
        }
      }
    } catch (err) {
      console.error("Failed to load selected intent:", err);
    }
  }

  const ready = Boolean(status?.hasApiKey);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 px-4 py-6 md:px-10 md:py-10">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>
            <Sparkles className="mr-2 size-4 text-primary" />
            <span className="text-foreground font-bold">Intent-to-Commerce</span>&nbsp;/ Base Sepolia AI Shopping Planner
          </Label>
          <div className="flex items-center gap-2">
            {status && <Label>Gemini Model: {status.model}</Label>}
            <Badge variant="outline" className="border-emerald-600/40 text-emerald-400 bg-emerald-950/20 font-mono text-xs">
              Testnet Only (84532)
            </Badge>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl leading-[0.95] font-bold tracking-tight uppercase md:text-6xl">
              Intent-to-<span className="text-primary">Commerce.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Transform natural-language situations into catalog-verified shopping bundles.
              Approved plans become versioned, cryptographic keccak256 commitments recorded on Base Sepolia.
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 border border-border/50 text-xs max-w-sm">
            <span className="font-semibold text-foreground block mb-0.5">Verified Commitment Guarantee:</span>
            <span className="text-muted-foreground">
              Off-chain canonical JSON is independently verified and hashed. Hash matches on Base Sepolia are validated in real time.
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid: Left Controls (1/3) & Right Planner/Chat (2/3) */}
      <div className="grid flex-1 gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left Column: Wallet, Situation Input, Intent History, Tools */}
        <aside className="flex flex-col gap-5">
          {/* User MetaMask Wallet Connection */}
          <WalletStatus
            account={walletAccount}
            chainId={walletChainId}
            onConnect={(acc, cid) => {
              setWalletAccount(acc);
              setWalletChainId(cid);
            }}
            onDisconnect={() => {
              setWalletAccount(null);
              setWalletChainId(null);
            }}
          />

          {/* Situation & Budget Input */}
          <SituationInput
            onPlanRequest={handlePlanRequest}
            loading={thinking}
            activeIntentId={activeIntentId}
            activeVersion={activeVersion}
          />

          {/* Saved Intent History */}
          <IntentHistory
            onSelectIntent={handleSelectSavedIntent}
            activeIntentId={activeIntentId}
          />

          {/* Controlled Agent Tools */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <SectionTitle num="01" title="Controlled Tools" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 py-3 px-4 max-h-[300px] overflow-y-auto">
              {status?.tools.map((t) => (
                <div key={t.name} className="text-xs">
                  <p className="font-mono text-xs font-semibold text-primary">
                    &gt; {t.name}
                  </p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">{t.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        {/* Right Column: Active Plan, Approval, Verification, and Chat Execution Traces */}
        <div className="flex flex-col gap-6">
          {/* Active Bundle and Approval Section */}
          {activePlan && reviewedPlanHash && (
            <div className="flex flex-col gap-5">
              <ProductBundle
                plan={activePlan}
                diff={activeDiff}
                priceMismatches={priceMismatches}
              />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <IntentApproval
                  plan={activePlan}
                  reviewedPlanHash={reviewedPlanHash}
                  account={walletAccount}
                  chainId={walletChainId}
                  onCommitmentSuccess={() => {
                    // Triggers verification update
                    setActivePlan({ ...activePlan });
                  }}
                />

                <VerificationPanel
                  intentId={activePlan.intentId as `0x${string}`}
                  currentVersion={activePlan.version}
                  userWallet={walletAccount}
                  onSelectVersion={async (v) => {
                    const res = await fetch(`/api/plan?intentId=${activePlan.intentId}&version=${v}`);
                    if (res.ok) {
                      const data = await res.json();
                      setActivePlan(data.plan);
                      setReviewedPlanHash(data.planHash);
                      setActiveVersion(v);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Gemini Agent Planning & Execution Chat */}
          <Card className="flex flex-col">
            <CardHeader className="border-b py-3 px-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                <SectionTitle num="02" title="Agent Planning & Verification Log" />
              </div>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-mono text-xs uppercase"
                  onClick={() => setMessages([])}
                  disabled={messages.length === 0 || thinking}
                >
                  <RotateCcw className="size-3 mr-1" /> Clear
                </Button>
              </CardAction>
            </CardHeader>

            <ScrollArea className="h-[420px]">
              <div className="flex flex-col gap-4 p-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center text-muted-foreground">
                    <Sparkles className="size-8 text-primary/70" />
                    <div>
                      <p className="text-sm font-semibold uppercase text-foreground">
                        Ready for Shopping Planning
                      </p>
                      <p className="text-xs max-w-md mt-1">
                        Enter your shopping situation and budget on the left, or click one of the preset demonstrations.
                        Gemini will ground recommendations against our official catalog and prepare versioned commitments.
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div
                      key={i}
                      className="max-w-[85%] self-end rounded-lg bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground"
                    >
                      {m.text}
                    </div>
                  ) : (
                    <div key={i} className="flex max-w-[90%] gap-3 self-start">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded border border-border/80 bg-muted">
                        <Bot className="size-3.5 text-primary" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        {m.steps?.map((s, j) => (
                          <ToolCall key={j} step={s} />
                        ))}
                        <div
                          className={cn(
                            "rounded-lg px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap",
                            m.error ? "flex gap-2 bg-destructive/10 text-destructive border border-destructive/20" : "bg-muted/80 text-foreground border border-border/50"
                          )}
                        >
                          {m.error && <CircleAlert className="mt-0.5 size-4 shrink-0" />}
                          {m.text}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {thinking && (
                  <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    gemini is planning & validating catalog bundle <span className="inline-block h-3 w-1.5 animate-pulse bg-primary" />
                  </p>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <CardFooter className="border-t p-3">
              <form
                className="flex w-full gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <div className="flex flex-1 items-center rounded-md border border-input bg-background px-3 focus-within:border-primary">
                  <span className="font-mono text-xs text-muted-foreground">prompt &gt;</span>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={ready ? "ask the agent to refine or inspect items..." : "Configure GEMINI_API_KEY to start"}
                    disabled={!ready || thinking}
                    className="h-10 border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
                  />
                </div>
                <Button type="submit" disabled={!ready || thinking || !input.trim()} size="sm" className="h-10 px-4">
                  <SendHorizontal className="size-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs font-bold text-primary">{num}</span>
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function ToolCall({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(step.result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-col rounded-md border border-border/70 bg-card text-xs">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-2.5 text-left font-mono hover:bg-muted/50 cursor-pointer">
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            <span className="text-primary font-bold">{step.tool}</span>
          </span>
          <Badge
            variant={step.error ? "destructive" : "outline"}
            className="text-[10px] py-0 px-1.5 h-4 font-mono uppercase"
          >
            {step.error ? "Error" : "Executed"}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 bg-background/50 p-2.5 font-mono text-[11px]">
          <div className="flex items-center justify-between pb-1 text-muted-foreground">
            <span>Result payload:</span>
            <Button variant="ghost" size="sm" onClick={copy} className="h-5 px-1.5 text-[10px]">
              {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
            </Button>
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-muted/60 p-2 text-[10px] text-foreground">
            {JSON.stringify(step.result, null, 2)}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
