/**
 * INTENT-AWARE BUDGET INTERPRETATION & PRODUCT-LEVEL PRICE MATCHING
 *
 * Implements:
 * 1. Intent classification: single_product_target, single_product_max, total_basket_cap.
 * 2. Validated budget-intent schema with explicit price tolerance and constraint preservation.
 * 3. Composite product-level scoring: must-have specs > price proximity > quality credibility.
 * 4. Progressive tolerance widening when initial inventory is constrained.
 * 5. Transparent price-fit explanations and delta calculations.
 */

import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { CURRENCY, MAX_BUDGET_INR, MIN_BUDGET_INR, validateBudgetInr } from "./types";
import { sanitizeErrorMessage } from "./scraperapi";
import {
  evaluateProductSuitability,
  type NormalizedProduct,
  type UserRequirement,
  type UserTradeOffPreference,
} from "./trade-off-engine";

// ============================================================================
// 1. ZOD SCHEMAS & TYPES
// ============================================================================

export const BudgetModeSchema = z.enum([
  "single_product_target",
  "single_product_max",
  "total_basket_cap",
]);
export type BudgetMode = z.infer<typeof BudgetModeSchema>;

export const PriceToleranceSchema = z.object({
  minRatio: z.number().min(0.1).max(1.0).default(0.85),
  maxRatio: z.number().min(1.0).max(2.5).default(1.1),
  minPrice: z.number().nonnegative(),
  maxPrice: z.number().positive(),
  isWidened: z.boolean().default(false),
  wideningReason: z.string().optional(),
});
export type PriceTolerance = z.infer<typeof PriceToleranceSchema>;

export const UserBudgetIntentSchema = z.object({
  budgetMode: BudgetModeSchema,
  targetProduct: z.string().min(1, "Target product or category cannot be empty"),
  targetPrice: z.number().positive().optional(),
  minimumPrice: z.number().nonnegative().optional(),
  maximumPrice: z.number().positive().optional(),
  currency: z.literal(CURRENCY).default(CURRENCY),
  includeAccessories: z.boolean().default(false),
  priceTolerance: PriceToleranceSchema,
  mustHaveRequirements: z.array(z.string()).default([]),
  rawPrompt: z.string(),
  explanation: z.string(),
});
export type UserBudgetIntent = z.infer<typeof UserBudgetIntentSchema>;

export interface TargetPriceDelta {
  absolute: number; // e.g. -5000 means ₹5,000 below target, +2000 means ₹2,000 above target
  percentage: number; // e.g. -5% or +2%
  formattedDelta: string; // e.g. "-₹5,000 (-5%)" or "Exact match"
}

// ============================================================================
// 2. TOLERANCE & DELTA CALCULATORS
// ============================================================================

/**
 * Calculates standard category price tolerance.
 * Default is 85% to 110% of target price (e.g. ₹85,000 to ₹1,10,000 for ₹1,00,000 target).
 * Respects explicit user-defined min/max bounds.
 */
export function calculateInitialPriceTolerance(
  targetPrice: number,
  explicitMin?: number,
  explicitMax?: number
): PriceTolerance {
  const defaultMin = Math.round(targetPrice * 0.85);
  const defaultMax = Math.round(targetPrice * 1.1);

  const minPrice = explicitMin !== undefined ? Math.max(0, explicitMin) : defaultMin;
  const maxPrice = explicitMax !== undefined ? Math.min(MAX_BUDGET_INR, explicitMax) : defaultMax;

  return {
    minRatio: 0.85,
    maxRatio: 1.1,
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice: Math.max(minPrice, maxPrice),
    isWidened: false,
  };
}

/**
 * Progressively widens price tolerance (e.g. 70% to 125%) when zero products match the initial window.
 * Strictly respects explicit user constraints (never exceeds explicit max or violates explicit min).
 */
