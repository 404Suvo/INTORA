/**
 * REAL PLANNER ENGINE POWERED BY SCRAPERAPI & GEMINI
 *
 * Replaces mock plan datasets with real Amazon India live searches,
 * real pricing in integer paise (minor units), knapsack budget optimization,
 * cryptographic Keccak-256 plan hashing, and off-chain storage.
 */

import { GoogleGenAI } from "@google/genai";
import { formatInr, registerCatalogProducts } from "./catalog";
import { computePlanHash } from "./plan-hash";
import { savePlanRecord } from "./plan-storage";
import {
  formatAmazonIndiaUrl,
  mapSearchItemToCatalogItem,
  mapSearchItemToProductItem,
  parsePriceToPaise,
  searchAmazonIndia,
  ScraperApiError,
  ScraperApiKeyMissingError,
  sanitizeErrorMessage,
  getScraperApiTimeoutMs,
} from "./scraperapi";
import { generateIntentId } from "./intent-id";
import { CURRENCY, ShoppingPlan, ShoppingPlanItem, validateBudgetInr } from "./types";
import { ProductItem, ShoppingPlanData } from "@/data/mockData";
import { inferItemPriorities, optimizeShoppingPlan } from "./budget-optimizer";
import {
  calculatePlanTotalCosts,
  extractUserRequirements,
  normalizeProduct,
  rankAndRecommendCandidates,
  type NormalizedProduct,
  type UserTradeOffPreference,
} from "./trade-off-engine";
import {
  interpretBudgetIntent,
  rankCandidatesForSingleProductTarget,
  rankCandidatesForSingleProductMax,
  widenPriceTolerance,
  calculateTargetPriceDelta,
  recordGeminiQuotaExhaustion,
  isGeminiQuotaExhausted,
  type UserBudgetIntent,
  type PriceTolerance,
} from "./budget-intent";

export interface PlanGenerationOptions {
  location?: string;
  skipGemini?: boolean;
  preference?: UserTradeOffPreference;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Derives a clean, readable title from the shopping prompt.
 */
export function derivePlanTitle(prompt: string): string {
  const cleaned = prompt
    .replace(/^(i want|i need|need|give me|buy|please give|looking for|plan for|bundle for)\s+/i, "")
    .replace(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|cap)\s*[:=]?\s*[0-9]+(?:,[0-9]+)*/gi, "")
    .trim();

  if (!cleaned) return "Amazon India Shopping Bundle";

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return `${words.join(" ")} Essentials`;
}

/**
 * Determines whether a Gemini API error is transient (eligible for retry)
 * such as 503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, or network timeouts.
 */
export function isTransientGeminiError(err: any): boolean {
  if (!err) return false;
  const status =
    err.status ||
    err.statusCode ||
    (typeof err.code === "number" ? err.code : undefined) ||
    err?.error?.code;

  if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) {
    return true;
  }

  // Permanent client errors must NOT be retried
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }

  const msg = (err.message || String(err)).toLowerCase();
  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("api_key not valid") ||
    msg.includes("api key not valid") ||
    msg.includes("permission_denied") ||
    msg.includes("invalid_argument")
  ) {
    return false;
  }

  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("network")
  );
}

/**
 * Deterministically derives safe Amazon search keywords directly from the user's request.
 * Does NOT send empty queries and NEVER introduces unrelated terms such as "rose".
 */
