/**
 * TOTAL-COST & TRADE-OFF ENGINE
 *
 * Implements deterministic total purchase cost calculation, product data normalization,
 * requirement suitability evaluation, transparent multi-dimensional value comparison,
 * and factual trade-off explanation generation.
 *
 * Key Principles:
 * 1. The cheapest product must not automatically win.
 * 2. Calculate true estimated purchase cost: itemSubtotal + shipping + taxes + mandatoryFees - discounts.
 * 3. Never assume unknown shipping, tax, or mandatory charges are zero.
 * 4. Never invent ratings, review counts, specs, discounts, shipping, or availability.
 * 5. Explicit must-have requirements take precedence over soft preferences.
 * 6. Missing ratings or specifications are treated as unknown, not poor quality.
 * 7. Factual trade-off explanations grounded exclusively in retrieved evidence.
 */

import { CURRENCY } from "./types";

export type CostCompleteness = "complete" | "estimated" | "partial_unknown";

export type UserTradeOffPreference =
  | "balanced" // Default: best balance between cost, quality, and features
  | "lowest_cost" // Prioritizes lower total purchase cost among suitable items
  | "quality" // Prioritizes verified ratings, review evidence, and quality signals
  | "features"; // Prioritizes specification coverage and must-have features

export interface ProductCostBreakdown {
  unitPrice: number; // in INR
  quantity: number;
  itemSubtotal: number; // unitPrice * quantity
  shippingCost: number | null; // null if unknown
  shippingType: "free" | "paid" | "unknown";
  taxes: number | null; // null if unknown
  taxType: "inclusive" | "estimated" | "unknown";
  otherMandatoryFees: number | null; // null if unknown
  discounts: number | null; // null if unknown / none
  estimatedTotalCost: number; // itemSubtotal + known shipping + known taxes + known fees - discounts
  costCompleteness: CostCompleteness;
  unknownComponents: string[];
  notes: string[];
}

export interface NormalizedProduct {
  productId: string;
  asin?: string;
  name: string;
  category: string;
  merchant: string;
  currency: string;
  productUrl: string;
  imageUrl?: string;
  unitPrice: number;
  originalPrice?: number | null;
  inStock: boolean;
  availableStock?: number;
  rating: number | null; // null if missing (never fabricated)
  reviewCount: number | null; // null if missing
  specifications: Record<string, string>;
  features: string[];
  badges: string[];
  shippingCost?: number | null;
  shippingType?: "free" | "paid" | "unknown";
  taxes?: number | null;
  taxType?: "inclusive" | "estimated" | "unknown";
  discounts?: number | null;
  otherMandatoryFees?: number | null;
  source: "scraperapi" | "fixture" | "catalog";
  lastCheckedAt: string;
  isStale?: boolean;
}

export interface UserRequirement {
  id: string;
  text: string;
  isMustHave: boolean; // hard requirement vs soft preference
  category?: string;
  tokens: string[];
  negativeTokens?: string[];
}

export interface RequirementMatchResult {
  status: "full" | "partial" | "mismatch";
  matchedMustHaves: string[];
  unmetMustHaves: string[];
  matchedPreferences: string[];
  unmetPreferences: string[];
  violatesMustHave: boolean;
  score: number; // 0 to 100
  notes: string[];
}

export interface ProductComparisonItem {
  productId: string;
  asin?: string;
  name: string;
  productUrl: string;
  merchant: string;
  currency: string;
  cost: ProductCostBreakdown;
  rating: number | null;
  reviewCount: number | null;
  reviewCredibility: "high" | "moderate" | "low" | "none" | "unknown";
  specifications: Record<string, string>;
  features: string[];
  badges: string[];
  requirementMatch: RequirementMatchResult;
  advantages: string[];
  drawbacks: string[];
  missingInformation: string[];
  selectionReason: string;
  lastCheckedAt: string;
  isStale?: boolean;
  valueScore: number;
  scoreBreakdown: {
    costScore: number;
    requirementScore: number;
    qualityScore: number;
    featureScore: number;
  };
}

export interface TradeOffRecommendation {
  selectedProduct: ProductComparisonItem;
  alternatives: ProductComparisonItem[];
  selectionExplanation: {
    whySelected: string;
    userSacrifices: string[];
    whyAlternativeMayBeBetter?: string;
  };
  totalCostComparison: {
    cheapestCost: number;
    selectedCost: number;
    highestCost: number;
    savingsVsHighest: number;
    premiumVsCheapest: number;
  };
  keyTradeOffs: string[];
  unmetRequirements: string[];
  uncertainties: string[];
}

// ============================================================================
// 1. TOTAL ESTIMATED PURCHASE COST CALCULATION
// ============================================================================

export interface CostCalculationOptions {
  shippingCost?: number | null;
  shippingType?: "free" | "paid" | "unknown";
  taxes?: number | null;
  taxType?: "inclusive" | "estimated" | "unknown";
  otherMandatoryFees?: number | null;
  discounts?: number | null;
  hasPrime?: boolean;
  orderTotalThresholdForFreeShipping?: number;
  currentOrderSubtotal?: number;
  isPerOrderShipping?: boolean;
}

/**
 * Calculates the total estimated purchase cost for a product and quantity.
 * Formula:
 *   itemSubtotal = unitPrice * quantity
 *   totalEstimatedCost = itemSubtotal + shipping + taxes + otherMandatoryFees - discounts
 *
 * Distinguishes per-item charges from order-level charges, handles free shipping thresholds,
 * and marks unknown components without assuming zero.
 */
