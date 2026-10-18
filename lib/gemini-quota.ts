/**
 * CENTRALIZED GEMINI QUOTA & RATE LIMIT CIRCUIT BREAKER
 *
 * Tracks 429 RESOURCE_EXHAUSTED and daily free-tier limit status across the entire application.
 * Parses provider retry delays (e.g. RetryInfo.retryDelay, "Please retry in X" text),
 * prevents wasteful looping across alternative models on the same project quota,
 * and enables graceful fallback to validated deterministic parsers.
 */

import { sanitizeErrorMessage } from "./scraperapi";

export interface GeminiQuotaState {
  isExhausted: boolean;
  cooldownUntil: number;
  remainingSeconds: number;
  reason?: string;
  metric?: string;
}

let geminiQuotaCooldownUntil = 0;
let geminiExhaustionReason: string | undefined = undefined;
let geminiExhaustionMetric: string | undefined = undefined;

/**
 * Extracts retry delay in seconds from diverse Gemini 429 error structures:
 * - RPC details: RetryInfo { retryDelay: "15077s" }
 * - Message: "Please retry in 4h11m17.779979091s" or "Please retry in 15000s"
 * - Headers: retry-after
 */
export function parseGeminiRetryDelay(err: any): number | undefined {
  if (!err) return undefined;

  // 1. Check RPC details RetryInfo
  const details = err?.error?.details || err?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d?.retryDelay) {
        const str = String(d.retryDelay);
        const secMatch = str.match(/([0-9]+(?:\.[0-9]+)?)\s*s/i);
        if (secMatch) {
          const parsed = parseFloat(secMatch[1]);
          if (!isNaN(parsed) && parsed > 0) return Math.ceil(parsed);
        }
      }
    }
  }

  // 2. Check retry-after header
  const retryAfterHeader = err?.headers?.get?.("retry-after") || err?.response?.headers?.get?.("retry-after");
  if (retryAfterHeader) {
    const sec = parseInt(retryAfterHeader, 10);
    if (!isNaN(sec) && sec > 0) return sec;
  }

  // 3. Parse human-readable message, e.g. "Please retry in 4h11m17s" or "Please retry in 300s"
  const msg = String(err?.message || err?.error?.message || "");
  const timeMatch = msg.match(/retry in\s*(?:([0-9]+)\s*h)?\s*(?:([0-9]+)\s*m)?\s*(?:([0-9]+(?:\.[0-9]+)?)\s*s)?/i);
  if (timeMatch && (timeMatch[1] || timeMatch[2] || timeMatch[3])) {
    const hours = parseInt(timeMatch[1] || "0", 10);
    const mins = parseInt(timeMatch[2] || "0", 10);
    const secs = parseFloat(timeMatch[3] || "0");
    const totalSecs = hours * 3600 + mins * 60 + secs;
    if (totalSecs > 0) return Math.ceil(totalSecs);
  }

  return undefined;
}

/**
 * Records that Gemini daily or per-minute quota has been exhausted.
 * Activates circuit breaker so downstream calls do not trigger repeated 429 requests.
 */
export function recordGeminiQuotaExhaustion(errOrDelay?: any): void {
  let delaySeconds = 3600; // Default 1 hour for daily quota exhaustion

  if (typeof errOrDelay === "number" && errOrDelay > 0) {
    delaySeconds = errOrDelay;
  } else if (typeof errOrDelay === "string") {
    const parsed = parseInt(errOrDelay, 10);
    if (!isNaN(parsed) && parsed > 0) delaySeconds = parsed;
  } else if (errOrDelay) {
    const extracted = parseGeminiRetryDelay(errOrDelay);
    if (extracted && extracted > 0) {
      delaySeconds = extracted;
    }
    const msg = String(errOrDelay?.message || errOrDelay?.error?.message || "");
    if (msg.includes("generativelanguage.googleapis.com/generate_content_free_tier_requests")) {
      geminiExhaustionMetric = "generate_content_free_tier_requests";
    }
    geminiExhaustionReason = sanitizeErrorMessage(msg.slice(0, 200));
  }

  // Cap cooldown to minimum 15 minutes, maximum 24 hours
  const safeSeconds = Math.max(900, Math.min(86400, delaySeconds));
  geminiQuotaCooldownUntil = Date.now() + safeSeconds * 1000;

  console.warn(
    `[Gemini Quota] Circuit breaker active for ${safeSeconds}s (${(safeSeconds / 60).toFixed(1)} mins) due to 429 RESOURCE_EXHAUSTED.`
  );
}

