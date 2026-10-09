import { formatInr, getProductById } from "./catalog";
import { PlanDiff, ShoppingPlan, ShoppingPlanItem } from "./types";

/**
 * Computes a structured and human-readable diff between an old plan version and a new plan version.
 */
export function computePlanDiff(oldPlan: ShoppingPlan, newPlan: ShoppingPlan): PlanDiff {
  const oldItemMap = new Map<string, ShoppingPlanItem>();
  for (const item of oldPlan.items) {
    oldItemMap.set(item.productId, item);
  }

  const newItemMap = new Map<string, ShoppingPlanItem>();
  for (const item of newPlan.items) {
    newItemMap.set(item.productId, item);
  }

  const addedItems: ShoppingPlanItem[] = [];
  const removedItems: ShoppingPlanItem[] = [];
  const changedQuantities: {
    productId: string;
    oldQuantity: number;
    newQuantity: number;
    unitPriceMinor: number;
  }[] = [];

  for (const [id, newItem] of newItemMap.entries()) {
    const oldItem = oldItemMap.get(id);
    if (!oldItem) {
      addedItems.push(newItem);
    } else if (oldItem.quantity !== newItem.quantity) {
      changedQuantities.push({
        productId: id,
        oldQuantity: oldItem.quantity,
        newQuantity: newItem.quantity,
        unitPriceMinor: newItem.unitPriceMinor,
      });
    }
  }

  for (const [id, oldItem] of oldItemMap.entries()) {
    if (!newItemMap.has(id)) {
      removedItems.push(oldItem);
    }
  }

  const budgetDeltaMinor = newPlan.budgetMinor - oldPlan.budgetMinor;
  const totalDeltaMinor = newPlan.totalMinor - oldPlan.totalMinor;

  const summaryParts: string[] = [];
  if (budgetDeltaMinor !== 0) {
    const direction = budgetDeltaMinor > 0 ? "increased" : "reduced";
    summaryParts.push(
      `Budget was ${direction} by ${formatInr(Math.abs(budgetDeltaMinor))} (${formatInr(oldPlan.budgetMinor)} -> ${formatInr(newPlan.budgetMinor)}).`
    );
  }

  if (addedItems.length > 0) {
    const names = addedItems
      .map((i) => `${getProductById(i.productId)?.name ?? i.productId} (x${i.quantity})`)
      .join(", ");
    summaryParts.push(`Added items: ${names}.`);
  }

  if (removedItems.length > 0) {
    const names = removedItems
      .map((i) => `${getProductById(i.productId)?.name ?? i.productId} (x${i.quantity})`)
      .join(", ");
    summaryParts.push(`Removed items: ${names}.`);
  }

  if (changedQuantities.length > 0) {
    const changes = changedQuantities
      .map((c) => `${getProductById(c.productId)?.name ?? c.productId}: ${c.oldQuantity} -> ${c.newQuantity}`)
      .join(", ");
    summaryParts.push(`Adjusted quantities: ${changes}.`);
  }

  const totalDirection = totalDeltaMinor >= 0 ? "increased" : "reduced";
  summaryParts.push(
    `Total plan commitment ${totalDirection} by ${formatInr(Math.abs(totalDeltaMinor))} (${formatInr(oldPlan.totalMinor)} -> ${formatInr(newPlan.totalMinor)}).`
  );

  return {
    intentId: newPlan.intentId,
    fromVersion: oldPlan.version,
    toVersion: newPlan.version,
    addedItems,
    removedItems,
    changedQuantities,
    budgetDeltaMinor,
    totalDeltaMinor,
    summary: summaryParts.join(" "),
  };
}
