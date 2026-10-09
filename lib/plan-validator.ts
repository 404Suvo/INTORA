import { getProductById } from "./catalog";
import { normalizeAndSortItems } from "./canonicalize";
import {
  CURRENCY,
  PriceMismatch,
  ShoppingPlan,
  ShoppingPlanItem,
  ShoppingPlanSchema,
  ValidationResult,
} from "./types";

export interface PlanValidationOptions {
  nowTimestamp?: number; // unix seconds override for testing
}

/**
 * Validates a candidate shopping plan against Zod schema and authoritative catalog data.
 * Adheres strictly to Hard Rules 3 and 4:
 * - Overwrites any AI price hallucination with the authoritative catalog price.
 * - Records all detected price discrepancies.
 * - Recomputes totalMinor strictly as sum(unitPriceMinor * quantity).
 * - Enforces totalMinor <= budgetMinor.
 * - Enforces stock availability.
 * - Enforces future expiry.
 */
export function validatePlan(candidate: unknown, options: PlanValidationOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const priceMismatches: PriceMismatch[] = [];

  const parseResult = ShoppingPlanSchema.safeParse(candidate);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`${issue.path.join(".") || "plan"}: ${issue.message}`);
    }
    return {
      valid: false,
      errors,
      warnings,
      priceMismatches,
    };
  }

  const rawPlan = parseResult.data;
  const currentTimestamp = options.nowTimestamp ?? Math.floor(Date.now() / 1000);

  // Check expiry
  if (rawPlan.expiry <= currentTimestamp) {
    errors.push(`Plan expiry timestamp (${rawPlan.expiry}) must be in the future (current: ${currentTimestamp})`);
  }

  // Currency check
  if (rawPlan.currency !== CURRENCY) {
    errors.push(`Currency must be "${CURRENCY}", got "${rawPlan.currency}"`);
  }

  // Merge duplicates first so stock and quantity checks apply to the combined requirement
  const mergedItems = normalizeAndSortItems(rawPlan.items);
  const validatedItems: ShoppingPlanItem[] = [];
  let calculatedTotalMinor = 0;

  for (const item of mergedItems) {
    const catalogProduct = getProductById(item.productId);
    if (!catalogProduct) {
      errors.push(`Product "${item.productId}" does not exist in the official catalog`);
      continue;
    }

    if (!catalogProduct.inStock) {
      errors.push(`Product "${catalogProduct.name}" (${item.productId}) is currently out of stock`);
      continue;
    }

    if (item.quantity > catalogProduct.availableStock) {
      errors.push(
        `Requested quantity for "${catalogProduct.name}" (${item.quantity}) exceeds available inventory (${catalogProduct.availableStock})`
      );
    }

    // Flag AI price mismatch and overwrite with catalog price
    if (item.unitPriceMinor !== catalogProduct.priceMinor) {
      priceMismatches.push({
        productId: item.productId,
        aiPriceMinor: item.unitPriceMinor,
        catalogPriceMinor: catalogProduct.priceMinor,
      });
      warnings.push(
        `Price mismatch for "${catalogProduct.name}": AI proposed ${item.unitPriceMinor} paise, overwritten with catalog price ${catalogProduct.priceMinor} paise`
      );
    }

    const correctedPrice = catalogProduct.priceMinor;
    calculatedTotalMinor += correctedPrice * item.quantity;

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceMinor: correctedPrice,
    });
  }

  // Budget verification
  if (calculatedTotalMinor > rawPlan.budgetMinor) {
    errors.push(
      `Plan total (${calculatedTotalMinor} paise) exceeds budget cap of ${rawPlan.budgetMinor} paise`
    );
  }

  // Check if AI total differed
  if (rawPlan.totalMinor !== calculatedTotalMinor) {
    warnings.push(
      `Total recomputed: AI declared ${rawPlan.totalMinor} paise, recomputed as ${calculatedTotalMinor} paise`
    );
  }

  const isValid = errors.length === 0;

  const validatedPlan: ShoppingPlan | undefined = isValid
    ? {
        ...rawPlan,
        items: validatedItems,
        totalMinor: calculatedTotalMinor,
      }
    : undefined;

  return {
    valid: isValid,
    errors,
    warnings,
    priceMismatches,
    validatedPlan,
  };
}