/**
 * Checks whether the Gemini API circuit breaker is currently active.
 */
export function isGeminiQuotaExhausted(): boolean {
  if (Date.now() < geminiQuotaCooldownUntil) {
    return true;
  }
  return false;
}

/**
 * Returns full status information for UI/diagnostics.
 */
export function getGeminiQuotaStatus(): GeminiQuotaState {
  const isExhausted = Date.now() < geminiQuotaCooldownUntil;
  const remainingSeconds = isExhausted ? Math.ceil((geminiQuotaCooldownUntil - Date.now()) / 1000) : 0;
  return {
    isExhausted,
    cooldownUntil: geminiQuotaCooldownUntil,
    remainingSeconds,
    reason: isExhausted ? geminiExhaustionReason : undefined,
    metric: isExhausted ? geminiExhaustionMetric : undefined,
  };
}

/**
 * Manually resets the quota status (e.g. for testing or after key update).
 */
export function resetGeminiQuotaStatus(): void {
  geminiQuotaCooldownUntil = 0;
  geminiExhaustionReason = undefined;
  geminiExhaustionMetric = undefined;
}

/**
 * Creates a structured error for tasks that strictly require Gemini when quota is exhausted.
 */
export function createAiQuotaError(taskName = "This task"): Error & {
  statusCode: number;
  errorCode: string;
  isRetryable: boolean;
  userFriendlyMessage: string;
  retryAfterSeconds: number;
} {
  const status = getGeminiQuotaStatus();
  const mins = Math.ceil(status.remainingSeconds / 60);
  const msg = `${taskName} requires Gemini AI, but the free-tier API quota is currently exhausted. Please retry in approximately ${mins} minutes.`;
  const err = new Error(msg) as any;
  err.name = "AiQuotaExhaustedError";
  err.statusCode = 429;
  err.errorCode = "AI_QUOTA_EXHAUSTED";
  err.isRetryable = false;
  err.userFriendlyMessage = msg;
  err.retryAfterSeconds = status.remainingSeconds;
  return err;
}

/**
 * Checks if a Gemini error is a 429 quota exhaustion or resource exhausted event.
 */
export function isGeminiQuotaError(err: any): boolean {
  if (!err) return false;
  const status =
    err.status ||
    err.statusCode ||
    (typeof err.code === "number" ? err.code : undefined) ||
    err?.error?.code;

  if (status === 429) return true;

  const msg = (err.message || err?.error?.message || String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota exceeded") ||
    msg.includes("free_tier_requests") ||
    msg.includes("generaterequestsperday")
  );
}

/**
 * Determines whether a Gemini API error is transient (eligible for short retry)
 * such as 503 UNAVAILABLE or network timeout, excluding 429 quota exhaustion.
 */
export function isTransientGeminiError(err: any): boolean {
  if (!err) return false;
  const status =
    err.status ||
    err.statusCode ||
    (typeof err.code === "number" ? err.code : undefined) ||
    err?.error?.code;

  // 429 Quota exhaustion should trip the circuit breaker, not loop retrying immediately
  if (status === 429) return false;

  if (status === 503 || status === 500 || status === 502 || status === 504) {
    return true;
  }

  // Permanent client errors must NOT be retried
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }

  const msg = (err.message || err?.error?.message || String(err)).toLowerCase();
  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("api_key not valid") ||
    msg.includes("api key not valid") ||
    msg.includes("permission_denied") ||
    msg.includes("invalid_argument") ||
    msg.includes("resource_exhausted") ||
    msg.includes("429")
  ) {
    return false;
  }

  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("network")
  );
}

