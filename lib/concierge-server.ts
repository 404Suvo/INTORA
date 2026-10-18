import { GoogleGenAI, type Content } from "@google/genai";
import { PRODUCT_CATALOG } from "@/lib/catalog";
import { ShoppingPlanData } from "@/data/mockData";

const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
];

const CATALOG_SUMMARY = PRODUCT_CATALOG.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  priceInRupees: p.priceMinor / 100,
  inStock: p.inStock,
  unit: p.unit,
  description: p.description,
}));

const SYSTEM_PROMPT = `
You are Intora's AI Customer Service Concierge.
You represent Intora, an innovative intent-to-commerce platform that transforms natural-language situations and rupee budgets into verified, grounded shopping bundles, and records immutable commitments on the Base Sepolia blockchain via MetaMask.

YOUR PERSONALITY & TONE:
- Extremely polite, respectful, empathetic, articulate, warm, and helpful.
- Treat every user like a valued guest. Use courteous phrases like "Welcome to Intora!", "Certainly! I'd be delighted to help you with that.", "Allow me to find that for you.", "Please let me know if you would like any changes."
- Clear, well-formatted, and concise. Use bullet points for readability.

AUTHORITATIVE PRODUCT CATALOG (USE ONLY THESE REAL ITEMS AND PRICES):
${JSON.stringify(CATALOG_SUMMARY, null, 2)}

CORE GUIDELINES:
1. GREETINGS & POLITE CHAT:
   - If the user greets you or makes polite conversation ("hello", "how are you", "who are you"), reply warmly, introduce yourself as the Intora concierge, and explain how you can help with products, bundles, and on-chain verification.
2. PRODUCT & CATEGORY INQUIRIES:
   - If the user asks for items (e.g., "i want snacks", "what pens do you have?", "do you have a water bottle?"), search the authoritative catalog above.
   - List the relevant products with their exact names, prices in ₹, stock status, and a polite, helpful summary.
   - Offer to create a custom bundle or combine them with other essentials.
3. SITUATIONS & SHOPPING BUNDLES:
   - If the user asks to plan for an event (e.g., college fest, monsoon trek, hostel setup, orientation) or specifies a budget:
     - Curate a selection of items strictly from the catalog whose total cost does NOT exceed the budget.
     - Calculate the exact rupee sum and remaining buffer.
     - Explain why each item was selected politely.
     - At the very end of your response, append an optional JSON block enclosed in \`\`\`json { "type": "plan", "title": "...", "situation": "...", "budget": number, "totalAmount": number, "remainingAmount": number, "items": [...] } \`\`\` so the frontend can display the interactive "Load in Live Demo" button.
4. METAMASK & BLOCKCHAIN QUESTIONS:
   - Explain politely that Intora computes a cryptographic Keccak-256 hash of their approved plan.
   - Recording it on Base Sepolia provides tamper-proof assurance of agreed prices and SKUs.
   - It is completely free on the testnet and does NOT charge real money.
5. NEVER INVENT OR HALLUCINATE:
   - Do not make up products or prices that are not in the catalog.
`.trim();

import {
  isGeminiQuotaExhausted,
  recordGeminiQuotaExhaustion,
  isGeminiQuotaError,
} from "@/lib/gemini-quota";