export function widenPriceTolerance(
  current: PriceTolerance,
  targetPrice: number,
  explicitMin?: number,
  explicitMax?: number
): PriceTolerance {
  const widenedMin = Math.round(targetPrice * 0.7);
  const widenedMax = Math.round(targetPrice * 1.25);

  const minPrice = explicitMin !== undefined ? Math.max(0, explicitMin) : widenedMin;
  let maxPrice = explicitMax !== undefined ? Math.min(MAX_BUDGET_INR, explicitMax) : widenedMax;

  // Ensure maxPrice never exceeds platform MAX_BUDGET_INR
  maxPrice = Math.min(maxPrice, MAX_BUDGET_INR);

  return {
    minRatio: 0.7,
    maxRatio: 1.25,
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice: Math.max(minPrice, maxPrice),
    isWidened: true,
    wideningReason: `Expanded target price window to ₹${minPrice.toLocaleString(
      "en-IN"
    )} – ₹${maxPrice.toLocaleString(
      "en-IN"
    )} (70%–125% of target) because no verified products matched the initial 85%–110% range.`,
  };
}

/**
 * Computes exact price deviation from the user's target price.
 */
export function calculateTargetPriceDelta(productPrice: number, targetPrice: number): TargetPriceDelta {
  const diff = Math.round(productPrice - targetPrice);
  if (diff === 0 || targetPrice <= 0) {
    return {
      absolute: 0,
      percentage: 0,
      formattedDelta: "Exact target match (0%)",
    };
  }

  const pct = Math.round((diff / targetPrice) * 100);
  const sign = diff > 0 ? "+" : "-";
  const absDiff = Math.abs(diff);

  return {
    absolute: diff,
    percentage: pct,
    formattedDelta: `${sign}₹${absDiff.toLocaleString("en-IN")} (${sign}${Math.abs(pct)}% from target)`,
  };
}

// ============================================================================
// 3. DETERMINISTIC INTENT PARSER & FALLBACK
// ============================================================================

const MULTI_ITEM_BUNDLE_KEYWORDS = [
  "setup",
  "bundle",
  "complete",
  "kit",
  "pack of",
  "supplies",
  "supplies for",
  "trip",
  "event",
  "fest",
  "hike",
  "trek",
  "camping",
  "monsoon",
  "college",
  "hostel",
  "essentials",
  "basket",
  "gear for",
  "party",
  "festival",
  "and a",
  "and an",
  "and some",
  "including",
  "along with",
  "accessories for",
  "plus a",
  "plus an",
];

const SINGLE_PRODUCT_MAX_KEYWORDS = [
  "cheapest",
  "lowest price",
  "most affordable",
  "least expensive",
  "under",
  "below",
  "less than",
  "at most",
  "up to",
  "maximum of",
  "max",
  "within",
];

const SINGLE_PRODUCT_TARGET_KEYWORDS = [
  "around",
  "near",
  "approx",
  "approximately",
  "about",
  "target",
  "budget of",
  "budget is",
  "priced at",
  "for around",
  "cost around",
  "close to",
  "i want a",
  "i want an",
  "looking for a",
  "looking for an",
  "find a",
  "find an",
  "get me a",
  "get me an",
  "buy a",
  "buy an",
  "recommend a",
  "recommend an",
];

/**
 * Extracts explicit rupee constraints (min and max) from prompt text.
 * Handles patterns like "between ₹80,000 and ₹1,10,000", "min ₹50,000", "max ₹1,00,000", "80k to 120k".
 */
