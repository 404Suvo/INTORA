/**
 * BACKGROUND PLAN JOB MANAGER FOR ASYNCHRONOUS EXECUTION
 *
 * ScraperAPI recommends up to 70 seconds for complex or difficult requests.
 * Because standard serverless edge routes (e.g. Vercel Hobby, reverse proxies)
 * enforce hard 10s-15s connection limits and return 504 Gateway Timeout,
 * this job manager allows clients to start a plan generation task asynchronously (202 Accepted)
 * and poll for completion without blocking edge proxies or triggering 504 timeouts.
 */

import { generateRealShoppingPlan } from "./planner-engine";
import { ShoppingPlanData } from "@/data/mockData";
import { UserTradeOffPreference } from "./trade-off-engine";
import { sanitizeErrorMessage, ScraperApiError, ScraperApiKeyMissingError } from "./scraperapi";

export type PlanJobStatus = "pending" | "processing" | "completed" | "failed";

export interface PlanJobError {
  message: string;
  errorCode: string;
  statusCode: number;
  isRetryable: boolean;
  userFriendlyMessage: string;
  details?: any;
}

export interface PlanJob {
  id: string;
  prompt: string;
  budget: number;
  preference?: UserTradeOffPreference;
  location?: string;
  status: PlanJobStatus;
  progressMessage: string;
  plan?: ShoppingPlanData;
  error?: PlanJobError;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  elapsedMs: number;
}

// In-memory job store with TTL cleanup
const jobs = new Map<string, PlanJob>();
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour

function cleanupExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_RETENTION_MS) {
      jobs.delete(id);
    }
  }
}

/**
 * Creates and starts an asynchronous plan generation job.
 */
export function createPlanJob(params: {
  prompt: string;
  budget: number;
  preference?: UserTradeOffPreference;
  location?: string;
  timeoutMs?: number;
}): PlanJob {
  cleanupExpiredJobs();

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  const job: PlanJob = {
    id: jobId,
    prompt: params.prompt,
    budget: params.budget,
    preference: params.preference,
    location: params.location,
    status: "pending",
    progressMessage: "Job initialized. Preparing search...",
    createdAt: now,
    updatedAt: now,
    elapsedMs: 0,
  };

  jobs.set(jobId, job);

  // Launch async worker without blocking caller
  runJobWorker(jobId, params.timeoutMs || 70000).catch((err) => {
    console.error(`[PlanJob ${jobId}] Unhandled worker error:`, err);
  });

  return job;
}

/**
 * Retrieves the current state of a plan job.
 */
export function getPlanJob(jobId: string): PlanJob | undefined {
  const job = jobs.get(jobId);
  if (job) {
    job.elapsedMs = (job.completedAt || Date.now()) - job.createdAt;
  }
  return job;
}

/**
 * Lists active or recent plan jobs.
 */
export function listPlanJobs(): PlanJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Internal background execution worker.
 */
async function runJobWorker(jobId: string, timeoutMs: number): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.updatedAt = Date.now();
  job.progressMessage = "Searching Amazon India and optimizing shopping plan...";

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error(`Background job timed out after ${Math.round(timeoutMs / 1000)} seconds`));
  }, timeoutMs);

  try {
    const plan = await generateRealShoppingPlan(job.prompt, job.budget, {
      preference: job.preference,
      location: job.location,
      signal: abortController.signal,
      timeoutMs,
    });

    clearTimeout(timeoutId);

    job.status = "completed";
    job.plan = plan;
    job.completedAt = Date.now();
    job.updatedAt = Date.now();
    job.elapsedMs = job.completedAt - job.createdAt;
    job.progressMessage = "Plan generated successfully.";
  } catch (err: any) {
    clearTimeout(timeoutId);

    const rawMessage = err?.message || "Failed to generate shopping plan.";
    const message = sanitizeErrorMessage(rawMessage);

    let statusCode = 500;
    if (err instanceof ScraperApiKeyMissingError) {
      statusCode = 503;
    } else if (err instanceof ScraperApiError) {
      statusCode = err.statusCode;
    } else if (typeof err?.statusCode === "number") {
      statusCode = err.statusCode;
    } else if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      statusCode = 401;
    } else if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
      statusCode = 403;
    } else if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
      statusCode = 429;
    } else if (message.includes("504") || message.toLowerCase().includes("timed out") || message.includes("ETIMEDOUT")) {
      statusCode = 504;
    } else if (message.toLowerCase().includes("no products found")) {
      statusCode = 404;
    } else if (message.toLowerCase().includes("available prices") || message.toLowerCase().includes("cannot compute budget")) {
      statusCode = 422;
    }

    const isTimeout = statusCode === 504 || message.toLowerCase().includes("timed out") || message.includes("ETIMEDOUT");
    const isRateLimit = statusCode === 429;
    const isAuth = statusCode === 401 || statusCode === 403;

    const errorCode =
      err?.errorCode ||
      (isTimeout
        ? "PROVIDER_TIMEOUT"
        : isRateLimit
        ? "RATE_LIMITED"
        : isAuth
        ? "AUTHENTICATION_ERROR"
        : statusCode === 503
        ? "SERVICE_UNAVAILABLE"
        : statusCode === 404
        ? "NO_PRODUCTS_FOUND"
        : statusCode === 502
        ? "UPSTREAM_ERROR"
        : "SEARCH_FAILED");

    const isRetryable =
      err?.isRetryable !== undefined
        ? err.isRetryable
        : isTimeout || isRateLimit || statusCode === 502 || statusCode === 503;

    const userFriendlyMessage =
      err?.userFriendlyMessage ||
      (isTimeout
        ? "Live product search is taking longer than expected. Please retry."
        : isRateLimit
        ? "Product search rate limit reached. Please retry in a few moments."
        : isAuth
        ? "Authentication failed with product search provider."
        : statusCode === 404
        ? `No products found on Amazon India matching: "${job.prompt}".`
        : message);

    job.status = "failed";
    job.completedAt = Date.now();
    job.updatedAt = Date.now();
    job.elapsedMs = job.completedAt - job.createdAt;
    job.progressMessage = `Failed: ${userFriendlyMessage}`;
    job.error = {
      message,
      errorCode,
      statusCode,
      isRetryable,
      userFriendlyMessage,
      details: err?.providerDetails || err?.cause?.message || undefined,
    };
  }
}