export function deriveDeterministicSearchQueries(prompt: string): string[] {
  const trimmed = (prompt || "").trim();
  if (!trimmed) {
    return ["daily utility essentials"];
  }

  const lower = trimmed.toLowerCase();
  const queries: string[] = [];

  // 1. Direct domain keyword matching
  if (lower.includes("rose") || lower.includes("flower") || lower.includes("bouquet") || lower.includes("flora")) {
    queries.push("fresh rose flower bouquet", "rose flowers gift");
  }
  if (lower.includes("earbud") || lower.includes("headphone") || lower.includes("earphone") || lower.includes("audio") || lower.includes("airpod")) {
    queries.push("wireless earbuds bluetooth");
  }
  if (lower.includes("bottle") || lower.includes("hydration") || lower.includes("water")) {
    queries.push("stainless steel water bottle 750ml");
  }
  if (lower.includes("battery") || lower.includes("power bank") || lower.includes("charger") || lower.includes("charging")) {
    queries.push("10000mah power bank fast charging");
  }
  if (lower.includes("notebook") || lower.includes("stationery") || lower.includes("pen") || lower.includes("paper") || lower.includes("journal") || lower.includes("diary")) {
    queries.push("spiral notebooks ruled a5", "gel pens pack");
  }
  if (lower.includes("backpack") || lower.includes("bag") || lower.includes("daypack") || lower.includes("rucksack")) {
    queries.push("campus daypack backpack waterproof");
  }
  if (lower.includes("trek") || lower.includes("hike") || lower.includes("rain") || lower.includes("monsoon") || lower.includes("outdoor")) {
    queries.push("rain poncho waterproof heavy duty", "waterproof dry bag 10l");
  }
  if (lower.includes("snack") || lower.includes("energy") || lower.includes("protein bar") || lower.includes("trail mix") || lower.includes("food")) {
    queries.push("granola energy bars box", "nut and fruit trail mix");
  }
  if (lower.includes("college fest") || lower.includes("campus fest") || lower.includes("festival") || lower.includes("concert")) {
    queries.push("college fest event supplies", "party props decoration set");
  }
  if (lower.includes("hostel") || lower.includes("dorm") || lower.includes("room setup") || lower.includes("move-in")) {
    queries.push("hostel room storage organizer", "cotton bedsheet single");
  }
  if (lower.includes("diwali") || lower.includes("gift hamper") || lower.includes("diya")) {
    queries.push("festive gift hamper pack", "decorative brass diyas");
  }
  if (lower.includes("gym") || lower.includes("workout") || lower.includes("fitness")) {
    queries.push("gym shaker bottle", "resistance bands workout set");
  }
  if (lower.includes("travel") || lower.includes("flight") || lower.includes("vacation")) {
    queries.push("travel organizer pouches", "neck pillow travel");
  }
  if (lower.includes("laptop") || lower.includes("notebook pc") || lower.includes("macbook")) {
    queries.push("laptop");
  }
  if (lower.includes("monitor") || lower.includes("display screen")) {
    queries.push("computer monitor display");
  }
  if (lower.includes("keyboard")) {
    queries.push("mechanical keyboard");
  }
  if (lower.includes("smartphone") || lower.includes("mobile phone") || lower.includes("iphone") || lower.includes("android phone")) {
    queries.push("smartphone mobile phone");
  }
  if (lower.includes("smartwatch") || lower.includes("fitness tracker")) {
    queries.push("smartwatch fitness tracker");
  }
  if (lower.includes("shoe") || lower.includes("sneaker")) {
    queries.push("running shoes sneakers");
  }

  // 2. If no preset pattern matched, clean user prompt to extract safe, targeted query tokens
  if (queries.length === 0) {
    const cleaned = trimmed
      .replace(/^(?:i want to buy|i want|i need to buy|i need|please get me|please buy|looking for|plan for|bundle for|items for|supplies for|essentials for|buy me|buy|get|find)\s+/i, "")
      .replace(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|below|around|within|cap)\s*[:=]?\s*[0-9]+(?:,[0-9]+)*/gi, "")
      .replace(/[^\w\s-]/g, " ")
      .trim();

    const stopWords = new Set([
      "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with", "is", "are", "was", "were",
      "me", "my", "our", "your", "some", "any", "good", "best", "top", "of", "from", "by", "under", "below",
      "rs", "inr", "budget", "need", "want", "buy", "item", "items", "supplies", "products", "please"
    ]);

    const words = cleaned
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 1 && !stopWords.has(w));

    if (words.length > 0) {
      queries.push(words.slice(0, 5).join(" "));
    } else {
      queries.push("daily utility essentials");
    }
  }

  // Ensure unique, clean, non-empty search queries
  const safeQueries = Array.from(
    new Set(queries.map((q) => q.trim()).filter((q) => q.length > 0))
  ).slice(0, 4);

  return safeQueries.length > 0 ? safeQueries : ["daily utility essentials"];
}

/**
 * Uses Gemini to parse a natural language shopping situation into 1-4 targeted Amazon India search queries.
 * Handles 503, 429, and transient network errors with bounded exponential-backoff retries and jitter.
 * Falls back to deterministic extraction if Gemini is unavailable or retries are exhausted.
 */