export function extractExplicitPriceBounds(
  prompt: string
): { explicitMin?: number; explicitMax?: number } {
  const text = prompt.toLowerCase();
  let explicitMin: number | undefined;
  let explicitMax: number | undefined;

  // Pattern: "between ₹X and ₹Y" or "₹X to ₹Y" or "from ₹X to ₹Y"
  const rangeMatch = text.match(
    /(?:between|from)?\s*(?:rs\.?|₹|inr)?\s*([0-9]+(?:,[0-9]+)*(?:\s*k)?)\s*(?:and|to|-)\s*(?:rs\.?|₹|inr)?\s*([0-9]+(?:,[0-9]+)*(?:\s*k)?)/i
  );
  if (rangeMatch) {
    const parseVal = (str: string) => {
      const isK = str.toLowerCase().includes("k");
      const num = parseFloat(str.replace(/[^0-9.]/g, ""));
      return isK ? num * 1000 : num;
    };
    const v1 = parseVal(rangeMatch[1]);
    const v2 = parseVal(rangeMatch[2]);
    if (!isNaN(v1) && !isNaN(v2) && v1 > 0 && v2 > 0) {
      explicitMin = Math.min(v1, v2);
      explicitMax = Math.max(v1, v2);
    }
  }

  // Pattern: "at least ₹X" or "min ₹X" or "minimum ₹X"
  const minMatch = text.match(/(?:at least|minimum|min|above)\s*(?:rs\.?|₹|inr)?\s*([0-9]+(?:,[0-9]+)*(?:\s*k)?)/i);
  if (minMatch && explicitMin === undefined) {
    const isK = minMatch[1].toLowerCase().includes("k");
    const num = parseFloat(minMatch[1].replace(/[^0-9.]/g, ""));
    const v = isK ? num * 1000 : num;
    if (!isNaN(v) && v > 0) explicitMin = v;
  }

  // Pattern: "at most ₹X" or "max ₹X" or "maximum ₹X" or "under ₹X"
  const maxMatch = text.match(/(?:at most|maximum|max|under|below|up to)\s*(?:rs\.?|₹|inr)?\s*([0-9]+(?:,[0-9]+)*(?:\s*k)?)/i);
  if (maxMatch && explicitMax === undefined) {
    const isK = maxMatch[1].toLowerCase().includes("k");
    const num = parseFloat(maxMatch[1].replace(/[^0-9.]/g, ""));
    const v = isK ? num * 1000 : num;
    if (!isNaN(v) && v > 0) explicitMax = v;
  }

  return { explicitMin, explicitMax };
}

/**
 * Extracts target product category name from a prompt (e.g. "laptop", "monitor", "running shoes").
 */
export function extractTargetProduct(prompt: string): string {
  const cleaned = prompt
    .replace(/^(?:i want to buy|i want a|i want an|i want|find the cheapest|find a|find an|find the|find me a|find me|find|looking for a|looking for an|looking for|get me a|get me|buy a|buy an|buy|recommend a|recommend an|build me a|build me)\s+/i, "")
    .replace(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|below|around|within|cap|price of)\s*[:=]?\s*[0-9]+(?:,[0-9]+)*(?:\s*k)?/gi, "")
    .replace(/\b(?:with|for|under|around|about|between|at least|at most|with a budget of)\b[\s\S]*/i, "")
    .trim();

  const stopWords = new Set(["the", "a", "an", "best", "cheapest", "top", "good", "find", "get", "buy", "recommend", "me", "please", "my"]);
  if (cleaned.length > 2) {
    // Take the first 1-3 salient words
    const words = cleaned
      .split(/\s+/)
      .filter((w) => !stopWords.has(w.toLowerCase()));
    if (words.length > 0) {
      return words.slice(0, 3).join(" ");
    }
  }

  // Fallbacks based on common domain terms
  const lower = prompt.toLowerCase();
  if (lower.includes("laptop")) return "laptop";
  if (lower.includes("monitor")) return "monitor";
  if (lower.includes("keyboard")) return "keyboard";
  if (lower.includes("smartphone") || lower.includes("mobile") || lower.includes("phone")) return "smartphone";
  if (lower.includes("earbuds") || lower.includes("headphones") || lower.includes("earphones")) return "wireless earbuds";
  if (lower.includes("smartwatch") || lower.includes("watch")) return "smartwatch";
  if (lower.includes("backpack") || lower.includes("bag")) return "backpack";
  if (lower.includes("water bottle") || lower.includes("bottle")) return "water bottle";
  if (lower.includes("shoes") || lower.includes("sneakers")) return "shoes";

  return "product";
}

/**
 * Extracts must-have specifications explicitly mentioned in prompt.
 */