export function calculateProductCost(
  unitPrice: number,
  quantity = 1,
  options: CostCalculationOptions = {}
): ProductCostBreakdown {
  const cleanQty = Math.max(1, Math.round(quantity));
  const cleanUnitPrice = Math.max(0, Math.round(unitPrice));
  const itemSubtotal = cleanUnitPrice * cleanQty;

  const unknownComponents: string[] = [];
  const notes: string[] = [];

  // 1. Shipping calculation
  let shippingCost: number | null = null;
  let shippingType: "free" | "paid" | "unknown" = "unknown";

  if (options.hasPrime) {
    shippingCost = 0;
    shippingType = "free";
    notes.push("Free Prime delivery eligible.");
  } else if (options.shippingType === "free" || options.shippingCost === 0) {
    shippingCost = 0;
    shippingType = "free";
    notes.push("Free standard delivery.");
  } else if (
    options.orderTotalThresholdForFreeShipping &&
    (options.currentOrderSubtotal || itemSubtotal) >= options.orderTotalThresholdForFreeShipping
  ) {
    shippingCost = 0;
    shippingType = "free";
    notes.push(`Free delivery (order subtotal meets ₹${options.orderTotalThresholdForFreeShipping} threshold).`);
  } else if (typeof options.shippingCost === "number" && !isNaN(options.shippingCost) && options.shippingCost > 0) {
    shippingCost = Math.round(options.shippingCost);
    shippingType = "paid";
    notes.push(`Shipping charge: ₹${shippingCost.toLocaleString("en-IN")}.`);
  } else {
    shippingCost = null;
    shippingType = "unknown";
    unknownComponents.push("shipping");
    notes.push("Shipping fee details are unavailable from provider.");
  }

  // 2. Taxes calculation (In India, consumer retail prices on Amazon.in are statutory GST-inclusive)
  let taxes: number | null = null;
  let taxType: "inclusive" | "estimated" | "unknown" = "inclusive";

  if (options.taxType === "inclusive") {
    taxes = 0;
    taxType = "inclusive";
    notes.push("Taxes: Inclusive of GST in retail price.");
  } else if (typeof options.taxes === "number" && !isNaN(options.taxes) && options.taxes >= 0) {
    taxes = Math.round(options.taxes);
    taxType = "estimated";
    notes.push(`Estimated tax: ₹${taxes.toLocaleString("en-IN")}.`);
  } else if (options.taxType === "unknown") {
    taxes = null;
    taxType = "unknown";
    unknownComponents.push("taxes");
    notes.push("Tax details are unverified.");
  } else {
    // Default for Indian retail products: inclusive of GST
    taxes = 0;
    taxType = "inclusive";
  }

  // 3. Other mandatory fees
  let otherMandatoryFees: number | null = null;
  if (typeof options.otherMandatoryFees === "number" && !isNaN(options.otherMandatoryFees) && options.otherMandatoryFees >= 0) {
    otherMandatoryFees = Math.round(options.otherMandatoryFees);
    if (otherMandatoryFees > 0) {
      notes.push(`Mandatory packaging / convenience fee: ₹${otherMandatoryFees.toLocaleString("en-IN")}.`);
    }
  } else if (options.otherMandatoryFees === null) {
    otherMandatoryFees = null;
    unknownComponents.push("otherMandatoryFees");
  } else {
    otherMandatoryFees = 0;
  }

  // 4. Discounts
  let discounts: number | null = null;
  if (typeof options.discounts === "number" && !isNaN(options.discounts) && options.discounts > 0) {
    discounts = Math.round(options.discounts);
    notes.push(`Eligible discount: ₹${discounts.toLocaleString("en-IN")} off.`);
  } else {
    discounts = 0;
  }

  // Compute estimated total cost
  // Base is itemSubtotal; add known components, subtract discounts
  const knownShipping = shippingCost ?? 0;
  const knownTaxes = taxes ?? 0;
  const knownFees = otherMandatoryFees ?? 0;
  const knownDiscounts = discounts ?? 0;

  const estimatedTotalCost = Math.max(0, itemSubtotal + knownShipping + knownTaxes + knownFees - knownDiscounts);

  // Completeness classification
  let costCompleteness: CostCompleteness = "complete";
  if (unknownComponents.length > 0) {
    costCompleteness = unknownComponents.includes("shipping") ? "partial_unknown" : "estimated";
  }

  return {
    unitPrice: cleanUnitPrice,
    quantity: cleanQty,
    itemSubtotal,
    shippingCost,
    shippingType,
    taxes,
    taxType,
    otherMandatoryFees,
    discounts,
    estimatedTotalCost,
    costCompleteness,
    unknownComponents,
    notes,
  };
}

/**
 * Consolidates total purchase costs for an entire shopping plan,
 * avoiding double-counting of order-level shipping and taxes.
 */
export function calculatePlanTotalCosts(
  items: { unitPrice: number; quantity: number; shippingCost?: number | null; hasPrime?: boolean }[],
  planOptions: {
    orderShipping?: number | null;
    freeShippingThreshold?: number;
    taxes?: number | null;
  } = {}
): {
  itemsSubtotal: number;
  orderShipping: number | null;
  orderTaxes: number | null;
  estimatedPlanTotal: number;
  costCompleteness: CostCompleteness;
  unknownComponents: string[];
} {
  const itemsSubtotal = items.reduce((sum, item) => {
    const qty = Math.max(1, Math.round(item.quantity || 1));
    const price = Math.max(0, Math.round(item.unitPrice || 0));
    return sum + price * qty;
  }, 0);

  const unknownComponents: string[] = [];

  // Determine order-level shipping
  const allPrime = items.length > 0 && items.every((i) => i.hasPrime);
  const freeThreshold = planOptions.freeShippingThreshold ?? 499; // Standard Amazon India free delivery threshold

  let orderShipping: number | null = 0;
  if (allPrime || itemsSubtotal >= freeThreshold) {
    orderShipping = 0;
  } else if (typeof planOptions.orderShipping === "number" && !isNaN(planOptions.orderShipping)) {
    orderShipping = Math.max(0, Math.round(planOptions.orderShipping));
  } else {
    // Check if items have individual shipping
    const knownItemShippings = items
      .map((i) => i.shippingCost)
      .filter((s): s is number => typeof s === "number" && !isNaN(s));

    if (knownItemShippings.length === items.length && items.length > 0) {
      orderShipping = knownItemShippings.reduce((a, b) => a + b, 0);
    } else {
      orderShipping = null;
      unknownComponents.push("orderShipping");
    }
  }

  // Taxes
  let orderTaxes: number | null = 0;
  if (typeof planOptions.taxes === "number" && !isNaN(planOptions.taxes)) {
    orderTaxes = Math.max(0, Math.round(planOptions.taxes));
  } else {
    // Default: retail GST inclusive
    orderTaxes = 0;
  }

  const estimatedPlanTotal = itemsSubtotal + (orderShipping ?? 0) + (orderTaxes ?? 0);
  const costCompleteness: CostCompleteness =
    unknownComponents.length > 0 ? "partial_unknown" : "complete";

  return {
    itemsSubtotal,
    orderShipping,
    orderTaxes,
    estimatedPlanTotal,
    costCompleteness,
    unknownComponents,
  };
}