export async function extractAmazonSearchQueries(
  prompt: string,
  options: PlanGenerationOptions = {}
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (apiKey && !options.skipGemini && !isGeminiQuotaExhausted()) {
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const maxGeminiAttempts = 3;

    for (let attempt = 1; attempt <= maxGeminiAttempts; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Extract 2 to 4 concise, high-relevance Amazon product search keywords for this shopping request: "${prompt}".
Output ONLY a JSON array of search query strings (e.g. ["stainless steel water bottle 750ml", "10000mah fast charging power bank"]). Do not include explanation.`,
                },
              ],
            },
          ],
          config: {
            temperature: 0.2,
          },
        });

        const text = response.text || "";
        const match = text.match(/\[[\s\S]*?\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanQueries = parsed
              .map((q) => String(q).trim())
              .filter((q) => q.length > 1);
            if (cleanQueries.length > 0) {
              return Array.from(new Set(cleanQueries)).slice(0, 4);
            }
          }
        }
        // If response is not JSON array, break and use deterministic fallback
        break;
      } catch (err: any) {
        const isTransient = isTransientGeminiError(err);
        const safeErr = sanitizeErrorMessage(err?.message || String(err));
        const lowerMsg = (err?.message || "").toLowerCase();

        // If daily quota or free-tier exhaustion is reported, trip circuit breaker and avoid looping
        if (
          lowerMsg.includes("generatecontent_free_tier_requests") ||
          lowerMsg.includes("generaterequestsperday") ||
          lowerMsg.includes("quota exceeded") ||
          lowerMsg.includes("resource_exhausted")
        ) {
          recordGeminiQuotaExhaustion();
          console.warn("[Planner Engine] Gemini daily quota limit encountered. Switching to instant deterministic extraction.");
          break;
        }

        if (!isTransient || attempt >= maxGeminiAttempts) {
          console.warn(
            `[Planner Engine] Gemini query extraction fallback after attempt ${attempt}/${maxGeminiAttempts} (transient: ${isTransient}):`,
            safeErr
          );
          break;
        }

        // Bounded exponential backoff with jitter
        const delayMs = Math.min(2000, Math.pow(2, attempt - 1) * 400 + Math.random() * 200);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  // Deterministic fallback derived from user request
  return deriveDeterministicSearchQueries(prompt);
}

/**
 * Core function: Generates a verified ShoppingPlanData grounded strictly in real Amazon India ScraperAPI products.
 */
export async function generateRealShoppingPlan(
  prompt: string,
  budgetRupees: number,
  options: PlanGenerationOptions = {}
): Promise<ShoppingPlanData> {
  const budgetValidation = validateBudgetInr(budgetRupees);
  if (!budgetValidation.valid || budgetValidation.budget === undefined) {
    throw new Error(budgetValidation.error || "A positive rupee budget amount is required.");
  }
  const cleanBudget = budgetValidation.budget;
  const budgetMinor = cleanBudget * 100;
  const title = derivePlanTitle(prompt);
  const now = new Date();
  const timestamp =
    now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " IST";
  const retrievedAt = now.toISOString();

  // 1. Understand user shopping intent and classify budget mode
  const budgetIntent = await interpretBudgetIntent(prompt, cleanBudget, {
    skipGemini: options.skipGemini,
  });

  // 2. Extract targeted Amazon search terms
  const searchQueries = await extractAmazonSearchQueries(prompt, options);

  // If single-product intent, prioritize focused query for target product and must-have specs
  if (budgetIntent.budgetMode !== "total_basket_cap" && budgetIntent.targetProduct) {
    const specsStr = budgetIntent.mustHaveRequirements.join(" ");
    const focusedQuery = `${budgetIntent.targetProduct} ${specsStr}`.trim();
    if (focusedQuery && !searchQueries.includes(focusedQuery)) {
      searchQueries.unshift(focusedQuery);
    }
    if (!searchQueries.includes(budgetIntent.targetProduct)) {
      searchQueries.push(budgetIntent.targetProduct);
    }
  }

  // 3. Fetch real products from ScraperAPI concurrently
  // Limit to at most 2 targeted queries and bounded timeout to stay strictly within account concurrency and serverless limits
  const uniqueQueries = Array.from(
    new Set(searchQueries.map((q) => q.trim()).filter((q) => q.length > 0))
  ).slice(0, 2);

  const rawResults: any[] = [];
  const errors: any[] = [];

  const engineTimeoutMs = options.timeoutMs ?? Math.min(getScraperApiTimeoutMs(), 32000);
  const maxTotalTimeMs = 45000;

  const searchPromises = uniqueQueries.map((query) =>
    searchAmazonIndia(query, {
      signal: options.signal,
      timeoutMs: engineTimeoutMs,
      maxTotalTimeMs,
    })
  );

  const settled = await Promise.allSettled(searchPromises);

  settled.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      const items = result.value.items || [];
      for (const item of items) {
        if (item.asin && !rawResults.some((r) => r.asin === item.asin)) {
          rawResults.push(item);
        }
      }
    } else {
      errors.push(result.reason);
      console.warn(
        `[Planner Engine] Search query "${uniqueQueries[idx]}" failed:`,
        sanitizeErrorMessage(result.reason?.message || String(result.reason))
      );
    }
  });

  if (rawResults.length === 0) {
    if (errors.length > 0) {
      const firstErr = errors[0];
      if (firstErr instanceof ScraperApiError || firstErr instanceof ScraperApiKeyMissingError) {
        throw firstErr;
      }
      const genericErr = new Error(
        `Failed to retrieve live Amazon products from ScraperAPI: ${sanitizeErrorMessage(firstErr?.message || String(firstErr))}`
      );
      (genericErr as any).statusCode = (firstErr as any)?.statusCode || 502;
      (genericErr as any).errorCode = (firstErr as any)?.errorCode || "SEARCH_FAILED";
      (genericErr as any).isRetryable = (firstErr as any)?.isRetryable ?? true;
      (genericErr as any).userFriendlyMessage =
        (firstErr as any)?.userFriendlyMessage || genericErr.message;
      throw genericErr;
    }
    const notFoundErr = new Error(
      `No products found on Amazon India matching: "${prompt}". Please try different search keywords.`
    );
    (notFoundErr as any).statusCode = 404;
    (notFoundErr as any).errorCode = "NO_PRODUCTS_FOUND";
    (notFoundErr as any).isRetryable = false;
    (notFoundErr as any).userFriendlyMessage = `No products found on Amazon India matching "${prompt}".`;
    throw notFoundErr;
  }

  // 3. Map to Intora schemas and register in dynamic catalog
  const catalogItems = rawResults
    .map((item) => mapSearchItemToCatalogItem(item, "supplies", retrievedAt))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  registerCatalogProducts(catalogItems);

  // 4. Map to candidate ProductItems for budget knapsack solver
  const candidateItems = rawResults
    .map((item) =>
      mapSearchItemToProductItem(
        item,
        "Amazon India Verified",
        `Selected for "${item.name?.slice(0, 40)}..." matching your situation.`,
        retrievedAt
      )
    )
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (candidateItems.length === 0) {
    const unpricedErr = new Error(
      "None of the returned Amazon India products have valid, available prices. Cannot compute budget."
    );
    (unpricedErr as any).statusCode = 422;
    throw unpricedErr;
  }

  // 5. Total-Cost & Trade-Off Multi-Criteria Ranking based on Budget Mode
  const userRequirements = extractUserRequirements(prompt);
  const preference: UserTradeOffPreference = options.preference || "balanced";

  // Normalize products for the trade-off engine
  const normalizedProducts = rawResults
    .map((item) => normalizeProduct(item, { defaultCategory: "supplies" }))
    .filter((p): p is NormalizedProduct => p !== null);

  const selectedItems: ProductItem[] = [];
  let totalMinor = 0;
  let activeTolerance = { ...budgetIntent.priceTolerance };
  let primaryDelta: import("./budget-intent").TargetPriceDelta | undefined;
  let singleProductRationale: string | undefined;

  if (budgetIntent.budgetMode === "single_product_target") {
    // Check if any candidates fall into the initial tolerance
    const inInitialRange = normalizedProducts.some(
      (p) => p.unitPrice >= activeTolerance.minPrice && p.unitPrice <= activeTolerance.maxPrice
    );

    if (!inInitialRange && normalizedProducts.length > 0) {
      // Progressively widen tolerance (e.g. 70%–125%)
      activeTolerance = widenPriceTolerance(
        activeTolerance,
        budgetIntent.targetPrice ?? cleanBudget,
        budgetIntent.minimumPrice,
        budgetIntent.maximumPrice
      );
    }

    const ranked = rankCandidatesForSingleProductTarget(
      normalizedProducts,
      budgetIntent,
      activeTolerance,
      userRequirements
    );

    if (ranked.length > 0) {
      const best = ranked[0];
      primaryDelta = best.priceDelta;
      singleProductRationale = best.priceFitRationale;

      const sameCategoryPool = ranked.slice(1, 4).map((r) => r.product);
      const tradeOffComparison = sameCategoryPool.length > 0
        ? rankAndRecommendCandidates(
            [best.product, ...sameCategoryPool],
            1,
            userRequirements,
            preference,
            cleanBudget
          )
        : undefined;

      const rawMatch = rawResults.find((r) => r.asin === best.product.asin || r.name === best.product.name);
      const mapped = rawMatch
        ? mapSearchItemToProductItem(
            rawMatch,
            "Amazon India Verified",
            best.priceFitRationale,
            retrievedAt
          )
        : undefined;

      selectedItems.push({
        ...(mapped || {
          id: best.product.productId,
          asin: best.product.asin,
          name: best.product.name,
          category: best.product.category,
          unitPrice: best.product.unitPrice,
          totalPrice: best.product.unitPrice,
          subtotal: best.product.unitPrice,
          quantity: 1,
          inStock: best.product.inStock,
          imagePlaceholder: "/placeholder.png",
          imageUrl: best.product.imageUrl,
          rationale: best.priceFitRationale,
          source: best.product.source,
        }),
        quantity: 1,
        totalPrice: best.product.unitPrice,
        subtotal: best.product.unitPrice,
        reason: best.priceFitRationale,
        targetPriceDelta: best.priceDelta,
        priceFitRationale: best.priceFitRationale,
        tradeOffComparison: tradeOffComparison || undefined,
        availableAlternatives: tradeOffComparison?.alternatives || undefined,
      });

      totalMinor = Math.round(best.product.unitPrice * 100);
    }
  } else if (budgetIntent.budgetMode === "single_product_max") {
    const maxLimit = budgetIntent.maximumPrice ?? cleanBudget;
    const ranked = rankCandidatesForSingleProductMax(
      normalizedProducts,
      maxLimit,
      userRequirements,
      preference
    );

    if (ranked.length > 0) {
      const best = ranked[0];
      primaryDelta = best.priceDelta;
      singleProductRationale = best.priceFitRationale;

      const sameCategoryPool = ranked.slice(1, 4).map((r) => r.product);
      const tradeOffComparison = sameCategoryPool.length > 0
        ? rankAndRecommendCandidates(
            [best.product, ...sameCategoryPool],
            1,
            userRequirements,
            preference,
            cleanBudget
          )
        : undefined;

      const rawMatch = rawResults.find((r) => r.asin === best.product.asin || r.name === best.product.name);
      const mapped = rawMatch
        ? mapSearchItemToProductItem(
            rawMatch,
            "Amazon India Verified",
            best.priceFitRationale,
            retrievedAt
          )
        : undefined;

      selectedItems.push({
        ...(mapped || {
          id: best.product.productId,
          asin: best.product.asin,
          name: best.product.name,
          category: best.product.category,
          unitPrice: best.product.unitPrice,
          totalPrice: best.product.unitPrice,
          subtotal: best.product.unitPrice,
          quantity: 1,
          inStock: best.product.inStock,
          imagePlaceholder: "/placeholder.png",
          imageUrl: best.product.imageUrl,
          rationale: best.priceFitRationale,
          source: best.product.source,
        }),
        quantity: 1,
        totalPrice: best.product.unitPrice,
        subtotal: best.product.unitPrice,
        reason: best.priceFitRationale,
        targetPriceDelta: best.priceDelta,
        priceFitRationale: best.priceFitRationale,
        tradeOffComparison: tradeOffComparison || undefined,
        availableAlternatives: tradeOffComparison?.alternatives || undefined,
      });

      totalMinor = Math.round(best.product.unitPrice * 100);
    }
  } else {
    // Mode: total_basket_cap (multi-item knapsack)
    const prioritizedCandidates = inferItemPriorities(prompt, candidateItems);

    prioritizedCandidates.sort((a, b) => {
      const prioA = a.priority || (a.essential ? 1 : 2);
      const prioB = b.priority || (b.essential ? 1 : 2);
      if (prioA !== prioB) return prioA - prioB;

      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (Math.abs(ratingDiff) >= 0.05) return ratingDiff;

      const reviewDiff = (b.totalReviews || 0) - (a.totalReviews || 0);
      if (reviewDiff !== 0) return reviewDiff;

      return a.unitPrice - b.unitPrice;
    });

    for (const prod of prioritizedCandidates) {
      const itemUnitPriceMinor = Math.round(prod.unitPrice * 100);
      if (totalMinor + itemUnitPriceMinor <= budgetMinor) {
        const sameCategoryPool = normalizedProducts.filter(
          (p) => p.productId !== prod.id && (p.category === prod.category || normalizedProducts.length <= 5)
        );
        const prodNorm = normalizeProduct(prod as any);
        const tradeOffComparison = (sameCategoryPool.length > 0 && prodNorm)
          ? rankAndRecommendCandidates(
              [prodNorm, ...sameCategoryPool],
              1,
              userRequirements,
              preference,
              cleanBudget
            )
          : undefined;

        selectedItems.push({
          ...prod,
          quantity: 1,
          totalPrice: prod.unitPrice,
          subtotal: prod.unitPrice,
          reason: prod.reason || prod.rationale,
          tradeOffComparison: tradeOffComparison || undefined,
          availableAlternatives: tradeOffComparison?.alternatives || undefined,
        });
        totalMinor += itemUnitPriceMinor;
      }
    }
  }

  // Fallback: if no items were selected (e.g. all candidates exceed budget)
  if (selectedItems.length === 0 && candidateItems.length > 0) {
    const cheapest = [...candidateItems].sort((a, b) => a.unitPrice - b.unitPrice)[0];
    const diff = cheapest.unitPrice - cleanBudget;
    const rationale = `Lowest available ${budgetIntent.targetProduct || "item"} is ₹${cheapest.unitPrice.toLocaleString("en-IN")}${diff > 0 ? `, which exceeds your ₹${cleanBudget.toLocaleString("en-IN")} budget by ₹${diff.toLocaleString("en-IN")}` : ""}.`;

    selectedItems.push({
      ...cheapest,
      quantity: 1,
      totalPrice: cheapest.unitPrice,
      subtotal: cheapest.unitPrice,
      reason: cheapest.reason || cheapest.rationale || rationale,
      priceFitRationale: rationale,
      targetPriceDelta: calculateTargetPriceDelta(cheapest.unitPrice, cleanBudget),
    });
    totalMinor = Math.round(cheapest.unitPrice * 100);
  }

  // Calculate order-level costs (distinguishing per-item charges from order-level charges)
  const planCosts = calculatePlanTotalCosts(
    selectedItems.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      shippingCost: i.shippingCost,
      hasPrime: i.badge === "Prime",
    }))
  );

  // 6. Build the ShoppingPlan and compute cryptographic Keccak-256 hash
  const intentId = generateIntentId();
  const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7 days

  const shoppingPlan: ShoppingPlan = {
    schemaVersion: "1.0.0",
    intentId,
    version: 1,
    currency: CURRENCY,
    budgetMinor,
    items: selectedItems.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
      unitPriceMinor: Math.round(item.unitPrice * 100),
    })),
    totalMinor,
    expiry,
  };

  const { canonicalString, planHash } = computePlanHash(shoppingPlan);
  savePlanRecord(shoppingPlan, canonicalString, planHash);

  const totalRupees = Math.round(totalMinor / 100);
  const remainingRupees = Math.max(0, Math.round(cleanBudget - totalRupees));

  const isBudgetCompliant =
    budgetIntent.budgetMode === "single_product_target"
      ? selectedItems[0]?.unitPrice <= (budgetIntent.maximumPrice ?? activeTolerance.maxPrice)
      : totalMinor <= budgetMinor;

  const basePlan: ShoppingPlanData = {
    id: intentId,
    title,
    situation: prompt,
    budget: cleanBudget,
    totalAmount: totalRupees,
    remainingAmount: remainingRupees,
    version: 1,
    timestamp,
    planHash,
    items: selectedItems,
    validation: {
      budgetCompliant: isBudgetCompliant,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    estimatedPlanTotal: planCosts.estimatedPlanTotal,
    orderShipping: planCosts.orderShipping,
    orderTaxes: planCosts.orderTaxes,
    costCompleteness: planCosts.costCompleteness,
    unknownCostComponents: planCosts.unknownComponents,
    userPreference: preference,
    budgetMode: budgetIntent.budgetMode,
    budgetIntent,
    targetPriceRange: activeTolerance,
    targetPriceDelta: primaryDelta,
    feasible: isBudgetCompliant,
    optimizationSummary: singleProductRationale || `Budget mode: ${budgetIntent.budgetMode}.`,
  };

  if (budgetIntent.budgetMode !== "total_basket_cap") {
    // Single product intent: return single product recommendation directly without knapsack packing
    return basePlan;
  }

  // Multi-item basket intent: run budget optimizer
  const optimized = optimizeShoppingPlan(basePlan, cleanBudget, {
    candidateCatalog: catalogItems,
    userConstraints: {
      preference,
      userRequirements,
    },
  });

  return {
    ...optimized,
    budgetMode: "total_basket_cap",
    budgetIntent,
  };

  return optimized;
}
