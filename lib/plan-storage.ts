import fs from "fs";
import path from "path";
import os from "os";
import { ShoppingPlan, StoredPlanRecord } from "./types";

/**
 * Storage architecture note:
 * On-chain commitments store only (intentId, version) => (planHash, expiry, owner).
 * Storing hashes on-chain DOES NOT make off-chain plan data publicly accessible or retrievable.
 * This server-side repository stores the full canonical plan payloads and versions, allowing
 * the user or verifying parties to reproduce and verify the exact on-chain hash.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const PLANS_FILE = path.join(DATA_DIR, "plans.json");
const TMP_DATA_DIR = path.join(os.tmpdir(), "intora-data");
const TMP_PLANS_FILE = path.join(TMP_DATA_DIR, "plans.json");

interface StorageSchema {
  // Keyed by `${intentId.toLowerCase()}_v${version}`
  plans: Record<string, StoredPlanRecord>;
  // Keyed by intentId -> array of versions
  intentVersions: Record<string, number[]>;
}

function getGlobalStore(): StorageSchema {
  if (!(globalThis as any).__INTORA_PLANS_STORE__) {
    (globalThis as any).__INTORA_PLANS_STORE__ = { plans: {}, intentVersions: {} };
  }
  return (globalThis as any).__INTORA_PLANS_STORE__;
}

function ensureStorage(): StorageSchema {
  const memStore = getGlobalStore();

  // Try reading from primary PLANS_FILE
  try {
    if (fs.existsSync(PLANS_FILE)) {
      const raw = fs.readFileSync(PLANS_FILE, "utf8");
      const parsed = JSON.parse(raw) as StorageSchema;
      Object.assign(memStore.plans, parsed.plans);
      Object.assign(memStore.intentVersions, parsed.intentVersions);
      return memStore;
    }
  } catch (err: any) {
    // Read failure from primary; continue to check fallback
  }

  // Try reading from TMP_PLANS_FILE
  try {
    if (fs.existsSync(TMP_PLANS_FILE)) {
      const raw = fs.readFileSync(TMP_PLANS_FILE, "utf8");
      const parsed = JSON.parse(raw) as StorageSchema;
      Object.assign(memStore.plans, parsed.plans);
      Object.assign(memStore.intentVersions, parsed.intentVersions);
      return memStore;
    }
  } catch {
    // Continue with in-memory store
  }

  // Attempt to initialize primary file if possible
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PLANS_FILE)) {
      fs.writeFileSync(PLANS_FILE, JSON.stringify(memStore, null, 2), "utf8");
    }
  } catch {
    // Filesystem may be read-only (e.g. Vercel /var/task); try TMP_DATA_DIR
    try {
      if (!fs.existsSync(TMP_DATA_DIR)) {
        fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(TMP_PLANS_FILE)) {
        fs.writeFileSync(TMP_PLANS_FILE, JSON.stringify(memStore, null, 2), "utf8");
      }
    } catch {
      // Memory store remains authoritative
    }
  }

  return memStore;
}

function saveStorage(data: StorageSchema): void {
  // Always update in-memory global store first
  const memStore = getGlobalStore();
  Object.assign(memStore.plans, data.plans);
  Object.assign(memStore.intentVersions, data.intentVersions);

  // Attempt write to primary PLANS_FILE
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PLANS_FILE, JSON.stringify(data, null, 2), "utf8");
    return;
  } catch (err: any) {
    // If read-only filesystem (e.g. EROFS on Vercel), fallback to os.tmpdir()
  }

  try {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TMP_PLANS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (tmpErr) {
    console.warn("[PlanStorage] Read-only filesystem detected; retained plans in memory.", tmpErr);
  }
}

export function savePlanRecord(
  plan: ShoppingPlan,
  canonicalString: string,
  planHash: `0x${string}`
): StoredPlanRecord {
  const store = ensureStorage();
  const normalizedIntentId = plan.intentId.toLowerCase();
  const key = `${normalizedIntentId}_v${plan.version}`;

  const record: StoredPlanRecord = {
    intentId: normalizedIntentId as `0x${string}`,
    version: plan.version,
    plan,
    canonicalString,
    planHash: planHash.toLowerCase() as `0x${string}`,
    createdAt: new Date().toISOString(),
    onChainCommitment: {
      status: "uncommitted",
    },
  };

  store.plans[key] = record;

  if (!store.intentVersions[normalizedIntentId]) {
    store.intentVersions[normalizedIntentId] = [];
  }
  if (!store.intentVersions[normalizedIntentId].includes(plan.version)) {
    store.intentVersions[normalizedIntentId].push(plan.version);
    store.intentVersions[normalizedIntentId].sort((a, b) => a - b);
  }

  saveStorage(store);
  return record;
}

export function getPlanRecord(intentId: string, version: number): StoredPlanRecord | null {
  const store = ensureStorage();
  const key = `${intentId.toLowerCase()}_v${version}`;
  return store.plans[key] ?? null;
}

export function getLatestPlanRecord(intentId: string): StoredPlanRecord | null {
  const store = ensureStorage();
  const normalized = intentId.toLowerCase();
  const versions = store.intentVersions[normalized];
  if (!versions || versions.length === 0) return null;

  const latestVersion = versions[versions.length - 1];
  return getPlanRecord(normalized, latestVersion);
}

export function getAllPlanVersions(intentId: string): StoredPlanRecord[] {
  const store = ensureStorage();
  const normalized = intentId.toLowerCase();
  const versions = store.intentVersions[normalized] || [];

  return versions
    .map((v) => store.plans[`${normalized}_v${v}`])
    .filter((record): record is StoredPlanRecord => Boolean(record));
}

export function updateOnChainStatus(
  intentId: string,
  version: number,
  commitment: {
    txHash?: `0x${string}`;
    blockNumber?: number;
    timestamp?: number;
    status: "uncommitted" | "pending" | "confirmed" | "failed";
  }
): boolean {
  const store = ensureStorage();
  const key = `${intentId.toLowerCase()}_v${version}`;
  if (!store.plans[key]) return false;

  store.plans[key].onChainCommitment = {
    ...store.plans[key].onChainCommitment,
    ...commitment,
  };
  saveStorage(store);
  return true;
}

export function listAllStoredIntents(): { intentId: string; latestVersion: number; updatedAt: string }[] {
  const store = ensureStorage();
  return Object.keys(store.intentVersions).map((id) => {
    const versions = store.intentVersions[id];
    const latestVersion = versions[versions.length - 1];
    const rec = store.plans[`${id}_v${latestVersion}`];
    return {
      intentId: id,
      latestVersion,
      updatedAt: rec ? rec.createdAt : new Date().toISOString(),
    };
  });
}