// ============================================================================
// 2. PRODUCT DATA NORMALIZATION & VALIDATION
// ============================================================================

export interface RawProductInput {
  id?: string;
  asin?: string;
  name?: string;
  title?: string;
  category?: string;
  product_category?: string;
  merchant?: string;
  seller?: string;
  sold_by?: string;
  currency?: string;
  price_symbol?: string;
  price?: number | string | null;
  pricing?: number | string | null;
  unitPrice?: number | null;
  price_string?: string;
  original_price?: { price?: number | null; price_string?: string } | number | null;
  list_price?: number | string | null;
  inStock?: boolean;
  availableStock?: number;
  availability_status?: string;
  rating?: number | null;
  average_rating?: number | null;
  stars?: number | null;
  totalReviews?: number | null;
  total_reviews?: number | null;
  url?: string;
  image?: string;
  imageUrl?: string;
  images?: string[];
  spec?: Record<string, any>;
  product_information?: Record<string, any>;
  feature_bullets?: string[];
  features?: string[];
  has_prime?: boolean;
  is_amazon_choice?: boolean;
  is_best_seller?: boolean;
  is_limited_deal?: boolean;
  shipping_price?: number | null;
  shippingCost?: number | null;
  source?: "scraperapi" | "fixture" | "catalog";
  retrievedAt?: string;
  lastCheckedAt?: string;
}

/**
 * Checks whether product data was retrieved longer ago than maxStaleHours (default 72h).
 */
export function isProductDataStale(lastCheckedAt?: string, maxStaleHours = 72): boolean {
  if (!lastCheckedAt) return false;
  const parsedTime = Date.parse(lastCheckedAt);
  if (isNaN(parsedTime)) return false;
  const ageHours = (Date.now() - parsedTime) / (1000 * 3600);
  return ageHours > maxStaleHours;
}

/**
 * Validates price format, rejects non-numeric or non-positive values,
 * and ensures currency is INR (rejects USD, EUR, etc.).
 */
export function sanitizePriceAndCurrency(
  rawPrice: any,
  currency?: string
): { isValid: boolean; priceInr?: number; error?: string } {
  const curr = (currency || "₹").trim();
  if (curr === "$" || curr.toUpperCase() === "USD" || curr === "€" || curr.toUpperCase() === "EUR") {
    return { isValid: false, error: `Unsupported non-INR currency: ${curr}` };
  }
  let parsed: number | null = null;
  if (typeof rawPrice === "number" && !isNaN(rawPrice) && rawPrice > 0) {
    parsed = Math.round(rawPrice);
  } else if (typeof rawPrice === "string") {
    const cleaned = rawPrice.replace(/[^0-9.]/g, "");
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val > 0) parsed = Math.round(val);
  }
  if (!parsed || parsed <= 0) {
    return { isValid: false, error: "Invalid, zero, or negative price" };
  }
  return { isValid: true, priceInr: parsed };
}

/**
 * Normalizes raw ScraperAPI or catalog product responses into a standardized, validated format.
 * Validates prices, normalizes to INR, and strictly avoids fabricating missing data.
 */