export function extractMustHaveSpecs(prompt: string): string[] {
  const specs: string[] = [];
  const lower = prompt.toLowerCase();

  // Laptop / electronics specs
  const ramMatch = lower.match(/\b([0-9]{1,2}\s*gb\s*ram)\b/i);
  if (ramMatch) specs.push(ramMatch[1].toUpperCase());

  const ssdMatch = lower.match(/\b([0-9]{3,4}\s*gb\s*ssd|1\s*tb\s*ssd)\b/i);
  if (ssdMatch) specs.push(ssdMatch[1].toUpperCase());

  if (lower.includes("i5") || lower.includes("core i5")) specs.push("Intel Core i5");
  if (lower.includes("i7") || lower.includes("core i7")) specs.push("Intel Core i7");
  if (lower.includes("ryzen 5")) specs.push("Ryzen 5");
  if (lower.includes("ryzen 7")) specs.push("Ryzen 7");
  if (lower.includes("oled")) specs.push("OLED Display");
  if (lower.includes("120hz") || lower.includes("144hz")) specs.push("High Refresh Rate");
  if (lower.includes("waterproof") || lower.includes("water resistant")) specs.push("Waterproof");
  if (lower.includes("stainless steel")) specs.push("Stainless Steel");
  if (lower.includes("anc") || lower.includes("noise cancelling")) specs.push("Active Noise Cancelling");
  if (lower.includes("mechanical")) specs.push("Mechanical");
  if (lower.includes("wireless") || lower.includes("bluetooth")) specs.push("Wireless / Bluetooth");
  if (lower.includes("fast charging") || lower.includes("type-c")) specs.push("Fast Charging Type-C");

  return Array.from(new Set(specs));
}

/**
 * Deterministically interprets shopping intent and budget mode without calling external APIs.
 */
export function parseBudgetIntentDeterministically(prompt: string, budgetRupees: number): UserBudgetIntent {
  const lower = (prompt || "").toLowerCase();
  const { explicitMin, explicitMax } = extractExplicitPriceBounds(prompt);
  const targetProduct = extractTargetProduct(prompt);
  const mustHaveRequirements = extractMustHaveSpecs(prompt);

  // 1. Detect if accessories or complementary products were explicitly requested
  const includesExplicitAccessories =
    lower.includes("accessory") ||
    lower.includes("accessories") ||
    lower.includes("including") ||
    lower.includes("with bag") ||
    lower.includes("along with") ||
    lower.includes("plus a") ||
    lower.includes("and a ") ||
    lower.includes("and an ");

  // 2. Multi-Item Basket vs Single-Product intent
  const isMultiItemBundle =
    MULTI_ITEM_BUNDLE_KEYWORDS.some((kw) => lower.includes(kw)) ||
    (lower.includes("setup") && !lower.includes("setup guide")) ||
    (lower.includes(" and ") && !lower.includes("black and") && !lower.includes("grey and"));

  let budgetMode: BudgetMode;
  let targetPrice: number | undefined;
  let minimumPrice: number | undefined = explicitMin;
  let maximumPrice: number | undefined = explicitMax;
  let explanation = "";

  if (isMultiItemBundle) {
    budgetMode = "total_basket_cap";
    targetPrice = budgetRupees;
    maximumPrice = explicitMax ?? budgetRupees;
    explanation = `Multi-item basket request: total combined expenditure for your bundle must not exceed ₹${budgetRupees.toLocaleString(
      "en-IN"
    )}.`;
  } else {
    // Single product intent: distinguish target vs max
    const isCheapestIntent =
      SINGLE_PRODUCT_MAX_KEYWORDS.some((kw) => lower.includes(kw)) &&
      (lower.includes("cheapest") ||
        lower.includes("lowest price") ||
        lower.includes("most affordable") ||
        lower.includes("least expensive") ||
        lower.startsWith("under") ||
        lower.includes("cheapest under"));

    if (isCheapestIntent) {
      budgetMode = "single_product_max";
      maximumPrice = explicitMax ?? budgetRupees;
      explanation = `Single-product value ceiling: searching for the highest-value, reliable ${targetProduct} under your maximum limit of ₹${maximumPrice.toLocaleString(
        "en-IN"
      )}.`;
    } else {
      budgetMode = "single_product_target";
      targetPrice = budgetRupees;
      explanation = `Single-product target price: matching individual ${targetProduct} options priced near ₹${budgetRupees.toLocaleString(
        "en-IN"
      )} (target range: 85%–110%). Unrelated accessories will not be added.`;
    }
  }

  // Calculate tolerance
  const effectiveTarget = targetPrice ?? budgetRupees;
  const priceTolerance = calculateInitialPriceTolerance(effectiveTarget, minimumPrice, maximumPrice);

  return {
    budgetMode,
    targetProduct,
    targetPrice,
    minimumPrice,
    maximumPrice,
    currency: CURRENCY,
    includeAccessories: includesExplicitAccessories || isMultiItemBundle,
    priceTolerance,
    mustHaveRequirements,
    rawPrompt: prompt,
    explanation,
  };
}

