import { keccak256, stringToHex, toHex } from "viem";

/**
 * Generates an intentId client-side as keccak256 of a random UUID.
 * Returns a 32-byte hex string (0x + 64 hex characters).
 */
export function generateIntentId(): `0x${string}` {
  const uuid = crypto.randomUUID();
  return keccak256(stringToHex(uuid));
}

/**
 * Generates a random 32-byte salt for optional privacy masking.
 */
export function generateSalt(): `0x${string}` {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return toHex(randomBytes);
}

/**
 * Checks whether privacy salting is enabled via environment variables.
 * Default is false.
 */
export function isSaltingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SALT === "true" || process.env.ENABLE_SALT === "true";
}
