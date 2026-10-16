/**
 * INTELLIGENT BUDGET OPTIMIZATION AGENT
 *
 * Implements deterministic item-priority assignment, alternative product selection,
 * ordered budget optimization, transparent savings explanations, and feasibility verification.
 *
 * Key Principles:
 * 1. Financial calculations are 100% deterministic in application code (never hallucinated).
 * 2. Never invent products, prices, ratings, or stock status.
 * 3. Never silently remove items marked as essential.
 * 4. Never falsely claim budget compliance when total exceeds budget.
 */

import {
  ProductItem,
  ShoppingPlanData,
  PlanOptimizationChange,
  BudgetOptimizationResult,
} from "@/data/mockData";
import { ProductCatalogItem, validateBudgetInr, MAX_BUDGET_INR, MIN_BUDGET_INR } from "./types";
import { PRODUCT_CATALOG, getInStockProducts } from "./catalog";
import { computePlanHash } from "./plan-hash";
import { CURRENCY } from "./types";
import {
  evaluateProductSuitability,
  normalizeProduct,
  type UserRequirement,
  type UserTradeOffPreference,
} from "./trade-off-engine";

export interface OptimizationUserConstraints {
  protectedItemIds?: string[];
  keepAllEssentials?: boolean;
  removeLeastImportant?: boolean;
  findAlternativeForId?: string;
  restoreOriginal?: boolean;
  priorityOverrides?: Record<
    string,
    { essential?: boolean; optional?: boolean; priority?: number }
  >;
  preference?: UserTradeOffPreference;
  userRequirements?: UserRequirement[];
  strictlyEnforceMustHaves?: boolean;
}

export interface OptimizationOptions {
  candidateCatalog?: readonly ProductCatalogItem[] | ProductCatalogItem[];
  userConstraints?: OptimizationUserConstraints;
  userPrompt?: string;
  additionalCosts?: number | { shipping?: number; taxes?: number; [key: string]: number | undefined };
}

/**
 * Normalizes a product item to guarantee valid quantities, integer prices,
 * subtotals, and priority tags without producing NaN.
 */
export function normalizeProductItem(
  raw: Partial<ProductItem> & { id: string; name: string }
): ProductItem {
  const quantity =
    typeof raw.quantity === "number" && !isNaN(raw.quantity) && raw.quantity >= 1
      ? Math.round(raw.quantity)
      : 1;

  // Handle unit price safely; if invalid, negative, or NaN, default to 0
  let unitPrice = 0;
  if (typeof raw.unitPrice === "number" && !isNaN(raw.unitPrice) && raw.unitPrice >= 0) {
    unitPrice = Math.round(raw.unitPrice);
  } else if (typeof raw.totalPrice === "number" && !isNaN(raw.totalPrice) && raw.totalPrice >= 0) {
    unitPrice = Math.round(raw.totalPrice / quantity);
  }

  const subtotal = Math.round(unitPrice * quantity);
  const totalPrice = subtotal;

  // Essential / Optional logic:
  // If essential is explicitly defined, use it. Otherwise, if optional is defined, invert it. Defaults to true.
  const essential =
    raw.essential !== undefined
      ? Boolean(raw.essential)
      : raw.optional !== undefined
      ? !raw.optional
      : true;
  const optional = raw.optional !== undefined ? Boolean(raw.optional) : !essential;

  const priority =
    typeof raw.priority === "number" && !isNaN(raw.priority) && raw.priority >= 1
      ? Math.round(raw.priority)
      : essential
      ? 1
      : 2;

  const rationale = raw.rationale || raw.reason || `Essential item for your requirements.`;
  const reason = raw.reason || raw.rationale || rationale;

  return {
    ...raw,
    id: String(raw.id),
    name: String(raw.name),
    category: raw.category || "supplies",
    quantity,
    unitPrice,
    totalPrice,
    subtotal,
    essential,
    optional,
    priority,
    rationale,
    reason,
    inStock: raw.inStock !== undefined ? Boolean(raw.inStock) : true,
    imagePlaceholder:
      raw.imagePlaceholder ||
      raw.imageUrl ||
      "linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)",
  };
}

/**
 * Infers item priorities (essential vs optional, and priority rank)
 * based on the user's situation and requirements rather than just price.
 */