// ============================================================================
// 4. VALIDATOR & RULE ENFORCER
// ============================================================================

/**
 * Validates a budget-intent object in application code to ensure strict bounds,
 * positive numbers, INR currency, and valid modes.
 */
export function validateBudgetIntent(
  intent: unknown,
  userBudgetRupees: number
): { valid: boolean; intent?: UserBudgetIntent; errors: string[] } {
  const errors: string[] = [];

  const parsed = UserBudgetIntentSchema.safeParse(intent);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const obj = parsed.data;

  // Validate budget limits
  if (obj.targetPrice !== undefined) {
    const val = validateBudgetInr(obj.targetPrice);
    if (!val.valid) {
      errors.push(`Target price invalid: ${val.error}`);
    }
  }

  if (obj.maximumPrice !== undefined) {
    if (obj.maximumPrice <= 0 || obj.maximumPrice > MAX_BUDGET_INR) {
      errors.push(`Maximum price must be between ₹${MIN_BUDGET_INR} and ₹${MAX_BUDGET_INR}.`);
    }
  }

  if (obj.minimumPrice !== undefined) {
    if (obj.minimumPrice < 0) {
      errors.push("Minimum price cannot be negative.");
    }
    const upper = obj.maximumPrice ?? obj.targetPrice ?? userBudgetRupees;
    if (obj.minimumPrice > upper) {
      errors.push(
        `Minimum price (₹${obj.minimumPrice}) cannot exceed upper budget ceiling (₹${upper}).`
      );
    }
  }

  if (obj.priceTolerance.minPrice > obj.priceTolerance.maxPrice) {
    errors.push("Tolerance minimum price cannot exceed maximum price.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, intent: obj, errors: [] };
}

// ============================================================================
// 5. GEMINI-POWERED INTENT INTERPRETER
// ============================================================================

export interface InterpretBudgetIntentOptions {
  skipGemini?: boolean;
  timeoutMs?: number;
}

/**
 * Interprets user shopping intent with Gemini AI, with bounded retries and deterministic fallback.
 * Strictly validated in application code.
 */
export async function interpretBudgetIntent(
  prompt: string,
  budgetRupees: number,
  options: InterpretBudgetIntentOptions = {}
): Promise<UserBudgetIntent> {
  const budgetValidation = validateBudgetInr(budgetRupees);
  if (!budgetValidation.valid || budgetValidation.budget === undefined) {
    throw new Error(budgetValidation.error || "A positive rupee budget amount is required.");
  }
  const cleanBudget = budgetValidation.budget;

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (apiKey && !options.skipGemini) {
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    try {
      const ai = new GoogleGenAI({ apiKey });
      const promptInstruction = `You are the intent interpreter for Intora, an AI shopping agent in India.
Analyze this user shopping request and budget:
Prompt: "${prompt}"
User Budget: ₹${cleanBudget.toLocaleString("en-IN")} INR.

Determine:
1. budgetMode:
   - "single_product_target": User wants ONE primary product and the budget represents an approximate target price (e.g. "Find a laptop with a budget of ₹1,00,000", "laptop around ₹1,00,000"). Do NOT add accessories.
   - "single_product_max": User wants ONE product and explicitly wants affordable / cheapest / ceiling up to budget (e.g. "Find the cheapest laptop under ₹1,00,000").
   - "total_basket_cap": User wants a multi-item setup, bundle, packing list, or event supplies where the combined total of multiple items must remain within the budget (e.g. "Build me a complete laptop setup under ₹1,00,000, including a monitor and keyboard", "3-day college event supplies ₹3,000").
2. targetProduct: The core product or category requested (e.g. "laptop", "monitor", "water bottle").
3. targetPrice: Number in INR if applicable.
4. minimumPrice: Number if user specified a minimum price or range, else null.
5. maximumPrice: Number if user specified an upper price limit or range, else null.
6. includeAccessories: boolean (true ONLY if user explicitly asked for accessories or multiple items).
7. mustHaveRequirements: Array of explicit specs/features mentioned (e.g. ["16GB RAM", "Core i7"]).
8. explanation: A concise, transparent explanation of how you interpreted their budget.

Output strictly a JSON object conforming to this schema without markdown fences:
{
  "budgetMode": "single_product_target" | "single_product_max" | "total_basket_cap",
  "targetProduct": string,
  "targetPrice": number | null,
  "minimumPrice": number | null,
  "maximumPrice": number | null,
  "includeAccessories": boolean,
  "mustHaveRequirements": string[],
  "explanation": string
}`;

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: promptInstruction }] }],
        config: { temperature: 0.1 },
      });

      const text = response.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const rawJson = JSON.parse(match[0]);
        const targetPriceVal =
          typeof rawJson.targetPrice === "number" && rawJson.targetPrice > 0
            ? rawJson.targetPrice
            : rawJson.budgetMode === "single_product_target"
            ? cleanBudget
            : undefined;

        const maxPriceVal =
          typeof rawJson.maximumPrice === "number" && rawJson.maximumPrice > 0
            ? rawJson.maximumPrice
            : rawJson.budgetMode === "single_product_max"
            ? cleanBudget
            : undefined;

        const minPriceVal =
          typeof rawJson.minimumPrice === "number" && rawJson.minimumPrice >= 0
            ? rawJson.minimumPrice
            : undefined;

        const tolerance = calculateInitialPriceTolerance(
          targetPriceVal ?? cleanBudget,
          minPriceVal,
          maxPriceVal
        );

        const candidateIntent: UserBudgetIntent = {
          budgetMode: rawJson.budgetMode,
          targetProduct: String(rawJson.targetProduct || extractTargetProduct(prompt)).trim(),
          targetPrice: targetPriceVal,
          minimumPrice: minPriceVal,
          maximumPrice: maxPriceVal,
          currency: CURRENCY,
          includeAccessories: Boolean(rawJson.includeAccessories),
          priceTolerance: tolerance,
          mustHaveRequirements: Array.isArray(rawJson.mustHaveRequirements)
            ? rawJson.mustHaveRequirements.map(String)
            : extractMustHaveSpecs(prompt),
          rawPrompt: prompt,
          explanation: String(rawJson.explanation || "").trim(),
        };

        const validation = validateBudgetIntent(candidateIntent, cleanBudget);
        if (validation.valid && validation.intent) {
          return validation.intent;
        }
      }
    } catch (err) {
      console.warn(
        "[Budget Intent] Gemini interpretation fallback:",
        sanitizeErrorMessage(err instanceof Error ? err.message : String(err))
      );
    }
  }

  // Deterministic fallback
  return parseBudgetIntentDeterministically(prompt, cleanBudget);
}

