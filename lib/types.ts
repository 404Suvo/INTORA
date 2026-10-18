import { z } from "zod";

declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * Supported currency is strictly Indian Rupees (INR).
 * All monetary amounts are integer minor units (paise). 1 INR = 100 paise.
 * Floats are strictly prohibited in plans, hashes, and validation logic.
 */
export const CURRENCY = "INR" as const;

/**
 * Budget limits in Indian Rupees (INR) and minor units (paise).
 * Supports budgets from ₹100 up to ₹2,00,000 (2 lakh INR).
 */
export const MIN_BUDGET_INR = 100;
export const MAX_BUDGET_INR = 200000;
export const MIN_BUDGET_PAISE = MIN_BUDGET_INR * 100; // 10,000 paise
export const MAX_BUDGET_PAISE = MAX_BUDGET_INR * 100; // 20,000,000 paise (200 lakh paise)

/**
 * Validates a user budget in INR (rupees).
 * Enforces positive numeric values within [MIN_BUDGET_INR, MAX_BUDGET_INR].
 */
export function validateBudgetInr(budget: unknown): {
  valid: boolean;
  error?: string;
  budget?: number;
} {
  if (budget === null || budget === undefined || budget === "") {
    return { valid: false, error: "A positive rupee budget amount is required." };
  }

  let num: number;
  if (typeof budget === "number") {
    num = budget;
  } else {
    const str = String(budget).trim().toLowerCase();
    const lakhMatch = str.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lacs?|lac|lakh)$/i);
    const kMatch = str.match(/^([0-9]+(?:\.[0-9]+)?)\s*k$/i);

    if (lakhMatch) {
      num = parseFloat(lakhMatch[1]) * 100000;
    } else if (kMatch) {
      num = parseFloat(kMatch[1]) * 1000;
    } else {
      num = parseFloat(str.replace(/,/g, "").replace(/^[₹\s]*(?:rs\.?|inr)?\s*/i, ""));
    }
  }

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: "Budget must be a valid numeric value." };
  }
  if (num <= 0) {
    return { valid: false, error: "A positive rupee 'budget' amount is required." };
  }
  if (num < MIN_BUDGET_INR) {
    return {
      valid: false,
      error: `Budget must be at least ₹${MIN_BUDGET_INR.toLocaleString("en-IN")}.`,
    };
  }
  if (num > MAX_BUDGET_INR) {
    return {
      valid: false,
      error: `Budget cannot exceed ₹${MAX_BUDGET_INR.toLocaleString("en-IN")} (2 lakh INR).`,
    };
  }
  return { valid: true, budget: Math.round(num) };
}

export const ShoppingPlanItemSchema = z.object({
  productId: z.string().min(1, "Product ID cannot be empty"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(100, "Quantity cannot exceed 100 units per line"),
  unitPriceMinor: z
    .number()
    .int("Unit price must be an integer minor unit (paise)")
    .nonnegative("Unit price cannot be negative"),
});

export type ShoppingPlanItem = z.infer<typeof ShoppingPlanItemSchema>;

export const ShoppingPlanSchema = z.object({
  schemaVersion: z.string().default("1.0.0"),
  intentId: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Intent ID must be a valid 32-byte hex string (0x + 64 hex characters)"),
  version: z
    .number()
    .int("Version must be an integer")
    .min(1, "Version must be >= 1"),
  currency: z.literal(CURRENCY),
  budgetMinor: z
    .number()
    .int("Budget must be an integer minor unit (paise)")
    .min(MIN_BUDGET_PAISE, `Budget must be at least ₹${MIN_BUDGET_INR.toLocaleString("en-IN")}`)
    .max(MAX_BUDGET_PAISE, `Budget cannot exceed ₹${MAX_BUDGET_INR.toLocaleString("en-IN")}`),
  items: z.array(ShoppingPlanItemSchema).min(1, "Shopping plan must include at least one item"),
  totalMinor: z
    .number()
    .int("Total must be an integer minor unit (paise)")
    .nonnegative("Total cannot be negative"),
  expiry: z
    .number()
    .int("Expiry must be an integer unix timestamp (seconds)")
    .positive("Expiry must be a positive timestamp"),
  salt: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Salt must be a 32-byte hex string if provided")
    .optional(),
});

export type ShoppingPlan = z.infer<typeof ShoppingPlanSchema>;

export interface PriceMismatch {
  productId: string;
  aiPriceMinor: number;
  catalogPriceMinor: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  priceMismatches: PriceMismatch[];
  validatedPlan?: ShoppingPlan;
}

export interface PlanDiff {
  intentId: string;
  fromVersion: number;
  toVersion: number;
  addedItems: ShoppingPlanItem[];
  removedItems: ShoppingPlanItem[];
  changedQuantities: {
    productId: string;
    oldQuantity: number;
    newQuantity: number;
    unitPriceMinor: number;
  }[];
  budgetDeltaMinor: number;
  totalDeltaMinor: number;
  summary: string;
}

export interface StoredPlanRecord {
  intentId: `0x${string}`;
  version: number;
  plan: ShoppingPlan;
  canonicalString: string;
  planHash: `0x${string}`;
  createdAt: string;
  onChainCommitment?: {
    txHash?: `0x${string}`;
    blockNumber?: number;
    timestamp?: number;
    status: "uncommitted" | "pending" | "confirmed" | "failed";
  };
}

export type ProductCategory = "supplies" | "stationery" | "electronics" | "snacks" | "apparel" | "hygiene" | (string & {});

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  priceMinor: number; // in paise
  inStock: boolean;
  availableStock: number;
  unit: string;
  asin?: string;
  url?: string;
  imageUrl?: string;
  rating?: number;
  totalReviews?: number;
  retrievedAt?: string;
  source?: "scraperapi" | "fixture" | "catalog";
}

export {
  type PlanOptimizationChange,
  type BudgetOptimizationResult,
  type ProductItem,
  type ShoppingPlanData,
} from "@/data/mockData";

export {
  type ProductCostBreakdown,
  type ProductComparisonItem,
  type TradeOffRecommendation,
  type UserTradeOffPreference,
  type CostCompleteness,
  type NormalizedProduct,
  type UserRequirement,
  type RequirementMatchResult,
} from "./trade-off-engine";

export {
  type BudgetMode,
  type PriceTolerance,
  type UserBudgetIntent,
  type TargetPriceDelta,
} from "./budget-intent";

export const SCHEMA_VERSION = "1.0.0" as const;

/**
 * Type-guard to test if an unknown value satisfies the 32-byte hex format.
 */
export function isHex32(val: unknown): val is `0x${string}` {
  return typeof val === "string" && /^0x[0-9a-fA-F]{64}$/.test(val);
}

/**
 * Validates that an amount is a non-negative integer minor unit (e.g. paise).
 */
export function isValidMinorAmount(val: unknown): val is number {
  return typeof val === "number" && Number.isInteger(val) && val >= 0;
}

/**
 * Type-guard verifying an item against the ShoppingPlanItem schema.
 */
export function isShoppingPlanItem(val: unknown): val is ShoppingPlanItem {
  return ShoppingPlanItemSchema.safeParse(val).success;
}