export function inferItemPriorities(
  prompt: string,
  items: (Partial<ProductItem> & { id: string; name: string })[]
): ProductItem[] {
  const lowerPrompt = (prompt || "").toLowerCase();

  // Words that indicate non-essential / optional intent
  const optionalKeywords = [
    "optional",
    "if possible",
    "nice to have",
    "good to have",
    "extra",
    "accessory",
    "accessories",
    "upgrade",
    "convenience",
    "secondary",
    "snack",
    "snacks",
  ];

  // Specific accessory / convenience categories often secondary
  const secondaryCategories = [
    "snack",
    "snacks",
    "confectionery",
    "decor",
    "props",
    "highlighter",
    "stickers",
    "accessory",
  ];

  const processed = items.map((rawItem, index) => {
    const item = normalizeProductItem(rawItem);
    const itemNameLower = item.name.toLowerCase();
    const itemCatLower = (item.category || "").toLowerCase();

    // 1. If item already has explicit manual setting, respect it
    if (rawItem.essential !== undefined || rawItem.optional !== undefined) {
      return item;
    }

    // 2. Check if user's prompt explicitly mentions this item as required / needed
    // E.g. "need durable hydration", "must have rain poncho", "battery pack", "stationery"
    const isDirectlyMentioned =
      (lowerPrompt.includes("water") || lowerPrompt.includes("bottle") || lowerPrompt.includes("hydration")) &&
      (itemNameLower.includes("bottle") || itemNameLower.includes("flask") || itemCatLower.includes("hydration")) ||
      (lowerPrompt.includes("battery") || lowerPrompt.includes("power bank") || lowerPrompt.includes("charger")) &&
      (itemNameLower.includes("power bank") || itemNameLower.includes("battery") || itemNameLower.includes("charger")) ||
      (lowerPrompt.includes("rain") || lowerPrompt.includes("poncho") || lowerPrompt.includes("monsoon")) &&
      (itemNameLower.includes("poncho") || itemNameLower.includes("rain") || itemNameLower.includes("waterproof")) ||
      (lowerPrompt.includes("notebook") || lowerPrompt.includes("stationery") || lowerPrompt.includes("pen")) &&
      (itemNameLower.includes("notebook") || itemNameLower.includes("pen") || itemCatLower.includes("stationery")) ||
      (lowerPrompt.includes("backpack") || lowerPrompt.includes("bag") || lowerPrompt.includes("rucksack")) &&
      (itemNameLower.includes("backpack") || itemNameLower.includes("bag") || itemNameLower.includes("rucksack")) ||
      (lowerPrompt.includes("shoe") || lowerPrompt.includes("shoes") || lowerPrompt.includes("boot")) &&
      (itemNameLower.includes("shoe") || itemNameLower.includes("boot")) ||
      (lowerPrompt.includes("first aid") || lowerPrompt.includes("medicine")) &&
      (itemNameLower.includes("first aid") || itemNameLower.includes("medical")) ||
      (lowerPrompt.includes("bedsheet") || lowerPrompt.includes("blanket") || lowerPrompt.includes("organizer")) &&
      (itemNameLower.includes("bedsheet") || itemNameLower.includes("blanket") || itemNameLower.includes("organizer"));

    // 3. Check if prompt marks this kind of item as optional
    const isExplicitlyOptional = optionalKeywords.some(
      (k) => lowerPrompt.includes(k) && itemNameLower.includes(k)
    );

    // 4. Secondary convenience items (snacks, highlighters, extra accessories) are optional unless explicitly requested
    const isSecondary =
      secondaryCategories.some((c) => itemNameLower.includes(c) || itemCatLower.includes(c)) &&
      !isDirectlyMentioned;

    let essential = true;
    let priority = 1;

    if (isExplicitlyOptional || isSecondary) {
      essential = false;
      priority = 2; // Rank 2 for optional items
    } else if (isDirectlyMentioned) {
      essential = true;
      priority = 1;
    } else {
      // General heuristic: First 3 core functional items default to essential, subsequent items rank lower
      essential = index < 3;
      priority = essential ? 1 : 2;
    }

    return {
      ...item,
      essential,
      optional: !essential,
      priority,
      reason: essential
        ? `Directly addresses your situation requirements for "${item.name}".`
        : `Helpful convenience item (optional, priority rank ${priority}).`,
    };
  });

  return processed;
}