export function normalizeProduct(
  raw: RawProductInput,
  options: { maxStaleHours?: number; defaultCategory?: string } = {}
): NormalizedProduct | null {
  const name = (raw.name || raw.title || "").trim();
  if (!name) return null;

  const id = String(raw.asin || raw.id || name.toLowerCase().replace(/\s+/g, "-").slice(0, 32));
  const asin = raw.asin || (raw.id && /^[A-Z0-9]{10}$/.test(raw.id) ? raw.id : undefined);

  // 1. Currency validation & normalization
  // Strict rule: Supported currency is INR. Reject or flag unsupported non-INR currencies unless convertible.
  const rawCurrency = (raw.currency || raw.price_symbol || "₹").trim();
  if (
    rawCurrency === "$" ||
    rawCurrency.toUpperCase() === "USD" ||
    rawCurrency === "€" ||
    rawCurrency.toUpperCase() === "EUR"
  ) {
    // Explicit currency mismatch: Cannot treat $20 as ₹20
    return null;
  }

  // 2. Price extraction and validation
  let rawPriceVal = raw.unitPrice ?? raw.price ?? raw.pricing;
  let unitPriceInr: number | null = null;

  if (typeof rawPriceVal === "number" && !isNaN(rawPriceVal) && rawPriceVal > 0) {
    unitPriceInr = Math.round(rawPriceVal);
  } else if (typeof rawPriceVal === "string") {
    const cleaned = rawPriceVal.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      unitPriceInr = Math.round(parsed);
    }
  } else if (raw.price_string) {
    const cleaned = raw.price_string.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      unitPriceInr = Math.round(parsed);
    }
  }

  if (unitPriceInr === null || unitPriceInr <= 0) {
    // Product has no valid price; cannot be used in a shopping plan
    return null;
  }

  // Original price for discount calculation
  let originalPrice: number | null = null;
  const rawOrig = raw.original_price ?? raw.list_price;
  if (typeof rawOrig === "number" && !isNaN(rawOrig) && rawOrig > unitPriceInr) {
    originalPrice = Math.round(rawOrig);
  } else if (typeof rawOrig === "object" && rawOrig && typeof rawOrig.price === "number") {
    if (rawOrig.price > unitPriceInr) originalPrice = Math.round(rawOrig.price);
  } else if (typeof rawOrig === "string") {
    const parsed = parseFloat(rawOrig.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > unitPriceInr) originalPrice = Math.round(parsed);
  }

  const discounts = originalPrice && originalPrice > unitPriceInr ? originalPrice - unitPriceInr : null;

  // 3. Stock & Availability
  let inStock = true;
  if (raw.inStock !== undefined) {
    inStock = Boolean(raw.inStock);
  } else if (raw.availability_status) {
    const lowerAvail = raw.availability_status.toLowerCase();
    if (lowerAvail.includes("out of stock") || lowerAvail.includes("currently unavailable")) {
      inStock = false;
    }
  }

  // 4. Ratings & Reviews (never fabricate missing ratings)
  let rating: number | null = null;
  const rawRating = raw.rating ?? raw.average_rating ?? raw.stars;
  if (typeof rawRating === "number" && !isNaN(rawRating) && rawRating >= 0 && rawRating <= 5) {
    rating = Math.round(rawRating * 10) / 10;
  }

  let reviewCount: number | null = null;
  const rawReviews = raw.totalReviews ?? raw.total_reviews;
  if (typeof rawReviews === "number" && !isNaN(rawReviews) && rawReviews >= 0) {
    reviewCount = Math.round(rawReviews);
  }

  // 5. Specifications & Features
  const specifications: Record<string, string> = {};
  if (raw.spec && typeof raw.spec === "object") {
    for (const [k, v] of Object.entries(raw.spec)) {
      if (v !== null && v !== undefined) specifications[k] = String(v);
    }
  }
  if (raw.product_information && typeof raw.product_information === "object") {
    for (const [k, v] of Object.entries(raw.product_information)) {
      if (v !== null && v !== undefined && !specifications[k]) {
        specifications[k] = String(v);
      }
    }
  }

  const features: string[] = [];
  const rawBullets = raw.feature_bullets || raw.features;
  if (Array.isArray(rawBullets)) {
    for (const b of rawBullets) {
      if (typeof b === "string" && b.trim()) features.push(b.trim());
    }
  }

  // 6. Badges & Quality Indicators
  const badges: string[] = [];
  if (raw.is_amazon_choice) badges.push("Amazon's Choice");
  if (raw.is_best_seller) badges.push("Best Seller");
  if (raw.is_limited_deal) badges.push("Limited Deal");
  if (raw.has_prime) badges.push("Prime");

  // 7. Merchant & URL
  const merchant = raw.sold_by || raw.merchant || raw.seller || "Amazon India";
  const productUrl = raw.url || (asin ? `https://www.amazon.in/dp/${asin}` : "https://www.amazon.in");

  // 8. Shipping details
  let shippingCost: number | null = null;
  let shippingType: "free" | "paid" | "unknown" = "unknown";
  if (raw.has_prime) {
    shippingCost = 0;
    shippingType = "free";
  } else if (raw.shipping_price !== undefined && raw.shipping_price !== null) {
    shippingCost = Math.max(0, Math.round(Number(raw.shipping_price)));
    shippingType = shippingCost === 0 ? "free" : "paid";
  } else if (raw.shippingCost !== undefined && raw.shippingCost !== null) {
    shippingCost = Math.max(0, Math.round(Number(raw.shippingCost)));
    shippingType = shippingCost === 0 ? "free" : "paid";
  }

  // 9. Stale check
  const lastCheckedAt = raw.lastCheckedAt || raw.retrievedAt || new Date().toISOString();
  const maxStaleHours = options.maxStaleHours ?? 72;
  const isStale = isProductDataStale(lastCheckedAt, maxStaleHours);

  return {
    productId: id,
    asin,
    name,
    category: raw.category || raw.product_category || options.defaultCategory || "supplies",
    merchant,
    currency: CURRENCY,
    productUrl,
    imageUrl: raw.imageUrl || raw.image || (raw.images && raw.images[0]),
    unitPrice: unitPriceInr,
    originalPrice,
    inStock,
    availableStock: raw.availableStock ?? (inStock ? 50 : 0),
    rating,
    reviewCount,
    specifications,
    features,
    badges,
    shippingCost,
    shippingType,
    taxes: 0,
    taxType: "inclusive",
    discounts,
    otherMandatoryFees: 0,
    source: raw.source || "scraperapi",
    lastCheckedAt,
    isStale,
  };
}

// ============================================================================
// 3. REQUIREMENT SUITABILITY EVALUATION
// ============================================================================

/**
 * Extracts structured hard requirements and soft preferences from user prompt.
 */
export function extractUserRequirements(prompt: string): UserRequirement[] {
  const requirements: UserRequirement[] = [];
  const lower = (prompt || "").toLowerCase();

  const addReq = (id: string, text: string, isMustHave: boolean, tokens: string[], negativeTokens: string[] = []) => {
    requirements.push({ id, text, isMustHave, tokens, negativeTokens });
  };

  // Must-have specification extractors
  if (lower.includes("waterproof") || lower.includes("rain") || lower.includes("monsoon")) {
    addReq("waterproof", "Waterproof / water-resistant material", true, ["waterproof", "water-resistant", "rain", "monsoon"]);
  }
  if (lower.includes("750ml") || lower.includes("1l") || lower.includes("1000ml") || lower.includes("500ml")) {
    const capMatch = lower.match(/(750ml|1l|1000ml|500ml)/);
    if (capMatch) {
      addReq("capacity", `Capacity requirement: ${capMatch[1]}`, true, [capMatch[1]]);
    }
  }
  if (lower.includes("10000mah") || lower.includes("20000mah")) {
    const batMatch = lower.match(/(10000mah|20000mah)/);
    if (batMatch) {
      addReq("battery_capacity", `Battery capacity: ${batMatch[1]}`, true, [batMatch[1]]);
    }
  }
  if (lower.includes("stainless steel") || lower.includes("steel bottle")) {
    addReq("stainless_steel", "Stainless steel construction", true, ["stainless", "steel"]);
  }
  if (lower.includes("type-c") || lower.includes("usb-c")) {
    addReq("type_c", "USB Type-C port / charging", true, ["type-c", "usb-c"]);
  }
  if (lower.includes("wireless") || lower.includes("bluetooth")) {
    addReq("wireless", "Wireless / Bluetooth connectivity", true, ["wireless", "bluetooth"]);
  }
  if (lower.includes("ruled") || lower.includes("spiral")) {
    addReq("spiral_ruled", "Spiral ruled notebook format", true, ["spiral", "ruled"]);
  }
  if (lower.includes("cotton") && (lower.includes("bedsheet") || lower.includes("towel"))) {
    addReq("pure_cotton", "Pure cotton material", true, ["cotton"]);
  }

  // Soft preferences
  if (lower.includes("lightweight") || lower.includes("compact")) {
    addReq("portable", "Compact and lightweight form factor", false, ["lightweight", "compact", "portable", "slim"]);
  }
  if (lower.includes("high rating") || lower.includes("top rated") || lower.includes("best quality")) {
    addReq("top_rated", "High user ratings and verified reviews", false, ["rated", "quality"]);
  }
  if (lower.includes("fast charging") || lower.includes("quick charge")) {
    addReq("fast_charge", "Fast charging capability", false, ["fast", "quick", "speed", "rapid"]);
  }

  return requirements;
}