// ============================================================================
// 6. PRODUCT-LEVEL PRICE MATCHING & RANKING
// ============================================================================

export interface RankedProductCandidate {
  product: NormalizedProduct;
  compositeScore: number;
  proximityScore: number;
  requirementScore: number;
  qualityScore: number;
  priceDelta: TargetPriceDelta;
  satisfiesMustHaves: boolean;
  isInInitialRange: boolean;
  priceFitRationale: string;
}

/**
 * Computes price proximity score: |productPrice - targetPrice| / targetPrice
 * Returns 100 for exact match, 70+ for within 15%, scaled downwards for wider deltas.
 */
export function computePriceProximityScore(productPrice: number, targetPrice: number): number {
  if (targetPrice <= 0 || productPrice <= 0) return 10;
  const deltaRatio = Math.abs(productPrice - targetPrice) / targetPrice;

  if (deltaRatio <= 0.02) return 100; // within 2% is near-exact
  if (deltaRatio <= 0.15) {
    // Within initial 15% tolerance: 70 - 98
    return Math.round(100 - (deltaRatio / 0.15) * 30);
  }
  if (deltaRatio <= 0.3) {
    // Within 30%: 40 - 70
    return Math.round(70 - ((deltaRatio - 0.15) / 0.15) * 30);
  }
  // Beyond 30%: 10 - 40
  return Math.max(10, Math.round(40 - Math.min(1.0, deltaRatio - 0.3) * 30));
}

