import { ProductItem, ShoppingPlanData } from "@/data/mockData";
import { ShoppingPlan, ShoppingPlanItem } from "@/lib/types";
import { CostCompleteness, UserTradeOffPreference } from "@/lib/trade-off-engine";

export interface ValidatedScenario {
  scenarioId: string;
  parentPlanId: string;
  parentVersion: number;
  version: number;
  scenarioDescription: string;
  // Specific parsed modifications
  budget?: number; // In Rupees (₹)
  budgetDelta?: number; // e.g. -1000 or +2000
  peopleCount?: number;
  peopleDelta?: number; // e.g. +1
  durationDays?: number;
  durationDelta?: number;
  removedItems: string[]; // item keywords or IDs
  addedRequirements: string[]; // text descriptions of items/features to add
  priorityChanges?: Record<
    string,
    { essential?: boolean; optional?: boolean; priority?: number }
  >;
  targetPreference?: UserTradeOffPreference;
  keepEssentials?: boolean;
  spendLess?: boolean;
  createdAt: string;
  // Ambiguity handling
  ambiguityQuestion?: string;
  validationErrors?: string[];
  isValid: boolean;
}

export interface ScenarioInterpretationContext {
  currentBudget: number;
  currentSituation: string;
  currentItems: ProductItem[];
  currentPeopleCount?: number;
  currentDurationDays?: number;
  currentPreference?: UserTradeOffPreference;
  parentPlanId: string;
  parentVersion: number;
}

export interface PlanVersionRecord {
  intentId: string;
  version: number;
  parentVersion: number | null;
  scenarioId?: string;
  scenarioDescription: string;
  scenario?: ValidatedScenario;
  plan: ShoppingPlanData;
  shoppingPlan: ShoppingPlan;
  planHash: string;
  canonicalString: string;
  createdAt: string;
  budget: number;
  totalAmount: number;
  remainingAmount: number;
  budgetOverrun: number;
  peopleCount: number;
  durationDays: number;
  summaryOfChanges: string;
  reasonsForChanges: {
    itemId: string;
    name: string;
    reason: string;
    changeType: "added" | "removed" | "quantity_adjusted" | "alternative_swap" | "retained";
  }[];
  onChainCommitment?: {
    txHash?: string;
    blockNumber?: number;
    timestamp?: number;
    status: "uncommitted" | "pending" | "confirmed" | "failed";
  };
}

export interface PlanComparisonResult {
  fromVersion: number;
  toVersion: number;
  budgetFrom: number;
  budgetTo: number;
  budgetDelta: number;
  totalFrom: number;
  totalTo: number;
  totalDelta: number;
  savings: number; // positive if new total is less than old total
  remainingFrom: number;
  remainingTo: number;
  overrunFrom: number;
  overrunTo: number;
  peopleCountFrom: number;
  peopleCountTo: number;
  durationFrom: number;
  durationTo: number;
  addedProducts: ProductItem[];
  removedProducts: ProductItem[];
  retainedProducts: { from: ProductItem; to: ProductItem }[];
  quantityChanges: {
    product: ProductItem;
    oldQuantity: number;
    newQuantity: number;
    delta: number;
    unitPrice: number;
    costDelta: number;
  }[];
  unitPriceChanges: {
    product: ProductItem;
    oldUnitPrice: number;
    newUnitPrice: number;
    delta: number;
  }[];
  changedRequirements: string[];
  keyTradeOffs: string[];
  costCompleteness: CostCompleteness;
  unknownOrStaleInfo: string[];
  summary: string;
  explanation: string;
}