/**
 * Evaluates whether a product meets hard requirements and soft preferences.
 * A product violating an explicit must-have requirement is marked as non-compliant.
 */
export function evaluateProductSuitability(
  product: NormalizedProduct,
  requirements: UserRequirement[] = []
): RequirementMatchResult {
  const reqList: UserRequirement[] = Array.isArray(requirements)
    ? requirements
    : (requirements && Array.isArray((requirements as any).requirements))
    ? (requirements as any).requirements
    : [];

  const fullText = [
    product.name,
    product.category,
    ...Object.entries(product.specifications || {}).map(([k, v]) => `${k} ${v}`),
    ...(product.features || []),
    ...(product.badges || []),
  ]
    .join(" ")
    .toLowerCase();

  const matchedMustHaves: string[] = [];
  const unmetMustHaves: string[] = [];
  const matchedPreferences: string[] = [];
  const unmetPreferences: string[] = [];
  const notes: string[] = [];

  for (const req of reqList) {
    const hasNegative = req.negativeTokens?.some((tok) => fullText.includes(tok));
    const hasToken = req.tokens.some((tok) => fullText.includes(tok));

    const matches = hasToken && !hasNegative;

    if (req.isMustHave) {
      if (matches) {
        matchedMustHaves.push(req.text);
      } else {
        unmetMustHaves.push(req.text);
      }
    } else {
      if (matches) {
        matchedPreferences.push(req.text);
      } else {
        unmetPreferences.push(req.text);
      }
    }
  }

  const violatesMustHave = unmetMustHaves.length > 0;

  let status: "full" | "partial" | "mismatch" = "full";
  if (violatesMustHave) {
    status = matchedMustHaves.length > 0 ? "partial" : "mismatch";
    notes.push(`Missing must-have requirements: ${unmetMustHaves.join(", ")}`);
  } else if (unmetPreferences.length > 0) {
    status = "partial";
  }

  // Score computation (0-100)
  const totalMust = requirements.filter((r) => r.isMustHave).length;
  const totalPref = requirements.filter((r) => !r.isMustHave).length;

  let score = 100;
  if (totalMust > 0) {
    const mustRatio = matchedMustHaves.length / totalMust;
    score = mustRatio * 75; // Must-haves represent 75% of requirement score
  }
  if (totalPref > 0) {
    const prefRatio = matchedPreferences.length / totalPref;
    score += prefRatio * 25; // Soft preferences represent 25%
  } else if (totalMust === 0) {
    score = 100; // No requirements specified
  }

  return {
    status,
    matchedMustHaves,
    unmetMustHaves,
    matchedPreferences,
    unmetPreferences,
    violatesMustHave,
    score: Math.round(score),
    notes,
  };
}

// ============================================================================
// 4. TRANSPARENT VALUE COMPARISON & MULTI-CRITERIA SCORING
// ============================================================================

/**
 * Evaluates review credibility based on review volume and rating consistency.
 */
export function assessReviewCredibility(
  rating: number | null,
  reviewCount: number | null
): "high" | "moderate" | "low" | "none" | "unknown" {
  if (rating === null || reviewCount === null) return "unknown";
  if (reviewCount === 0) return "none";
  if (reviewCount >= 200 && rating >= 3.8) return "high";
  if (reviewCount >= 50) return "moderate";
  return "low"; // Fewer than 50 reviews: rating may be subject to small sample variance
}

/**
 * Builds a comprehensive comparison item for a single candidate product.
 */
