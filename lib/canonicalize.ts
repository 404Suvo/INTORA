import { ShoppingPlan, ShoppingPlanItem } from "./types";

/**
 * Merges duplicate product IDs by summing their quantities,
 * and sorts the items deterministically by productId ascending.
 */
export function normalizeAndSortItems(items: readonly ShoppingPlanItem[]): ShoppingPlanItem[] {
  const mergedMap = new Map<string, { quantity: number; unitPriceMinor: number }>();

  for (const item of items) {
    const existing = mergedMap.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      mergedMap.set(item.productId, {
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
      });
    }
  }

  const sortedProductIds = Array.from(mergedMap.keys()).sort();

  return sortedProductIds.map((productId) => {
    const record = mergedMap.get(productId)!;
    return {
      productId,
      quantity: record.quantity,
      unitPriceMinor: record.unitPriceMinor,
    };
  });
}

/**
 * Deterministically serializes a ShoppingPlan into a canonical UTF-8 JSON string.
 * Rules:
 * 1. Normalized and merged items, sorted by productId ascending.
 * 2. Lexicographically ordered keys at root and item levels.
 * 3. Zero extraneous whitespace.
 * 4. Amounts safely encoded without floating point representation.
 */
export function canonicalizePlan(plan: ShoppingPlan): string {
  const normalizedItems = normalizeAndSortItems(plan.items);

  const formattedItems = normalizedItems.map((item) => {
    return (
      `{"productId":${JSON.stringify(item.productId)},` +
      `"quantity":${item.quantity},` +
      `"unitPriceMinor":${item.unitPriceMinor}}`
    );
  });

  const parts: string[] = [
    `"budgetMinor":${plan.budgetMinor}`,
    `"currency":${JSON.stringify(plan.currency)}`,
    `"expiry":${plan.expiry}`,
    `"intentId":${JSON.stringify(plan.intentId.toLowerCase())}`,
    `"items":[${formattedItems.join(",")}]`,
  ];

  if (plan.salt) {
    parts.push(`"salt":${JSON.stringify(plan.salt.toLowerCase())}`);
  }

  parts.push(`"schemaVersion":${JSON.stringify(plan.schemaVersion)}`);
  parts.push(`"totalMinor":${plan.totalMinor}`);
  parts.push(`"version":${plan.version}`);

  return `{${parts.join(",")}}`;
}
