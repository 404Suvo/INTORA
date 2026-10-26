"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  ArrowRight,
  Bot,
  User,
  CheckCircle2,
  Package,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Layers,
} from "lucide-react";
import {
  getConciergeResponse,
  ConciergeResponse,
  ConciergeProduct,
  ClientContextPayload,
} from "@/lib/concierge";
import { ShoppingPlanData } from "@/data/mockData";

interface FloatingChatProps {
  onPlanCreated?: (prompt: string, budget: number) => void;
  initialContext?: ClientContextPayload;
}

interface MessageItem {
  id: string;
  sender: "user" | "bot";
  text: string;
  planSnippet?: ShoppingPlanData;
  products?: ConciergeProduct[];
  suggestedPrompts?: string[];
  toolTraces?: Array<{ tool: string; args: unknown; result: unknown }>;
  isError?: boolean;
}

const DEFAULT_CHIPS_BY_PAGE: Record<string, string[]> = {
  "/": [
    "How do I create a shopping plan? 🎒",
    "What if I change the budget? 💰",
    "How does x402 work in Intora? ⚡",
    "How do I verify on Base Sepolia? ⛓️",
  ],
  "/planner": [
    "How does the What-If simulator work? 🔮",
    "How do I use Trade-Off alternatives? ⚖️",
    "What if my plan exceeds budget? ⚠️",
    "Where can I find the Keccak-256 hash? 🔗",
  ],
  "/history": [
    "How do I check my transaction on Basescan? 🔗",
    "What does a confirmed commitment mean? ⛓️",
    "Are historical versions immutable? 📜",
    "How do I return to the planner? 🎒",
  ],
  "/demo": [
    "What is this 3D surface? ✨",
    "How do I start shopping? 🎒",
    "What is Intora? 💡",
    "How does Base Sepolia work? 🦊",
  ],
};

/**
 * Enhanced Markdown message renderer:
 * Supports headings, bold, italics, inline code, code blocks with copy,
 * bullet lists, numbered steps, blockquotes, and paragraphs.
 */
