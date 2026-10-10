"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import {
  getConciergeResponse,
  ConciergeResponse,
  ConciergeProduct,
} from "@/lib/concierge";
import { ShoppingPlanData } from "@/data/mockData";

interface FloatingChatProps {
  onPlanCreated?: (prompt: string, budget: number) => void;
}

interface MessageItem {
  id: string;
  sender: "user" | "bot";
  text: string;
  planSnippet?: ShoppingPlanData;
  products?: ConciergeProduct[];
  suggestedPrompts?: string[];
}

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: "welcome-1",
    sender: "bot",
    text:
      "Hello! Welcome to Intora. I am your customer service concierge.\n\n" +
      "I'm delighted to assist you today! Feel free to ask about our catalog products, request a custom shopping plan for any event or trip, or ask about our Base Sepolia blockchain verification.",
    suggestedPrompts: [
      "I want snacks 🍫",
      "College Fest under ₹3,000 🎒",
      "What is Intora? 💡",
      "How does MetaMask work? 🦊",
    ],
  },
];

/**
 * Formats bot text gracefully with bolding, italics, bullet points, and paragraphs
 */
function FormattedMessageText({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  const paragraphs = text.split("\n\n");

  return (
    <div className="space-y-2 text-xs">
      {paragraphs.map((p, pIdx) => {
        const lines = p.split("\n");
        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;

              // Check if bullet point
              const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-");
              const lineContent = isBullet ? trimmed.replace(/^[•-]\s*/, "") : line;

              // Parse bold **text** and italics *text*
              const parts = lineContent.split(/(\*\*.*?\*\*|\*.*?\*)/g);
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
                return part;
              });

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
      })}
    </div>
  );
}

export function FloatingChat({ onPlanCreated }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen]);

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
    setIsTyping(true);

    try {
      // Multi-turn history context
      const chatHistory = messages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const reply: ConciergeResponse = await getConciergeResponse(text, chatHistory);

      const botMsg: MessageItem = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: reply.text,
        planSnippet: reply.planSnippet,
        products: reply.products,
        suggestedPrompts: reply.suggestedPrompts,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: "bot",
          text:
            "I apologize for the momentary hiccup. I am right here and ready to assist you. Please ask your question again, and I will gladly help!",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    setMessages(INITIAL_MESSAGES);
    setInputVal("");
  };

  // Find latest suggestions from the most recent bot message
  const lastBotMessage = [...messages].reverse().find((m) => m.sender === "bot");
  const currentChips = lastBotMessage?.suggestedPrompts || [
    "I want snacks 🍫",
    "College Fest under ₹3,000 🎒",
    "What is Intora? 💡",
    "How does MetaMask work? 🦊",
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Slide-Over / Popup Chat Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-[92vw] sm:w-[410px] h-[550px] bg-white rounded-[32px] border border-[#E4DED8] shadow-editorial-elevated flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="p-4 bg-[#F7F4F1] border-b border-[#E4DED8] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img
                    src="/intora-logo.png"
                    alt="Intora Logo"
                    className="w-9 h-9 rounded-xl object-cover shadow-2xs border border-[#E4DED8]"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1F4D45] border-2 border-white ring-1 ring-[#1F4D45]/30 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-serif-headline text-lg font-medium text-[#111111] leading-tight">
                    Intora Concierge
                  </h4>
                  <p className="text-[10px] text-[#8B857F] flex items-center gap-1 font-mono">
                    Customer Service • Active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleResetChat}
                  title="Reset Conversation"
                  className="w-8 h-8 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close Concierge"
                  className="w-8 h-8 rounded-full bg-white border border-[#E4DED8] flex items-center justify-center text-[#8B857F] hover:text-[#111111] hover:bg-[#F7F4F1] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAF8F5]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 text-xs ${
                    m.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.sender === "bot" && (
                    <div className="w-6 h-6 rounded-full bg-[#E8F0EE] text-[#1F4D45] flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      m.sender === "user"
                        ? "bg-[#111111] text-white rounded-br-none shadow-2xs"
                        : "bg-white border border-[#E4DED8] text-[#111111] rounded-bl-none shadow-2xs"
                    }`}
                  >
                    <FormattedMessageText text={m.text} isUser={m.sender === "user"} />

                    {/* Featured Product Cards */}
                    {m.products && m.products.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#E4DED8] space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8B857F] flex items-center gap-1">
                          <Package className="w-3 h-3 text-[#1F4D45]" />
                          <span>Catalog Options</span>
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
                            <span className="text-[10px] text-[#8B857F] shrink-0">
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
                          onClick={() => {
                            onPlanCreated?.(m.planSnippet!.situation, m.planSnippet!.budget);
                            setIsOpen(false);
                            const demo = document.getElementById("demo");
                            demo?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-[#111111] hover:bg-black/90 text-white font-medium flex items-center justify-between text-xs transition cursor-pointer shadow-2xs group"
                        >
                          <span className="font-serif-headline">Load in Live Demo</span>
                          <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2.5 text-xs items-center text-[#8B857F]">
                  <div className="w-6 h-6 rounded-full bg-[#E8F0EE] text-[#1F4D45] flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-white border border-[#E4DED8] px-3 py-2 rounded-2xl flex items-center gap-1.5 shadow-2xs">
                    <span className="text-[11px] text-[#8B857F] mr-1">Concierge is replying</span>
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

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-white border-t border-[#E4DED8] flex items-center gap-2"
            >
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask for snacks, stationery, budgets, or plans..."
                disabled={isTyping}
                className="flex-1 text-xs bg-[#F7F4F1] border border-[#E4DED8] rounded-full px-4 py-2.5 text-[#111111] placeholder:text-[#8B857F] focus:outline-none focus:border-[#1F4D45] transition disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!inputVal.trim() || isTyping}
                className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-black transition cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
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
        className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-[#F9D5CB] via-[#F4A28C] to-[#E9D8FF] text-[#111111] font-semibold text-xs uppercase tracking-wider shadow-editorial-elevated hover:shadow-lg transition-all cursor-pointer border border-white/60"
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
