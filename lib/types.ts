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
    .nonnegative("Budget cannot be negative"),
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

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: "supplies" | "stationery" | "electronics" | "snacks" | "apparel" | "hygiene";
  description: string;
  priceMinor: number; // in paise
  inStock: boolean;
  availableStock: number;
  unit: string;
}