function FormattedMessageText({ text, isUser }: { text: string; isUser: boolean }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (isUser) {
    return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  // Handle multi-line code blocks
  const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
  const segments: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", lang: match[1] || "text", content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-2 text-xs">
      {segments.map((seg, segIdx) => {
        if (seg.type === "code") {
          return (
            <div key={segIdx} className="my-2 rounded-xl bg-[#111111] text-[#E4DED8] p-3 font-mono text-[11px] relative group overflow-x-auto">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 text-[9.5px] text-[#8B857F] uppercase tracking-wider">
                <span>{seg.lang || "code"}</span>
                <button
                  onClick={() => handleCopyCode(seg.content, segIdx)}
                  className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                >
                  {copiedIndex === segIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto leading-relaxed">{seg.content}</pre>
            </div>
          );
        }

        const paragraphs = seg.content.split("\n\n");

        return paragraphs.map((p, pIdx) => {
          const lines = p.split("\n");
          return (
            <div key={`${segIdx}-${pIdx}`} className="space-y-1">
              {lines.map((line, lIdx) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // Headers (### or ## or #)
                if (trimmed.startsWith("### ")) {
                  return (
                    <h5 key={lIdx} className="font-serif-headline text-sm font-semibold text-[#111111] pt-1">
                      {trimmed.slice(4)}
                    </h5>
                  );
                }
                if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
                  return (
                    <h4 key={lIdx} className="font-serif-headline text-base font-semibold text-[#111111] pt-1">
                      {trimmed.replace(/^#+\s*/, "")}
                    </h4>
                  );
                }

                // Blockquotes (> text)
                if (trimmed.startsWith("> ")) {
                  return (
                    <blockquote
                      key={lIdx}
                      className="border-l-2 border-[#1F4D45] pl-2.5 my-1 text-[#4A4540] italic bg-[#F7F4F1] py-1 rounded-r-lg"
                    >
                      {trimmed.slice(2)}
                    </blockquote>
                  );
                }

                // Numbered Steps (e.g., "1. ", "2. ")
                const numberMatch = trimmed.match(/^([0-9]+)\.\s+(.*)$/);
                const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-");
                const lineContent = numberMatch ? numberMatch[2] : isBullet ? trimmed.replace(/^[•-]\s*/, "") : line;

                // Format inline markdown (bold, italics, inline code)
                const parts = lineContent.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
                const formattedContent = parts.map((part, i) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={i} className="font-semibold text-[#111111]">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (part.startsWith("*") && part.endsWith("*")) {
                    return (
                      <em key={i} className="italic text-[#4A4540]">
                        {part.slice(1, -1)}
                      </em>
                    );
                  }
                  if (part.startsWith("`") && part.endsWith("`")) {
                    return (
                      <code
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-[#F0ECE7] border border-[#E4DED8] text-[#1F4D45] font-mono text-[10.5px]"
                      >
                        {part.slice(1, -1)}
                      </code>
                    );
                  }
                  return part;
                });

                if (numberMatch) {
                  return (
                    <div key={lIdx} className="flex items-start gap-2 pl-0.5 leading-relaxed my-0.5">
                      <span className="w-4 h-4 rounded-full bg-[#E8F0EE] text-[#1F4D45] font-semibold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {numberMatch[1]}
                      </span>
                      <span className="flex-1">{formattedContent}</span>
                    </div>
                  );
                }

                if (isBullet) {
                  return (
                    <div key={lIdx} className="flex items-start gap-1.5 pl-0.5 leading-relaxed">
                      <span className="text-[#1F4D45] font-bold text-sm leading-none mt-0.5">•</span>
                      <span className="flex-1">{formattedContent}</span>
                    </div>
                  );
                }

                return (
                  <p key={lIdx} className="leading-relaxed">
                    {formattedContent}
                  </p>
                );
              })}
            </div>
          );
        });
      })}
    </div>
  );
}

export function FloatingChat({ onPlanCreated, initialContext }: FloatingChatProps) {
  const pathname = usePathname() || "/";
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Client context state
  const [clientContext, setClientContext] = useState<ClientContextPayload>(() => ({
    pathname,
    hasPlan: false,
    ...initialContext,
  }));

  // Initial welcome message tailored to current route
  const getInitialMessages = useCallback((): MessageItem[] => {
    const chips = DEFAULT_CHIPS_BY_PAGE[pathname] || DEFAULT_CHIPS_BY_PAGE["/"];
    const routeName =
      pathname === "/planner"
        ? "Full Planner Workspace"
        : pathname === "/history"
        ? "Commitment History"
        : pathname === "/demo"
        ? "3D Canvas Demo"
        : "Intora Platform";

    return [
      {
        id: "welcome-1",
        sender: "bot",
        text:
          `Hello! Welcome to **Ask Intora**, your conversational AI guide.\n\n` +
          `You are currently viewing the **${routeName}**. I can help you create budget-grounded shopping plans, simulate What-If scenarios, check x402 micro-payment research, or verify commitments on Base Sepolia.\n\n` +
          `How may I help you navigate or use Intora today?`,
        suggestedPrompts: chips,
      },
    ];
  }, [pathname]);

  const [messages, setMessages] = useState<MessageItem[]>(getInitialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync client application state periodically or on route change
  useEffect(() => {
    let activePlanSummary: any = undefined;
    let hasStoredPlan = false;

    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("intora_active_plan");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.items) {
            hasStoredPlan = true;
            activePlanSummary = {
              id: parsed.id,
              title: parsed.title,
              situation: parsed.situation,
              budget: parsed.budget,
              totalAmount: parsed.totalAmount,
              remainingAmount: parsed.remainingAmount,
              itemCount: parsed.items.length,
              version: parsed.version || 1,
              planHash: parsed.planHash,
              isBudgetCompliant: parsed.validation?.budgetCompliant !== false,
            };
          }
        }
      } catch {}
    }

    setClientContext((prev) => ({
      ...prev,
      pathname,
      hasPlan: hasStoredPlan,
      planSummary: activePlanSummary,
    }));
  }, [pathname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, streamingText, isOpen]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputVal]);

  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt || inputVal).trim();
    if (!text || isTyping) return;

    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setLastFailedMessage(null);
    setIsTyping(true);
    setStreamingText("");

    try {
      // Build conversation history excluding errors
      const chatHistory = messages
        .filter((m) => !m.isError)
        .map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

      // Call assistant with streaming chunks if available
      const reply: ConciergeResponse = await getConciergeResponse(
        text,
        chatHistory,
        clientContext,
        (chunk, accumulated) => {
          setStreamingText(accumulated);
        }
      );

      const botMsg: MessageItem = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: reply.text || streamingText,
        planSnippet: reply.planSnippet,
        products: reply.products,
        suggestedPrompts: reply.suggestedPrompts,
        toolTraces: reply.toolTraces,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.warn("[Ask Intora] Chat error:", err);
      setLastFailedMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: "bot",
          text:
            "I encountered a momentary issue connecting to the AI service. Please verify your connection or click **Retry** below to resend your message.",
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
      setStreamingText("");
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  };

  const handleResetChat = () => {
    setMessages(getInitialMessages());
    setInputVal("");
    setStreamingText("");
    setLastFailedMessage(null);
  };

  // Find latest suggestions from the most recent bot message
  const lastBotMessage = [...messages].reverse().find((m) => m.sender === "bot" && !m.isError);
  const currentChips =
    lastBotMessage?.suggestedPrompts ||
    DEFAULT_CHIPS_BY_PAGE[pathname] ||
    DEFAULT_CHIPS_BY_PAGE["/"];

  // Handle Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Plan loader handler
  const handleLoadPlan = (plan: ShoppingPlanData) => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("intora_active_plan", JSON.stringify(plan));
        window.dispatchEvent(
          new CustomEvent("intora:loadPlan", {
            detail: { plan, situation: plan.situation, budget: plan.budget },
          })
        );
      } catch {}
    }

    if (onPlanCreated) {
      onPlanCreated(plan.situation, plan.budget);
    }

    setIsOpen(false);
    const demo = document.getElementById("demo");
    if (demo) {
      demo.scrollIntoView({ behavior: "smooth" });
    } else if (pathname !== "/planner") {
      window.location.href = "/planner";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Slide-Over / Popup Chat Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            role="dialog"
            aria-label="Ask Intora Assistant"
            className="w-[94vw] sm:w-[425px] h-[590px] max-h-[85vh] bg-white rounded-[32px] border border-[#E4DED8] shadow-editorial-elevated flex flex-col overflow-hidden mb-3.5"
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-[#F7F4F1] border-b border-[#E4DED8] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img
                    src="/intora-logo.png"
                    alt="Intora Logo"
                    className="w-9 h-9 rounded-xl object-cover shadow-2xs border border-[#E4DED8]"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1F4D45] border-2 border-white ring-1 ring-[#1F4D45]/30 animate-pulse"
                    title="Active"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-serif-headline text-lg font-medium text-[#111111] leading-tight">
                      Ask Intora
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#1F4D45]/10 text-[#1F4D45] text-[9.5px] font-semibold uppercase tracking-wider font-mono">
                      AI Guide
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8B857F] flex items-center gap-1 font-mono">
                    <span>Base Sepolia & x402</span>
                    <span>•</span>
                    <span className="text-[#1F4D45]">Online</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleResetChat}
                  title="New Conversation"
                  aria-label="Reset Conversation"
                  className="w-8 h-8 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close Assistant"
                  aria-label="Close Assistant"
                  className="w-8 h-8 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Context Awareness Pill Banner */}
            <div className="px-4 py-1.5 bg-[#FAF8F5] border-b border-[#E4DED8]/70 flex items-center justify-between text-[10px] text-[#8B857F]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45]" />
                <span className="font-mono truncate">
                  {pathname === "/planner"
                    ? "Full Planner"
                    : pathname === "/history"
                    ? "History Explorer"
                    : pathname === "/demo"
                    ? "3D Demo"
                    : "Landing Page"}
                </span>
                {clientContext.hasPlan && (
                  <>
                    <span>•</span>
                    <span className="text-[#1F4D45] font-medium truncate">
                      Plan: ₹{clientContext.planSummary?.budget?.toLocaleString("en-IN") || "3,000"}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[9.5px] font-mono text-[#8B857F]">Chain: 84532</span>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAF8F5]" aria-live="polite">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 text-xs ${
                    m.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.sender === "bot" && (
                    <div className="w-6 h-6 rounded-full bg-[#E8F0EE] text-[#1F4D45] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      m.sender === "user"
                        ? "bg-[#111111] text-white rounded-br-none shadow-2xs"
                        : m.isError
                        ? "bg-red-50 border border-red-200 text-red-900 rounded-bl-none shadow-2xs"
                        : "bg-white border border-[#E4DED8] text-[#111111] rounded-bl-none shadow-2xs"
                    }`}
                  >
                    <FormattedMessageText text={m.text} isUser={m.sender === "user"} />

                    {/* Retry Button if this was a failed message */}
                    {m.isError && (
                      <div className="mt-2.5 pt-2 border-t border-red-200 flex items-center justify-between">
                        <span className="text-[10px] text-red-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Message could not be processed</span>
                        </span>
                        <button
                          onClick={handleRetry}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-[10.5px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {/* Featured Product Cards */}
                    {m.products && m.products.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#E4DED8] space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8B857F] flex items-center gap-1">
                          <Package className="w-3 h-3 text-[#1F4D45]" />
                          <span>Catalog Items</span>
                        </div>
                        <div className="space-y-1.5">
                          {m.products.map((prod) => (
                            <div
                              key={prod.id}
                              className="p-2 rounded-xl bg-[#F7F4F1] border border-[#E4DED8] flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-[11px] text-[#111111] truncate">
                                  {prod.name}
                                </div>
                                <div className="text-[10px] text-[#8B857F] flex items-center gap-2">
                                  <span className="capitalize">{prod.category}</span>
                                  <span>•</span>
                                  <span
                                    className={
                                      prod.inStock ? "text-[#1F4D45] font-medium" : "text-amber-600"
                                    }
                                  >
                                    {prod.inStock ? "In Stock" : "Out of Stock"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[11.5px] font-semibold text-[#111111] shrink-0 font-mono">
                                ₹{prod.priceRupees.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Curated Shopping Plan Card */}
                    {m.planSnippet && (
                      <div className="mt-3 pt-2.5 border-t border-[#E4DED8] space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="font-semibold text-[#1F4D45] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4D45]" />
                            <span>Total: ₹{m.planSnippet.totalAmount.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="text-[10px] text-[#8B857F] font-mono">
                            ₹{m.planSnippet.remainingAmount.toLocaleString("en-IN")} buffer
                          </div>
                        </div>

                        <div className="bg-[#F7F4F1] p-2.5 rounded-xl border border-[#E4DED8] text-[11px] space-y-1.5">
                          <div className="font-medium text-[#111111] flex items-center justify-between">
                            <span className="truncate">{m.planSnippet.title || "Curated Bundle"}</span>
                            <span className="text-[10px] text-[#8B857F] shrink-0 font-mono">
                              {m.planSnippet.items.length} items
                            </span>
                          </div>

                          <div className="space-y-1 pt-1 border-t border-[#E4DED8]/60">
                            {m.planSnippet.items.slice(0, 3).map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[10.5px] text-[#444444]"
                              >
                                <span className="truncate pr-2">
                                  {it.quantity}x {it.name}
                                </span>
                                <span className="font-medium text-[#111111] shrink-0 font-mono">
                                  ₹{it.totalPrice.toLocaleString("en-IN")}
                                </span>
                              </div>
                            ))}
                            {m.planSnippet.items.length > 3 && (
                              <div className="text-[9.5px] text-[#8B857F] italic pt-0.5">
                                +{m.planSnippet.items.length - 3} more items in full plan
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleLoadPlan(m.planSnippet!)}
                          className="w-full py-2 px-3 rounded-xl bg-[#111111] hover:bg-black text-white font-medium flex items-center justify-between text-xs transition cursor-pointer shadow-2xs group"
                        >
                          <span className="font-serif-headline">Load in Live Planner</span>
                          <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Live Streaming Message Display */}
              {isTyping && streamingText && (
                <div className="flex gap-2.5 text-xs justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#E8F0EE] text-[#1F4D45] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-3.5 rounded-2xl max-w-[85%] leading-relaxed bg-white border border-[#E4DED8] text-[#111111] rounded-bl-none shadow-2xs">
                    <FormattedMessageText text={streamingText} isUser={false} />
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#1F4D45] animate-pulse align-middle" />
                  </div>
                </div>
              )}

              {/* Typing / Loading Indicator */}
              {isTyping && !streamingText && (
                <div className="flex gap-2.5 text-xs items-center text-[#8B857F]">
                  <div className="w-6 h-6 rounded-full bg-[#E8F0EE] text-[#1F4D45] flex items-center justify-center shrink-0 shadow-2xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-white border border-[#E4DED8] px-3 py-2 rounded-2xl flex items-center gap-1.5 shadow-2xs">
                    <span className="text-[11px] text-[#8B857F] mr-1">Ask Intora is thinking</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45] animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1F4D45] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-3 py-2 bg-white border-t border-[#E4DED8] flex gap-1.5 overflow-x-auto no-scrollbar">
              {currentChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  disabled={isTyping}
                  className="px-2.5 py-1 rounded-full text-[10.5px] bg-[#F7F4F1] border border-[#E4DED8] text-[#111111] hover:bg-[#E4DED8] hover:border-[#D4CDC6] transition whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Bar with Multi-line Textarea and Enter-to-Send */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-white border-t border-[#E4DED8] flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about plans, budgets, x402, or Base Sepolia..."
                disabled={isTyping}
                className="flex-1 text-xs bg-[#F7F4F1] border border-[#E4DED8] rounded-2xl px-3.5 py-2.5 text-[#111111] placeholder:text-[#8B857F] focus:outline-none focus:border-[#1F4D45] transition disabled:opacity-60 resize-none max-h-[120px] leading-relaxed"
              />
              <button
                type="submit"
                disabled={!inputVal.trim() || isTyping}
                aria-label="Send message"
                className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-black transition cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs mb-0.5"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button: Peach-to-Lavender Pill with Logo */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Ask Intora Assistant"
        className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-[#F9D5CB] via-[#F4A28C] to-[#E9D8FF] text-[#111111] font-semibold text-xs uppercase tracking-wider shadow-editorial-elevated hover:shadow-lg transition-all cursor-pointer border border-white/60 select-none"
      >
        <img
          src="/intora-logo.png"
          alt="Intora Logo"
          className="w-5 h-5 rounded-md object-cover shadow-2xs"
        />
        <span>Ask Intora</span>
      </motion.button>
    </div>
  );
}