/**
 * Quality evidence score (0-100) based on ratings, review counts, and Amazon badges.
 * Missing rating is treated as neutral unknown (50), not penalized to 0.
 */
export function computeQualityEvidenceScore(product: NormalizedProduct): number {
  let score = 50;
  if (product.rating !== null) {
    score = (product.rating / 5) * 75;
    if (product.reviewCount !== null && product.reviewCount >= 100) {
      score += 15;
    } else if (product.reviewCount !== null && product.reviewCount >= 20) {
      score += 8;
    }
  }
  if (product.badges.includes("Amazon's Choice") || product.badges.includes("Best Seller")) {
    score += 10;
  }
  return Math.max(10, Math.min(100, Math.round(score)));
}

/**
 * Evaluates and ranks candidates specifically for `single_product_target`.
 *
 * Rules:
 * 1. Must-have specifications match takes precedence over mere price proximity!
 * 2. Candidates in the target tolerance are prioritized.
 * 3. Composite score balances must-haves (40%), price proximity (35%), and quality credibility (25%).
 */
export function rankCandidatesForSingleProductTarget(
  candidates: NormalizedProduct[],
  intent: UserBudgetIntent,
  tolerance: PriceTolerance,
  userRequirements: UserRequirement[] = []
): RankedProductCandidate[] {
  const targetPrice = intent.targetPrice ?? intent.maximumPrice ?? tolerance.maxPrice;

  const evaluated: RankedProductCandidate[] = candidates.map((prod) => {
    const suitability = evaluateProductSuitability(prod, userRequirements);
    const satisfiesMustHaves = !suitability.violatesMustHave;
    const reqScore = satisfiesMustHaves ? suitability.score : 15; // heavily penalized if violates must-haves

    const proximityScore = computePriceProximityScore(prod.unitPrice, targetPrice);
    const qualityScore = computeQualityEvidenceScore(prod);

    const priceDelta = calculateTargetPriceDelta(prod.unitPrice, targetPrice);
    const isInInitialRange =
      prod.unitPrice >= tolerance.minPrice && prod.unitPrice <= tolerance.maxPrice;

    // Composite scoring: must-have match first, then price proximity and quality
    let composite = reqScore * 0.4 + proximityScore * 0.35 + qualityScore * 0.25;

    // In-range bonus
    if (isInInitialRange) {
      composite += 10;
    }

    // Heavy penalty if violating must-haves
    if (!satisfiesMustHaves) {
      composite = Math.min(30, composite * 0.3);
    }

    // Rationale construction
    let rationale = "";
    if (isInInitialRange) {
      rationale = `Matches your target price of ₹${targetPrice.toLocaleString(
        "en-IN"
      )} (${priceDelta.formattedDelta}) within the ₹${tolerance.minPrice.toLocaleString(
        "en-IN"
      )}–₹${tolerance.maxPrice.toLocaleString("en-IN")} range.`;
    } else {
      rationale = `Priced at ₹${prod.unitPrice.toLocaleString(
        "en-IN"
      )} (${priceDelta.formattedDelta}), selected to satisfy requirements.`;
    }

    if (suitability.matchedMustHaves.length > 0) {
      rationale += ` Verified specs: ${suitability.matchedMustHaves.join(", ")}.`;
    }

    return {
      product: prod,
      compositeScore: Math.round(composite),
      proximityScore,
      requirementScore: reqScore,
      qualityScore,
      priceDelta,
      satisfiesMustHaves,
      isInInitialRange,
      priceFitRationale: rationale,
    };
  });

  // Strict sorting order:
  // 1. Must-have compliance (satisfying must-haves beats non-satisfying)
  // 2. Composite score descending
  // 3. Proximity score descending
  // 4. Quality score descending
  evaluated.sort((a, b) => {
    if (a.satisfiesMustHaves && !b.satisfiesMustHaves) return -1;
    if (!a.satisfiesMustHaves && b.satisfiesMustHaves) return 1;
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    if (b.proximityScore !== a.proximityScore) return b.proximityScore - a.proximityScore;
    return b.qualityScore - a.qualityScore;
  });

  return evaluated;
}