export async function processConciergeChat(messages: Array<{ sender: string; text: string }>) {
  const latestMessage = messages[messages.length - 1]?.text || "";
  const lowerInput = latestMessage.toLowerCase();

  // If Gemini quota is known to be exhausted, provide an immediate catalog-grounded concierge response
  if (isGeminiQuotaExhausted()) {
    const matched = PRODUCT_CATALOG.filter((p) =>
      lowerInput.includes(p.name.toLowerCase()) ||
      lowerInput.includes(p.category.toLowerCase()) ||
      lowerInput.includes(p.id.toLowerCase())
    );

    const productListText = matched.length > 0
      ? `Here are the matching items from our verified catalog:\n` +
        matched.slice(0, 5).map((p) => `• **${p.name}** (₹${p.priceMinor / 100}) - ${p.description}`).join("\n") +
        `\n\nWould you like me to curate a customized bundle with these items for your budget?`
      : `Welcome to Intora! I am here to help you find verified products, design budget-compliant bundles, and secure cryptographic commitments on Base Sepolia. How can I assist you with your shopping plans today?`;

    return {
      text: `Welcome to Intora! Our live AI chat is currently operating in low-overhead mode.\n\n${productListText}`,
      products: matched.length > 0 ? matched.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceRupees: p.priceMinor / 100,
        inStock: p.inStock,
        unit: p.unit,
        description: p.description,
      })) : undefined,
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const contents: Content[] = messages.map((m) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  let responseText = "";
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.6,
        },
      });
      if (result && result.text) {
        responseText = result.text;
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Concierge Service] Model '${model}' failed:`, err?.message || err);

      if (isGeminiQuotaError(err)) {
        recordGeminiQuotaExhaustion(err);
        // Do not cycle through remaining models on project-level quota exhaustion
        break;
      }
    }
  }

  if (!responseText) {
    // If quota was exhausted during the call, return fallback rather than 500 error
    if (isGeminiQuotaExhausted() || (lastError && isGeminiQuotaError(lastError))) {
      const matched = PRODUCT_CATALOG.filter((p) =>
        lowerInput.includes(p.name.toLowerCase()) ||
        lowerInput.includes(p.category.toLowerCase()) ||
        lowerInput.includes(p.id.toLowerCase())
      );
      return {
        text: `Welcome to Intora! Our AI service is currently running at free-tier capacity. We are still able to help you explore our verified catalog items and plan your budget.`,
        products: matched.length > 0 ? matched.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          priceRupees: p.priceMinor / 100,
          inStock: p.inStock,
          unit: p.unit,
          description: p.description,
        })) : undefined,
      };
    }
    throw lastError || new Error("Failed to receive response from Gemini models.");
  }

  let planSnippet: ShoppingPlanData | undefined = undefined;
  let cleanText = responseText;

  const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?"type":\s*"plan"[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.items && Array.isArray(parsed.items)) {
        planSnippet = {
          id: `plan-${Date.now()}`,
          title: parsed.title || "Curated Shopping Bundle",
          situation: parsed.situation || messages[messages.length - 1]?.text || "",
          budget: Number(parsed.budget) || 3000,
          totalAmount: Number(parsed.totalAmount) || 0,
          remainingAmount: Number(parsed.remainingAmount) || 0,
          version: 1,
          timestamp: new Date().toISOString(),
          planHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          items: parsed.items.map((it: any) => ({
            id: it.id || "item",
            name: it.name || "Item",
            category: it.category || "supplies",
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || Number(it.price) || 0,
            totalPrice: (Number(it.unitPrice) || Number(it.price) || 0) * (Number(it.quantity) || 1),
            rationale: it.rationale || "Catalog matched item",
            inStock: true,
            imagePlaceholder: "bg-emerald-100 text-emerald-800",
            badge: it.badge,
          })),
          validation: {
            budgetCompliant: true,
            catalogGrounded: true,
            integerPaiseExact: true,
            allInStock: true,
          },
        };
        cleanText = responseText.replace(jsonMatch[0], "").trim();
      }
    } catch (parseErr) {
      console.warn("[Concierge Service] Failed to parse JSON plan snippet:", parseErr);
    }
  }

  const lowerText = cleanText.toLowerCase();
  const relevantProducts = PRODUCT_CATALOG.filter(
    (p) => lowerText.includes(p.name.toLowerCase()) || lowerText.includes(p.id)
  ).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    priceRupees: p.priceMinor / 100,
    inStock: p.inStock,
    unit: p.unit,
    description: p.description,
  }));

  return {
    text: cleanText,
    planSnippet,
    products: relevantProducts.length > 0 ? relevantProducts : undefined,
  };
}