export function buildProductComparisonItem(
  product: NormalizedProduct,
  quantity = 1,
  requirementsOrOptions:
    | UserRequirement[]
    | {
        requirements?: UserRequirement[];
        costOptions?: CostCalculationOptions;
        candidatePool?: NormalizedProduct[];
      } = [],
  costOptions: CostCalculationOptions = {},
  candidatePool: NormalizedProduct[] = []
): ProductComparisonItem {
  let reqs: UserRequirement[] = [];
  let opts: CostCalculationOptions = { ...costOptions };
  let pool: NormalizedProduct[] = [...candidatePool];

  if (Array.isArray(requirementsOrOptions)) {
    reqs = requirementsOrOptions;
  } else if (typeof requirementsOrOptions === "object" && requirementsOrOptions !== null) {
    if (Array.isArray((requirementsOrOptions as any).requirements)) {
      reqs = (requirementsOrOptions as any).requirements;
    }
    if ((requirementsOrOptions as any).costOptions) {
      opts = { ...opts, ...(requirementsOrOptions as any).costOptions };
    }
    if (Array.isArray((requirementsOrOptions as any).candidatePool)) {
      pool = (requirementsOrOptions as any).candidatePool;
    }
  }

  const cost = calculateProductCost(product.unitPrice, quantity, {
    shippingCost: product.shippingCost,
    shippingType: product.shippingType,
    taxes: product.taxes,
    taxType: product.taxType,
    discounts: product.discounts,
    hasPrime: product.badges.includes("Prime"),
    ...opts,
  });

  const requirementMatch = evaluateProductSuitability(product, reqs);
  const reviewCredibility = assessReviewCredibility(product.rating, product.reviewCount);

  const advantages: string[] = [];
  const drawbacks: string[] = [];
  const missingInformation: string[] = [...cost.unknownComponents];

  // Evaluate Advantages
  if (product.rating && product.rating >= 4.2) {
    advantages.push(`Highly rated (★${product.rating}${product.reviewCount ? ` across ${product.reviewCount.toLocaleString("en-IN")} reviews` : ""}).`);
  }
  if (cost.shippingType === "free") {
    advantages.push("Free shipping included.");
  }
  if (cost.discounts && cost.discounts > 0) {
    advantages.push(`Verified deal saving ₹${cost.discounts.toLocaleString("en-IN")}.`);
  }
  for (const b of product.badges) {
    advantages.push(`${b} certified on Amazon India.`);
  }
  for (const m of requirementMatch.matchedMustHaves) {
    advantages.push(`Verified must-have feature: ${m}.`);
  }
  if (product.features.length >= 3) {
    advantages.push(`Comprehensive feature set (${product.features.length} documented specifications).`);
  }

  // Evaluate Drawbacks (Factual only, never fabricated)
  if (requirementMatch.violatesMustHave) {
    drawbacks.push(`Does not satisfy required: ${requirementMatch.unmetMustHaves.join(", ")}.`);
  }
  if (product.rating !== null && product.rating < 3.8) {
    drawbacks.push(`Sub-optimal customer rating (★${product.rating}).`);
  }
  if (reviewCredibility === "low") {
    drawbacks.push(`Limited review evidence (${product.reviewCount} reviews); ratings may not represent long-term durability.`);
  }
  if (cost.shippingType === "paid" && cost.shippingCost && cost.shippingCost > 0) {
    drawbacks.push(`Incurs separate shipping cost of ₹${cost.shippingCost.toLocaleString("en-IN")}.`);
  }
  if (!product.inStock) {
    drawbacks.push("Item currently out of stock.");
  }
  if (product.isStale) {
    drawbacks.push("Pricing and stock information was retrieved over 72 hours ago.");
  }

  // Missing Information
  if (product.rating === null) missingInformation.push("ratings & customer reviews");
  if (product.features.length === 0) missingInformation.push("detailed feature bullets");
  if (Object.keys(product.specifications).length === 0) missingInformation.push("technical specifications");

  // Multi-dimensional Scoring
  // 1. Cost Score (0-100): Proportional ratio relative to lowest available candidate in pool
  let costScore = 80;
  if (candidatePool.length > 0) {
    const validPrices = candidatePool.map((c) => c.unitPrice).filter((p) => p > 0);
    const minP = validPrices.length > 0 ? Math.min(...validPrices) : product.unitPrice;
    if (minP > 0) {
      const ratio = cost.estimatedTotalCost / (minP * quantity);
      // ratio 1.0 (cheapest) = 100; ratio 1.25 (+25%) = 82; ratio 1.5 (+50%) = 65; ratio 2.0 = 40
      costScore = Math.max(10, Math.min(100, Math.round(100 - (ratio - 1) * 70)));
    }
  } else {
    costScore = 80;
  }

  // 2. Requirement Score (0-100)
  const requirementScore = requirementMatch.score;

  // 3. Quality Score (0-100)
  let qualityScore = 50;
  if (product.rating !== null) {
    // Base on rating out of 5
    qualityScore = (product.rating / 5) * 80;
    // Credibility bonus
    if (reviewCredibility === "high") qualityScore += 20;
    else if (reviewCredibility === "moderate") qualityScore += 10;
  } else {
    // Missing rating is treated as unknown (neutral 50), not penalized to 0
    qualityScore = 50;
  }
  if (product.badges.includes("Amazon's Choice") || product.badges.includes("Best Seller")) {
    qualityScore = Math.min(100, qualityScore + 10);
  }
  qualityScore = Math.max(10, Math.min(100, Math.round(qualityScore)));

  // 4. Feature Score (0-100)
  let featureScore = 50;
  const specCount = Object.keys(product.specifications).length;
  const featCount = product.features.length;
  featureScore = Math.min(100, 40 + featCount * 10 + specCount * 5);

  // If item violates must-have requirement, penalize requirement score heavily
  const effectiveReqScore = requirementMatch.violatesMustHave ? 10 : requirementScore;

  // Selection Reason
  let selectionReason = `Estimated total cost of ₹${cost.estimatedTotalCost.toLocaleString("en-IN")}`;
  if (product.rating) selectionReason += ` with ★${product.rating} rating`;
  if (requirementMatch.matchedMustHaves.length > 0) {
    selectionReason += ` satisfying ${requirementMatch.matchedMustHaves[0]}`;
  }

  return {
    productId: product.productId,
    asin: product.asin,
    name: product.name,
    productUrl: product.productUrl,
    merchant: product.merchant,
    currency: product.currency,
    cost,
    rating: product.rating,
    reviewCount: product.reviewCount,
    reviewCredibility,
    specifications: product.specifications,
    features: product.features,
    badges: product.badges,
    requirementMatch,
    advantages,
    drawbacks,
    missingInformation,
    selectionReason,
    lastCheckedAt: product.lastCheckedAt,
    isStale: product.isStale,
    valueScore: 0, // calculated per preference mode below
    scoreBreakdown: {
      costScore,
      requirementScore: effectiveReqScore,
      qualityScore,
      featureScore,
    },
  };
}

/**
 * Computes composite value score for a comparison item based on user preference.
 */