/**
 * Evaluates and ranks candidates specifically for `single_product_max`.
 * Prioritizes suitability, verified quality, and value, NOT closeness to maximum price.
 */
export function rankCandidatesForSingleProductMax(
  candidates: NormalizedProduct[],
  maxPrice: number,
  userRequirements: UserRequirement[] = [],
  preference: UserTradeOffPreference = "balanced"
): RankedProductCandidate[] {
  // Hard filter: price <= maxPrice
  const eligible = candidates.filter((c) => c.unitPrice <= maxPrice);

  const evaluated: RankedProductCandidate[] = eligible.map((prod) => {
    const suitability = evaluateProductSuitability(prod, userRequirements);
    const satisfiesMustHaves = !suitability.violatesMustHave;
    const reqScore = satisfiesMustHaves ? suitability.score : 15;
    const qualityScore = computeQualityEvidenceScore(prod);

    // Cost efficiency score (higher for better value without forcing closeness to max)
    const costRatio = prod.unitPrice / maxPrice;
    const valueScore = Math.round(100 - costRatio * 40); // cheaper gets moderate cost advantage

    let composite = 0;
    if (preference === "lowest_cost") {
      composite = valueScore * 0.5 + reqScore * 0.3 + qualityScore * 0.2;
    } else if (preference === "quality") {
      composite = qualityScore * 0.5 + reqScore * 0.35 + valueScore * 0.15;
    } else {
      // balanced
      composite = reqScore * 0.4 + qualityScore * 0.35 + valueScore * 0.25;
    }

    if (!satisfiesMustHaves) {
      composite = Math.min(25, composite * 0.25);
    }

    const priceDelta = calculateTargetPriceDelta(prod.unitPrice, maxPrice);
    const savings = Math.max(0, maxPrice - prod.unitPrice);
    const rationale = `Priced at ₹${prod.unitPrice.toLocaleString(
      "en-IN"
    )}, well within your ₹${maxPrice.toLocaleString("en-IN")} ceiling (saving ₹${savings.toLocaleString(
      "en-IN"
    )}).`;

    return {
      product: prod,
      compositeScore: Math.round(composite),
      proximityScore: 100, // not evaluated for proximity in max mode
      requirementScore: reqScore,
      qualityScore,
      priceDelta,
      satisfiesMustHaves,
      isInInitialRange: true,
      priceFitRationale: rationale,
    };
  });

  evaluated.sort((a, b) => {
    if (a.satisfiesMustHaves && !b.satisfiesMustHaves) return -1;
    if (!a.satisfiesMustHaves && b.satisfiesMustHaves) return 1;
    return b.compositeScore - a.compositeScore;
  });

  return evaluated;
}
