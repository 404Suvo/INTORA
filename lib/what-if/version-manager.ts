import fs from "fs";
import path from "path";
import { ShoppingPlanData } from "@/data/mockData";
import { savePlanRecord } from "@/lib/plan-storage";
import { CURRENCY, ShoppingPlan } from "@/lib/types";
import { computePlanHash } from "@/lib/plan-hash";
import { PlanVersionRecord, ValidatedScenario } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const VERSIONS_FILE = path.join(DATA_DIR, "versions.json");

interface VersionStoreSchema {
  // Keyed by `${intentId.toLowerCase()}_v${version}`
  versionRecords: Record<string, PlanVersionRecord>;
  // Keyed by intentId -> sorted array of version numbers
  intentVersionIndex: Record<string, number[]>;
}

function ensureVersionStorage(): VersionStoreSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(VERSIONS_FILE)) {
    const initial: VersionStoreSchema = {
      versionRecords: {},
      intentVersionIndex: {},
    };
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  try {
    const raw = fs.readFileSync(VERSIONS_FILE, "utf8");
    return JSON.parse(raw) as VersionStoreSchema;
  } catch (err) {
    console.error("Failed to parse versions storage file, resetting store:", err);
    const initial: VersionStoreSchema = {
      versionRecords: {},
      intentVersionIndex: {},
    };
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function saveVersionStorage(store: VersionStoreSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Converts a rich ShoppingPlanData into a canonical Zod-compliant ShoppingPlan
 * with integer paise for Keccak-256 hashing and Base Sepolia verification.
 */
export function toCanonicalShoppingPlan(
  plan: ShoppingPlanData,
  version: number,
  expirySeconds: number = 7 * 86400
): ShoppingPlan {
  const budgetMinor = Math.round(plan.budget * 100);
  const items = (plan.items || []).map((item) => ({
    productId: item.id,
    quantity: Math.max(1, Math.round(item.quantity || 1)),
    unitPriceMinor: Math.round(item.unitPrice * 100),
  }));

  const totalMinor = items.reduce(
    (acc, curr) => acc + curr.quantity * curr.unitPriceMinor,
    0
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const expiry = (plan as any).expiry ?? (nowSec + expirySeconds);

  return {
    schemaVersion: "1.0.0",
    intentId: plan.id as `0x${string}`,
    version,
    currency: CURRENCY,
    budgetMinor,
    items,
    totalMinor,
    expiry,
  };
}

/**
 * Creates and stores an immutable PlanVersionRecord snapshot.
 * Never mutates existing records; assigns a new version number.
 */
export function recordPlanVersion(
  plan: ShoppingPlanData,
  options: {
    scenarioDescription: string;
    parentVersion: number | null;
    scenario?: ValidatedScenario;
    summaryOfChanges?: string;
    reasonsForChanges?: PlanVersionRecord["reasonsForChanges"];
    peopleCount?: number;
    durationDays?: number;
    targetVersion?: number;
  }
): PlanVersionRecord {
  const store = ensureVersionStorage();
  const normalizedId = plan.id.toLowerCase();

  const existingVersions = store.intentVersionIndex[normalizedId] || [];
  const assignedVersion =
    options.targetVersion !== undefined
      ? options.targetVersion
      : existingVersions.length > 0
      ? Math.max(...existingVersions) + 1
      : plan.version || 1;

  const key = `${normalizedId}_v${assignedVersion}`;

  // 1. Convert to canonical ShoppingPlan and compute cryptographic hash
  const canonicalPlan = toCanonicalShoppingPlan(plan, assignedVersion);
  (plan as any).expiry = canonicalPlan.expiry;
  const { canonicalString, planHash } = computePlanHash(canonicalPlan);

  // 2. Also register in core server plan storage (plans.json) for cross-compatibility
  savePlanRecord(canonicalPlan, canonicalString, planHash);

  const budgetOverrun = Math.max(0, plan.totalAmount - plan.budget);
  const remainingAmount = Math.max(0, plan.budget - plan.totalAmount);

  // 3. Construct immutable PlanVersionRecord
  const versionRecord: PlanVersionRecord = {
    intentId: normalizedId,
    version: assignedVersion,
    parentVersion: options.parentVersion,
    scenarioId: options.scenario?.scenarioId || `scen_${assignedVersion}_${Date.now()}`,
    scenarioDescription: options.scenarioDescription,
    scenario: options.scenario,
    plan: {
      ...plan,
      version: assignedVersion,
      planHash,
      budgetOverrun,
      remainingAmount,
    },
    shoppingPlan: canonicalPlan,
    planHash,
    canonicalString,
    createdAt: new Date().toISOString(),
    budget: plan.budget,
    totalAmount: plan.totalAmount,
    remainingAmount,
    budgetOverrun,
    peopleCount: options.peopleCount ?? 1,
    durationDays: options.durationDays ?? 3,
    summaryOfChanges: options.summaryOfChanges || `Version ${assignedVersion} created.`,
    reasonsForChanges: options.reasonsForChanges || [],
    onChainCommitment: {
      status: "uncommitted",
    },
  };

  store.versionRecords[key] = versionRecord;

  if (!store.intentVersionIndex[normalizedId]) {
    store.intentVersionIndex[normalizedId] = [];
  }
  if (!store.intentVersionIndex[normalizedId].includes(assignedVersion)) {
    store.intentVersionIndex[normalizedId].push(assignedVersion);
    store.intentVersionIndex[normalizedId].sort((a, b) => a - b);
  }

  saveVersionStorage(store);
  return versionRecord;
}

/**
 * Retrieves a specific version record for an intent.
 */
export function getPlanVersionRecord(
  intentId: string,
  version: number
): PlanVersionRecord | null {
  const store = ensureVersionStorage();
  const key = `${intentId.toLowerCase()}_v${version}`;
  return store.versionRecords[key] ?? null;
}

/**
 * Retrieves all versions for an intent in chronological order.
 */
export function getPlanVersionHistory(intentId: string): PlanVersionRecord[] {
  const store = ensureVersionStorage();
  const normalizedId = intentId.toLowerCase();
  const versions = store.intentVersionIndex[normalizedId] || [];

  return versions
    .map((v) => store.versionRecords[`${normalizedId}_v${v}`])
    .filter((r): r is PlanVersionRecord => Boolean(r));
}

/**
 * Updates on-chain commitment status for an exact plan version.
 */
export function updateVersionOnChainCommitment(
  intentId: string,
  version: number,
  commitment: {
    txHash: `0x${string}` | string;
    blockNumber: number;
    timestamp?: number;
    status: "uncommitted" | "pending" | "confirmed" | "failed";
  }
): boolean {
  const store = ensureVersionStorage();
  const key = `${intentId.toLowerCase()}_v${version}`;
  const record = store.versionRecords[key];
  if (!record) return false;

  record.onChainCommitment = {
    ...record.onChainCommitment,
    ...commitment,
    txHash: commitment.txHash as any,
  };

  saveVersionStorage(store);
  return true;
}
