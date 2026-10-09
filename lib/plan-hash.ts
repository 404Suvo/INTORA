import { keccak256, stringToHex, type Hex } from "viem";
import { canonicalizePlan } from "./canonicalize";
import { ShoppingPlan } from "./types";

/**
 * Computes the keccak256 cryptographic hash of a ShoppingPlan
 * by first producing its canonical representation.
 * Returns both the exact canonical string and the resulting 32-byte hash.
 */
export function computePlanHash(plan: ShoppingPlan): {
  canonicalString: string;
  planHash: `0x${string}`;
} {
  const canonicalString = canonicalizePlan(plan);
  const hexEncoded = stringToHex(canonicalString);
  const planHash = keccak256(hexEncoded);
  return { canonicalString, planHash };
}

/**
 * Computes hash directly from an existing canonical string.
 * Hard Rule: Once computed and stored, this stored canonical string must be reused
 * for verification rather than re-derived.
 */
export function hashCanonicalString(canonicalString: string): `0x${string}` {
  return keccak256(stringToHex(canonicalString));
}

/**
 * Verifies that a stored canonical string reproduces the exact expected hash.
 */
export function verifyPlanHash(canonicalString: string, expectedHash: string): boolean {
  if (!canonicalString || !expectedHash) return false;
  const computed = hashCanonicalString(canonicalString);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}