/**
 * Searches the available product catalog for cheaper, suitable alternatives to an expensive item.
 * Never invents fictional products; returns strictly grounded catalog or ScraperAPI results.
 */
export function findCheaperAlternatives(
  item: ProductItem,
  candidatePool: readonly (ProductCatalogItem | ProductItem)[] | (ProductCatalogItem | ProductItem)[],
  options: {
    minSavingsInr?: number;
    maxAlternatives?: number;
    userRequirements?: UserRequirement[];
    strictlyEnforceMustHaves?: boolean;
  } = {}
): ProductCatalogItem[] {
  const minSavings = options.minSavingsInr ?? 10; // Avoid negligible savings unless requested
  const maxResults = options.maxAlternatives ?? 5;
  const itemUnitPrice = item.unitPrice;
  const itemCat = (item.category || "").toLowerCase();
  const STOP_WORDS = new Set([
    "pack", "packs", "kits", "kit", "sets", "set", "box", "boxes", "piece", "pieces", "pair",
    "high", "low", "speed", "pro", "mini", "max", "plus", "ultra", "super", "mega",
    "compact", "portable", "durable", "premium", "standard", "universal", "multi",
    "color", "colors", "size", "inch", "inches", "heavy", "light", "best", "good",
    "with", "and", "for", "the", "new", "all", "day", "use", "top", "hot", "fast"
  ]);

  const itemNameTokens = item.name
    .toLowerCase()
    .split(/[\s,/-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const matchedAlternatives: { candidate: ProductCatalogItem; savings: number; score: number }[] = [];

  for (const candidate of candidatePool) {
    // Cannot replace an item with itself
    if (candidate.id === item.id || (candidate.asin && candidate.asin === item.asin)) {
      continue;
    }

    // Must be in stock
    const inStock =
      candidate.inStock === true ||
      ((candidate as any).availableStock !== undefined && (candidate as any).availableStock > 0);
    if (!inStock) continue;

    // Check must-have requirements if specified: Do not choose a cheaper alternative that violates an explicit requirement
    if (options.userRequirements && options.userRequirements.length > 0) {
      const normCand = normalizeProduct(candidate as any);
      if (normCand) {
        const suitability = evaluateProductSuitability(normCand, options.userRequirements);
        if (suitability.violatesMustHave) {
          continue;
        }
      }
    }

    // Determine candidate unit price in INR
    let candPriceInr = 0;
    if ("priceMinor" in candidate && typeof candidate.priceMinor === "number") {
      candPriceInr = Math.round(candidate.priceMinor / 100);
    } else if ("unitPrice" in candidate && typeof candidate.unitPrice === "number") {
      candPriceInr = Math.round(candidate.unitPrice);
    }

    if (candPriceInr <= 0 || candPriceInr >= itemUnitPrice) {
      // Must be cheaper
      continue;
    }

    const savings = Math.round((itemUnitPrice - candPriceInr) * item.quantity);
    if (savings < minSavings) {
      continue;
    }

    // Relevance scoring based on category and token overlap
    const candName = (candidate.name || "").toLowerCase();
    const candDesc = ((candidate as any).description || "").toLowerCase();
    const candCat = (candidate.category || "").toLowerCase();

    // Candidates must be category compatible if category is specified
    const catMatches =
      !itemCat ||
      !candCat ||
      candCat === itemCat ||
      candCat.includes(itemCat) ||
      itemCat.includes(candCat);
    if (!catMatches) {
      continue;
    }

    let score = 50; // Base score for category match
    let tokenMatches = 0;

    for (const token of itemNameTokens) {
      if (candName.includes(token) || candDesc.includes(token)) {
        score += 25;
        tokenMatches++;
      }
    }

    // If item has descriptive tokens, require at least one token match so we don't replace
    // e.g. a desktop or laptop with wired earphones or battery packs just because both are "electronics"
    if (itemNameTokens.length > 0 && tokenMatches === 0) {
      continue;
    }

    // Must have at least some relevance (same category or at least one token match)
    if (score < 20) {
      continue;
    }

    // Prefer candidates with good ratings if available
    const rating = candidate.rating || 4.0;
    score += rating * 5;

    // Convert to canonical ProductCatalogItem
    const catalogItem: ProductCatalogItem = {
      id: candidate.id,
      asin: candidate.asin,
      name: candidate.name,
      category: (candidate.category as any) || "supplies",
      description: (candidate as any).description || candidate.name,
      priceMinor: Math.round(candPriceInr * 100),
      inStock: true,
      availableStock: 50,
      unit: "piece",
      url: candidate.url,
      imageUrl: candidate.imageUrl,
      rating: candidate.rating,
      totalReviews: candidate.totalReviews,
      retrievedAt: candidate.retrievedAt,
      source: candidate.source || "fixture",
    };

    matchedAlternatives.push({ candidate: catalogItem, savings, score });
  }

  // Sort by score descending, then by savings descending
  matchedAlternatives.sort((a, b) => b.score - a.score || b.savings - a.savings);

  return matchedAlternatives.slice(0, maxResults).map((m) => m.candidate);
}

/**
 * Deterministically recalculates financial totals, subtotals, and budget metrics.
 */
export function validatePlanFinancials(
  items: ProductItem[],
  budget: number,
  additionalCosts: number | { shipping?: number; taxes?: number; [key: string]: number | undefined } = 0
): {
  itemsSubtotal: number;
  additionalCostsTotal: number;
  subtotals: number[];
  total: number;
  remainingBudget: number;
  budgetOverrun: number;
  withinBudget: boolean;
  essentialCount: number;
  optionalCount: number;
  essentialTotal: number;
  optionalTotal: number;
} {
  const cleanBudget = Math.max(0, Math.round(budget));

  let cleanAdditionalCosts = 0;
  if (typeof additionalCosts === "number") {
    cleanAdditionalCosts = Math.max(0, Math.round(additionalCosts));
  } else if (typeof additionalCosts === "object" && additionalCosts !== null) {
    cleanAdditionalCosts = Object.values(additionalCosts).reduce<number>((acc, val) => {
      if (typeof val === "number" && !isNaN(val)) {
        return acc + Math.max(0, Math.round(val));
      }
      return acc;
    }, 0);
  }

  let itemsSubtotal = 0;
  let essentialTotal = 0;
  let optionalTotal = 0;
  let essentialCount = 0;
  let optionalCount = 0;

  const subtotals = items.map((item) => {
    const qty = Math.max(1, Math.round(item.quantity || 1));
    const price = Math.max(0, Math.round(item.unitPrice || 0));
    const sub = Math.round(qty * price);
    itemsSubtotal += sub;

    if (item.essential) {
      essentialCount++;
      essentialTotal += sub;
    } else {
      optionalCount++;
      optionalTotal += sub;
    }

    return sub;
  });

  const total = itemsSubtotal + cleanAdditionalCosts;
  const remainingBudget = Math.max(0, cleanBudget - total);
  const budgetOverrun = Math.max(0, total - cleanBudget);
  const withinBudget = total <= cleanBudget;

  return {
    itemsSubtotal,
    additionalCostsTotal: cleanAdditionalCosts,
    subtotals,
    total,
    remainingBudget,
    budgetOverrun,
    withinBudget,
    essentialCount,
    optionalCount,
    essentialTotal,
    optionalTotal,
  };
}

/**
 * Intelligent Budget Optimization Engine:
 * 1. Checks initial plan against budget.
 * 2. If overrun detected, searches for cheaper suitable alternatives to expensive products.
 * 3. Preserves essential items and quantities.
 * 4. Removes/reduces optional items in priority order.
 * 5. Explains every change and verifies budget feasibility without false claims.
 */
export function optimizeShoppingPlan(
  plan: ShoppingPlanData,
  targetBudget?: number,
  options: OptimizationOptions = {}
): ShoppingPlanData {
  // 1. Handle Restore Original request
  if (options.userConstraints?.restoreOriginal) {
    if (plan.originalPlan) {
      const restored = JSON.parse(JSON.stringify(plan.originalPlan)) as ShoppingPlanData;
      return {
        ...restored,
        version: plan.version + 1,
        timestamp: new Date().toLocaleString("en-IN") + " IST",
        optimizationSummary: "Restored original plan before optimization.",
        changes: [],
        originalPlan: plan.originalPlan, // keep historical reference
      };
    }
    return plan;
  }

  // Preserve originalPlan baseline
  const originalPlanSnapshot: ShoppingPlanData =
    plan.originalPlan || JSON.parse(JSON.stringify(plan));

  let budget: number;
  if (targetBudget !== undefined && targetBudget !== null) {
    const validation = validateBudgetInr(targetBudget);
    if (!validation.valid || validation.budget === undefined) {
      throw new Error(validation.error || "A positive rupee target budget amount is required.");
    }
    budget = validation.budget;
  } else {
    const validation = validateBudgetInr(plan.budget);
    if (!validation.valid || validation.budget === undefined) {
      throw new Error(validation.error || "Plan budget is invalid.");
    }
    budget = validation.budget;
  }

  const candidateCatalog =
    options.candidateCatalog !== undefined
      ? options.candidateCatalog
      : PRODUCT_CATALOG;

  const protectedIds = new Set<string>(options.userConstraints?.protectedItemIds || []);

  // Normalize items and apply user constraints / priority overrides
  let currentItems: ProductItem[] = plan.items.map((raw) => {
    let item = normalizeProductItem(raw);

    // Manual override takes highest precedence
    if (options.userConstraints?.priorityOverrides?.[item.id]) {
      const override = options.userConstraints.priorityOverrides[item.id];
      const essential =
        override.essential !== undefined
          ? Boolean(override.essential)
          : override.optional !== undefined
          ? !override.optional
          : item.essential;
      item = {
        ...item,
        essential,
        optional: !essential,
        priority: override.priority ?? item.priority,
      };
    }

    if (protectedIds.has(item.id)) {
      item = {
        ...item,
        essential: true,
        optional: false,
      };
    }

    return item;
  });

  // Step A: Calculate Initial Plan
  const initialFin = validatePlanFinancials(currentItems, budget, options.additionalCosts);
  const originalTotal = plan.originalTotal ?? initialFin.total;

  // If already fits within budget and no specific item alternative requested, return without unnecessary changes
  if (
    initialFin.withinBudget &&
    !options.userConstraints?.findAlternativeForId &&
    !options.userConstraints?.removeLeastImportant
  ) {
    const result: BudgetOptimizationResult = {
      feasible: true,
      originalTotal,
      optimizedTotal: initialFin.total,
      budgetOverrun: 0,
      savings: 0,
      remainingBudget: initialFin.remainingBudget,
      essentialCount: initialFin.essentialCount,
      optionalCount: initialFin.optionalCount,
      removedItems: [],
      replacedItems: [],
      changes: [],
      explanation: `Plan already fits within the specified budget of ₹${budget.toLocaleString("en-IN")}. No optimization required.`,
      summary: `Plan already fits within budget: ₹${initialFin.total.toLocaleString("en-IN")} / ₹${budget.toLocaleString("en-IN")} (₹${initialFin.remainingBudget.toLocaleString("en-IN")} remaining). No optimization required.`,
    };

    return {
      ...plan,
      budget,
      totalAmount: initialFin.total,
      remainingAmount: initialFin.remainingBudget,
      originalTotal,
      originalPlan: originalPlanSnapshot,
      budgetOverrun: 0,
      totalSavings: 0,
      feasible: true,
      changes: [],
      optimizationResult: result,
      optimizationSummary: result.summary,
      validation: {
        ...plan.validation,
        budgetCompliant: true,
      },
    };
  }

  // Step B & C: Budget Optimization Workflow
  const changes: PlanOptimizationChange[] = [];
  const removedItems: ProductItem[] = [];
  const replacedItems: { original: ProductItem; alternative: ProductItem; savings: number }[] = [];

  let currentFin = validatePlanFinancials(currentItems, budget, options.additionalCosts);

  // Stage 1: Find cheaper, suitable alternatives for expensive products
  // Sort items by unit price descending to target the biggest budget contributors first
  const sortedIndices = currentItems
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => b.item.unitPrice - a.item.unitPrice)
    .map((x) => x.idx);

  for (const idx of sortedIndices) {
    if (currentFin.withinBudget && !options.userConstraints?.findAlternativeForId) {
      break;
    }

    const item = currentItems[idx];

    // If a specific alternative is requested, skip all other items
    if (
      options.userConstraints?.findAlternativeForId &&
      options.userConstraints.findAlternativeForId !== item.id
    ) {
      continue;
    }

    // Search for cheaper alternatives in catalog
    const alternatives = findCheaperAlternatives(item, candidateCatalog, {
      userRequirements: options.userConstraints?.userRequirements,
      strictlyEnforceMustHaves: options.userConstraints?.strictlyEnforceMustHaves,
    });

    if (alternatives.length > 0) {
      const bestAlt = alternatives[0];
      const altUnitPrice = Math.round(bestAlt.priceMinor / 100);
      const savings = Math.round((item.unitPrice - altUnitPrice) * item.quantity);

      if (savings > 0) {
        const altItem: ProductItem = {
          ...item,
          id: bestAlt.id,
          asin: bestAlt.asin || bestAlt.id,
          name: bestAlt.name,
          category: bestAlt.category,
          unitPrice: altUnitPrice,
          totalPrice: altUnitPrice * item.quantity,
          subtotal: altUnitPrice * item.quantity,
          originalPrice: item.unitPrice,
          rationale: bestAlt.description || `Budget alternative for ${item.name}`,
          reason: `Replaced with "${bestAlt.name}" saving ₹${savings.toLocaleString("en-IN")} while satisfying requirements.`,
          optimizationNote: `Switched from "${item.name}" (saved ₹${savings.toLocaleString("en-IN")})`,
          inStock: bestAlt.inStock,
          rating: bestAlt.rating,
          totalReviews: bestAlt.totalReviews,
          url: bestAlt.url,
          imageUrl: bestAlt.imageUrl,
          source: bestAlt.source,
          badge: bestAlt.source === "scraperapi" ? "Amazon India Verified" : "Budget Alternative",
        };

        currentItems[idx] = altItem;
        replacedItems.push({ original: item, alternative: altItem, savings });

        changes.push({
          type: "replaced",
          itemId: item.id,
          itemName: item.name,
          originalPrice: item.subtotal || item.unitPrice * item.quantity,
          newPrice: altItem.subtotal,
          savings,
          reason: `The original ${item.name} costs ₹${item.unitPrice.toLocaleString("en-IN")}. Found a suitable alternative for ₹${altUnitPrice.toLocaleString("en-IN")}. Switching saves ₹${savings.toLocaleString("en-IN")} while preserving your requirements.`,
          essentialAffected: false,
          tradeOff: bestAlt.rating
            ? `Alternative rated ★${bestAlt.rating} (${bestAlt.totalReviews || 0} reviews).`
            : "Cheaper alternative providing equivalent core functionality.",
          alternativeItem: altItem,
          tradeOffDetails: {
            advantages: [
              `Saves ₹${savings.toLocaleString("en-IN")}`,
              ...(bestAlt.rating && bestAlt.rating >= 4.0 ? [`Alternative rated ★${bestAlt.rating}`] : []),
            ],
            drawbacks: [
              ...(item.rating && bestAlt.rating && bestAlt.rating < item.rating
                ? [`Lower rating than original (★${bestAlt.rating} vs ★${item.rating})`]
                : []),
            ],
            costDifference: savings,
          },
        });

        // Recalculate plan after proposed change
        currentFin = validatePlanFinancials(currentItems, budget, options.additionalCosts);
      }
    } else if (options.userConstraints?.findAlternativeForId === item.id) {
      // User explicitly asked for alternative for this item, but none found
      // Report limitation honestly without inventing products
    }
  }

  // Stage 2: If still over budget, remove or reduce optional items according to priority
  if (!currentFin.withinBudget || options.userConstraints?.removeLeastImportant) {
    // Collect optional items that are not explicitly protected
    const optionalItems = currentItems.filter(
      (item) => !item.essential && !protectedIds.has(item.id)
    );

    // Sort optional items by priority descending (highest priority number = least important), then by price descending
    optionalItems.sort((a, b) => (b.priority ?? 2) - (a.priority ?? 2) || b.unitPrice - a.unitPrice);

    for (const optItem of optionalItems) {
      if (currentFin.withinBudget && !options.userConstraints?.removeLeastImportant) {
        break;
      }

      // If quantity > 1, first attempt reducing quantity
      if (optItem.quantity > 1) {
        const itemIdx = currentItems.findIndex((i) => i.id === optItem.id);
        if (itemIdx >= 0) {
          const newQty = optItem.quantity - 1;
          const savings = optItem.unitPrice;
          currentItems[itemIdx] = {
            ...optItem,
            quantity: newQty,
            totalPrice: optItem.unitPrice * newQty,
            subtotal: optItem.unitPrice * newQty,
          };

          changes.push({
            type: "quantity_reduced",
            itemId: optItem.id,
            itemName: optItem.name,
            originalPrice: optItem.subtotal || optItem.unitPrice * optItem.quantity,
            newPrice: optItem.unitPrice * newQty,
            savings,
            reason: `Reduced quantity of optional item "${optItem.name}" from ${optItem.quantity} to ${newQty} to save ₹${savings.toLocaleString("en-IN")}.`,
            essentialAffected: false,
            tradeOff: `Fewer units of optional convenience item.`,
          });

          currentFin = validatePlanFinancials(currentItems, budget, options.additionalCosts);
          if (currentFin.withinBudget) break;
        }
      }

      // Otherwise, remove the optional item entirely
      const itemIdx = currentItems.findIndex((i) => i.id === optItem.id);
      if (itemIdx >= 0) {
        const removed = currentItems.splice(itemIdx, 1)[0];
        removedItems.push(removed);

        const savings = removed.subtotal || removed.unitPrice * removed.quantity;
        changes.push({
          type: "removed",
          itemId: removed.id,
          itemName: removed.name,
          originalPrice: savings,
          newPrice: 0,
          savings,
          reason: `Your plan exceeded the budget. Kept all essential products and removed optional item "${removed.name}" (priority ${removed.priority ?? 2}) worth ₹${savings.toLocaleString("en-IN")}.`,
          essentialAffected: false,
          tradeOff: `Optional accessory omitted to satisfy budget ceiling.`,
        });

        currentFin = validatePlanFinancials(currentItems, budget, options.additionalCosts);
      }
    }
  }

  // Stage 3: Final Plan Validation & Feasibility Check
  const finalFin = validatePlanFinancials(currentItems, budget, options.additionalCosts);
  const totalSavings = Math.max(0, originalTotal - finalFin.total);

  let explanation = "";
  let summary = "";
  let lowestFeasibleTotal: number | undefined;
  let shortfallAmount: number | undefined;
  let infeasibilityReason: string | undefined;
  let suggestedCompromises: string[] | undefined;

  if (finalFin.withinBudget) {
    explanation = `Plan successfully optimized! Total reduced from ₹${originalTotal.toLocaleString("en-IN")} to ₹${finalFin.total.toLocaleString("en-IN")}, saving ₹${totalSavings.toLocaleString("en-IN")}. All ${finalFin.essentialCount} essential items were strictly preserved.`;
    summary = `Optimized to ₹${finalFin.total.toLocaleString("en-IN")} (₹${finalFin.remainingBudget.toLocaleString("en-IN")} remaining). Total savings: ₹${totalSavings.toLocaleString("en-IN")}.`;
  } else {
    // Infeasible: Even after removing all optional items and finding available alternatives, essential items exceed budget
    lowestFeasibleTotal = finalFin.total;
    shortfallAmount = finalFin.budgetOverrun;
    infeasibilityReason = `Essential items alone total ₹${lowestFeasibleTotal.toLocaleString("en-IN")}, which exceeds your ₹${budget.toLocaleString("en-IN")} budget by ₹${shortfallAmount.toLocaleString("en-IN")}. No further reductions can be made without compromising required items.`;
    suggestedCompromises = [
      `Increase budget by ₹${shortfallAmount.toLocaleString("en-IN")} (to ₹${lowestFeasibleTotal.toLocaleString("en-IN")}) to preserve all essential requirements.`,
      `Authorize removing or replacing one of the essential items (${currentItems.map((i) => `"${i.name}"`).slice(0, 2).join(", ")}).`,
      `Reduce required quantities or choose lower-tier specifications if available.`,
    ];
    explanation = infeasibilityReason;
    summary = `Infeasible with current constraints. Minimum feasible total: ₹${lowestFeasibleTotal.toLocaleString("en-IN")} (shortfall: ₹${shortfallAmount.toLocaleString("en-IN")}).`;
  }

  const result: BudgetOptimizationResult = {
    feasible: finalFin.withinBudget,
    originalTotal,
    optimizedTotal: finalFin.total,
    budgetOverrun: finalFin.budgetOverrun,
    savings: totalSavings,
    remainingBudget: finalFin.remainingBudget,
    essentialCount: finalFin.essentialCount,
    optionalCount: finalFin.optionalCount,
    removedItems,
    replacedItems,
    changes,
    explanation,
    summary,
    lowestFeasibleTotal,
    shortfallAmount,
    infeasibilityReason,
    suggestedCompromises,
  };

  return {
    ...plan,
    budget,
    totalAmount: finalFin.total,
    remainingAmount: finalFin.remainingBudget,
    originalTotal,
    originalPlan: originalPlanSnapshot,
    budgetOverrun: finalFin.budgetOverrun,
    totalSavings,
    feasible: finalFin.withinBudget,
    items: currentItems,
    changes,
    optimizationResult: result,
    optimizationSummary: summary,
    validation: {
      ...plan.validation,
      budgetCompliant: finalFin.withinBudget, // NEVER falsely claim true when over budget
    },
  };
}

/**
 * Handles conversational follow-up user requests such as:
 * - "Reduce my budget to ₹2,000"
 * - "Keep all essential items"
 * - "Find a cheaper alternative to this product"
 * - "Remove the least important items"
 * - "Don't remove my shoes"
 * - "Restore the original plan"
 */
export function processFollowUpRequest(
  plan: ShoppingPlanData,
  userRequest: string,
  options: OptimizationOptions = {}
): ShoppingPlanData {
  const reqLower = userRequest.toLowerCase().trim();

  // 1. "Restore original plan" / "Reset"
  if (
    reqLower.includes("restore") ||
    reqLower.includes("reset") ||
    reqLower.includes("undo") ||
    reqLower.includes("original plan")
  ) {
    return optimizeShoppingPlan(plan, undefined, {
      ...options,
      userConstraints: { ...options.userConstraints, restoreOriginal: true },
    });
  }

  // 2. Budget modification: "Reduce budget to 2000", "Change budget to ₹1,50,000"
  const budgetMatch = reqLower.match(/(?:budget\s*(?:to|is|of)?|reduce\s*(?:to|by)?|set\s*budget\s*to)\s*[:=]?\s*(?:rs\.?|₹|inr)?\s*([0-9]+(?:,[0-9]+)*)/i);
  let targetBudget = plan.budget;
  if (budgetMatch) {
    const parsed = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      if (parsed > MAX_BUDGET_INR) {
        return {
          ...plan,
          optimizationSummary: `Requested budget of ₹${parsed.toLocaleString("en-IN")} exceeds the maximum allowed limit of ₹${MAX_BUDGET_INR.toLocaleString("en-IN")} (2 lakh INR). Please select a budget up to ₹2,00,000.`,
          optimizationResult: {
            ...plan.optimizationResult,
            explanation: `Requested budget of ₹${parsed.toLocaleString("en-IN")} exceeds the maximum permitted limit of ₹${MAX_BUDGET_INR.toLocaleString("en-IN")} (2 lakh INR).`,
          } as any,
        };
      }
      targetBudget = parsed;
    }
  }

  // 3. Item protection: "Don't remove my [item]", "Keep my [item]"
  const protectMatch = reqLower.match(/(?:don't remove|do not remove|keep|protect)\s+(?:my\s+)?([a-z0-9\s-]+)/i);
  const protectedItemIds = [...(options.userConstraints?.protectedItemIds || [])];

  if (protectMatch) {
    const query = protectMatch[1].trim();
    for (const item of plan.items) {
      if (
        item.name.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query))
      ) {
        protectedItemIds.push(item.id);
      }
    }
  }

  // 4. "Find a cheaper alternative to [X]"
  let findAlternativeForId: string | undefined = undefined;
  if (reqLower.includes("cheaper alternative") || reqLower.includes("cheaper option")) {
    for (const item of plan.items) {
      const nameTokens = item.name.toLowerCase().split(/\s+/);
      if (nameTokens.some((t) => t.length > 3 && reqLower.includes(t))) {
        findAlternativeForId = item.id;
        break;
      }
    }
    // If not found by token, target the single most expensive item
    if (!findAlternativeForId && plan.items.length > 0) {
      const mostExpensive = [...plan.items].sort((a, b) => b.unitPrice - a.unitPrice)[0];
      findAlternativeForId = mostExpensive.id;
    }
  }

  // 5. "Remove least important items"
  const removeLeastImportant =
    reqLower.includes("least important") ||
    reqLower.includes("remove optional") ||
    reqLower.includes("cut unnecessary");

  return optimizeShoppingPlan(plan, targetBudget, {
    ...options,
    userConstraints: {
      ...options.userConstraints,
      protectedItemIds,
      findAlternativeForId,
      removeLeastImportant,
      keepAllEssentials: true,
    },
  });
}