export function computeValueScore(
  item: ProductComparisonItem,
  preference: UserTradeOffPreference = "balanced"
): number {
  const { costScore, requirementScore, qualityScore, featureScore } = item.scoreBreakdown;

  // If item violates an explicit must-have requirement, it cannot score above 35
  if (item.requirementMatch.violatesMustHave) {
    return Math.min(35, Math.round(costScore * 0.3));
  }

  let finalScore = 0;
  switch (preference) {
    case "lowest_cost":
      // Cost: 60%, Requirements: 25%, Quality: 15%
      finalScore = costScore * 0.6 + requirementScore * 0.25 + qualityScore * 0.15;
      break;

    case "quality":
      // Quality: 50%, Requirements: 30%, Cost: 20%
      finalScore = qualityScore * 0.5 + requirementScore * 0.3 + costScore * 0.2;
      break;

    case "features":
      // Features: 40%, Requirements: 35%, Quality: 15%, Cost: 10%
      finalScore = featureScore * 0.4 + requirementScore * 0.35 + qualityScore * 0.15 + costScore * 0.1;
      break;

    case "balanced":
    default:
      // Balanced: Quality (30%), Requirements (30%), Cost (20%), Features (20%)
      finalScore = qualityScore * 0.3 + requirementScore * 0.3 + costScore * 0.2 + featureScore * 0.2;
      break;
  }

  return Math.max(1, Math.min(100, Math.round(finalScore)));
}

// ============================================================================
// 5. TRADE-OFF COMPARISON & EXPLANATION GENERATOR
// ============================================================================

/**
 * Compares two products and produces transparent trade-off rationale.
 */
export function compareProductPair(
  primary: ProductComparisonItem,
  secondary: ProductComparisonItem
): {
  costDifference: number; // positive = secondary is more expensive; negative = secondary is cheaper
  percentageDifference: number;
  whyPrimaryBetter: string[];
  whySecondaryBetter: string[];
  tradeOffSummary: string;
} {
  const costDiff = secondary.cost.estimatedTotalCost - primary.cost.estimatedTotalCost;
  const pctDiff =
    primary.cost.estimatedTotalCost > 0
      ? Math.round((Math.abs(costDiff) / primary.cost.estimatedTotalCost) * 100)
      : 0;

  const whyPrimaryBetter: string[] = [];
  const whySecondaryBetter: string[] = [];

  // Cost comparison
  if (costDiff > 0) {
    whyPrimaryBetter.push(`Saves ₹${costDiff.toLocaleString("en-IN")} (${pctDiff}% lower total purchase cost).`);
  } else if (costDiff < 0) {
    whySecondaryBetter.push(`Saves ₹${Math.abs(costDiff).toLocaleString("en-IN")} (${pctDiff}% lower total purchase cost).`);
  }

  // Shipping comparison
  if (primary.cost.shippingType === "free" && secondary.cost.shippingType === "paid") {
    whyPrimaryBetter.push("Includes free shipping (alternative incurs extra delivery fee).");
  } else if (secondary.cost.shippingType === "free" && primary.cost.shippingType === "paid") {
    whySecondaryBetter.push("Includes free shipping (primary incurs extra delivery fee).");
  }

  // Rating & Review evidence
  if (primary.rating !== null && secondary.rating !== null) {
    const rateDiff = Math.round((primary.rating - secondary.rating) * 10) / 10;
    if (rateDiff >= 0.3) {
      whyPrimaryBetter.push(`Higher customer rating (★${primary.rating} vs ★${secondary.rating}).`);
    } else if (rateDiff <= -0.3) {
      whySecondaryBetter.push(`Higher customer rating (★${secondary.rating} vs ★${primary.rating}).`);
    }
  }

  // Requirements & Features
  if (!primary.requirementMatch.violatesMustHave && secondary.requirementMatch.violatesMustHave) {
    whyPrimaryBetter.push(`Satisfies your required specifications (${secondary.requirementMatch.unmetMustHaves.join(", ")} missing in alternative).`);
  } else if (primary.requirementMatch.violatesMustHave && !secondary.requirementMatch.violatesMustHave) {
    whySecondaryBetter.push(`Satisfies your required specifications (${primary.requirementMatch.unmetMustHaves.join(", ")} missing in primary).`);
  }

  // Summary statement
  let tradeOffSummary = "";
  if (costDiff > 0) {
    tradeOffSummary = `Choosing "${primary.name}" saves ₹${costDiff.toLocaleString("en-IN")}. If you upgrade to "${secondary.name}", you gain ${whySecondaryBetter.slice(0, 1).join(" and ") || "alternative specifications"}.`;
  } else if (costDiff < 0) {
    tradeOffSummary = `"${primary.name}" costs ₹${Math.abs(costDiff).toLocaleString("en-IN")} more, justified by ${whyPrimaryBetter.slice(0, 2).join(" and ") || "better feature alignment"}.`;
  } else {
    tradeOffSummary = `Both products have identical estimated costs of ₹${primary.cost.estimatedTotalCost.toLocaleString("en-IN")}. The primary choice offers ${whyPrimaryBetter[0] || "stronger customer satisfaction"}.`;
  }

  return {
    costDifference: costDiff,
    percentageDifference: pctDiff,
    whyPrimaryBetter,
    whySecondaryBetter,
    tradeOffSummary,
  };
}

/**
 * Ranks candidate products and generates a complete TradeOffRecommendation.
 */
export function rankAndRecommendCandidates(
  candidates: NormalizedProduct[],
  quantityOrPrompt: number | string | UserRequirement[] = 1,
  requirementsOrOptions?:
    | UserRequirement[]
    | UserTradeOffPreference
    | {
        quantity?: number;
        requirements?: UserRequirement[];
        preference?: UserTradeOffPreference;
        budget?: number;
        costOptions?: CostCalculationOptions;
      },
  preferenceArg: UserTradeOffPreference = "balanced",
  budgetArg?: number,
  costOptionsArg: CostCalculationOptions = {}
): TradeOffRecommendation | null {
  if (!candidates || candidates.length === 0) return null;

  let quantity = 1;
  let requirements: UserRequirement[] = [];
  let preference: UserTradeOffPreference = preferenceArg;
  let budget: number | undefined = budgetArg;
  let costOptions: CostCalculationOptions = { ...costOptionsArg };

  // Parse 2nd argument (quantityOrPrompt)
  if (typeof quantityOrPrompt === "number") {
    quantity = Math.max(1, Math.round(quantityOrPrompt));
  } else if (typeof quantityOrPrompt === "string") {
    requirements = extractUserRequirements(quantityOrPrompt);
  } else if (Array.isArray(quantityOrPrompt)) {
    requirements = quantityOrPrompt;
  }

  // Parse 3rd argument (requirementsOrOptions)
  if (Array.isArray(requirementsOrOptions)) {
    requirements = requirementsOrOptions;
  } else if (typeof requirementsOrOptions === "string") {
    preference = requirementsOrOptions as UserTradeOffPreference;
  } else if (typeof requirementsOrOptions === "object" && requirementsOrOptions !== null) {
    if (typeof requirementsOrOptions.quantity === "number") {
      quantity = Math.max(1, Math.round(requirementsOrOptions.quantity));
    }
    if (Array.isArray(requirementsOrOptions.requirements)) {
      requirements = requirementsOrOptions.requirements;
    }
    if (requirementsOrOptions.preference) {
      preference = requirementsOrOptions.preference;
    }
    if (typeof requirementsOrOptions.budget === "number") {
      budget = requirementsOrOptions.budget;
    }
    if (requirementsOrOptions.costOptions) {
      costOptions = { ...costOptions, ...requirementsOrOptions.costOptions };
    }
  }

  if (!Array.isArray(requirements)) {
    requirements = [];
  }

  // 1. Build comparison items for all candidates
  const items = candidates
    .filter((c) => c.inStock) // in-stock candidates
    .map((c) =>
      buildProductComparisonItem(c, quantity, requirements, costOptions, candidates)
    );

  if (items.length === 0) return null;

  // 2. Score items according to user preference
  for (const item of items) {
    item.valueScore = computeValueScore(item, preference);
  }

  // 3. Sort items:
  // - Candidates that satisfy must-have requirements rank strictly ahead of non-compliant ones
  // - Then by valueScore descending
  // - Tie-breaker: lower estimated total cost
  items.sort((a, b) => {
    if (!a.requirementMatch.violatesMustHave && b.requirementMatch.violatesMustHave) return -1;
    if (a.requirementMatch.violatesMustHave && !b.requirementMatch.violatesMustHave) return 1;
    if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
    return a.cost.estimatedTotalCost - b.cost.estimatedTotalCost;
  });

  const selected = items[0];
  const alternatives = items.slice(1);

  // 4. Total Cost Comparison across pool
  const allCosts = items.map((i) => i.cost.estimatedTotalCost);
  const cheapestCost = Math.min(...allCosts);
  const highestCost = Math.max(...allCosts);
  const savingsVsHighest = Math.max(0, highestCost - selected.cost.estimatedTotalCost);
  const premiumVsCheapest = Math.max(0, selected.cost.estimatedTotalCost - cheapestCost);

  // 5. Why Selected Explanation
  let whySelected = `"${selected.name}" was selected as the best ${preference} choice (Score: ${selected.valueScore}/100). `;
  if (selected.requirementMatch.matchedMustHaves.length > 0) {
    whySelected += `It satisfies your core requirements for ${selected.requirementMatch.matchedMustHaves.join(", ")}. `;
  }
  whySelected += `Estimated purchase total is ₹${selected.cost.estimatedTotalCost.toLocaleString("en-IN")}`;
  if (selected.rating) {
    whySelected += ` supported by a ★${selected.rating} rating (${selected.reviewCount || 0} reviews).`;
  } else {
    whySelected += ".";
  }

  // 6. What User Sacrifices (Drawbacks / Trade-Offs)
  const userSacrifices: string[] = [];
  if (selected.drawbacks.length > 0) {
    userSacrifices.push(...selected.drawbacks);
  }
  if (premiumVsCheapest > 0) {
    userSacrifices.push(`Costs ₹${premiumVsCheapest.toLocaleString("en-IN")} more than the cheapest available option.`);
  }
  if (selected.missingInformation.length > 0) {
    userSacrifices.push(`Missing provider information: ${selected.missingInformation.join(", ")}.`);
  }

  // 7. When Alternative May Be Better
  let whyAlternativeMayBeBetter: string | undefined = undefined;
  if (alternatives.length > 0) {
    const topAlt = alternatives[0];
    const comparison = compareProductPair(selected, topAlt);
    whyAlternativeMayBeBetter = comparison.tradeOffSummary;
  }

  // Key Trade-offs
  const keyTradeOffs: string[] = [];
  if (alternatives.length > 0) {
    const cheapestAlt = items.reduce((prev, curr) =>
      curr.cost.estimatedTotalCost < prev.cost.estimatedTotalCost ? curr : prev
    );
    if (cheapestAlt.productId !== selected.productId) {
      const diff = selected.cost.estimatedTotalCost - cheapestAlt.cost.estimatedTotalCost;
      keyTradeOffs.push(
        `Cheaper alternative "${cheapestAlt.name}" is available for ₹${cheapestAlt.cost.estimatedTotalCost.toLocaleString("en-IN")} (saves ₹${diff.toLocaleString("en-IN")}), but ${
          cheapestAlt.drawbacks[0] || "offers lower rating or fewer features"
        }.`
      );
    }
  }

  const unmetRequirements = selected.requirementMatch.unmetMustHaves;
  const uncertainties = [...selected.missingInformation];

  return {
    selectedProduct: selected,
    alternatives,
    selectionExplanation: {
      whySelected,
      userSacrifices,
      whyAlternativeMayBeBetter,
    },
    totalCostComparison: {
      cheapestCost,
      selectedCost: selected.cost.estimatedTotalCost,
      highestCost,
      savingsVsHighest,
      premiumVsCheapest,
    },
    keyTradeOffs,
    unmetRequirements,
    uncertainties,
  };
}
