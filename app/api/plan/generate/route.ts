import { NextResponse } from "next/server";
import { generateRealShoppingPlan } from "@/lib/planner-engine";
import {
  ScraperApiError,
  ScraperApiKeyMissingError,
  sanitizeErrorMessage,
} from "@/lib/scraperapi";
import { validateBudgetInr } from "@/lib/types";
import { createPlanJob } from "@/lib/plan-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body.",
          disclaimer: "Plan generation failed. Live execution will not silently fall back to mock data.",
        },
        { status: 400 }
      );
    }

    const { prompt, budget, location, preference, timeoutMs: customTimeoutMs } = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "A natural language situation 'prompt' is required.",
          disclaimer: "Plan generation failed. Live execution will not silently fall back to mock data.",
        },
        { status: 400 }
      );
    }

    const budgetValidation = validateBudgetInr(budget);
    if (!budgetValidation.valid || budgetValidation.budget === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: budgetValidation.error || "A positive rupee 'budget' amount is required.",
          disclaimer: "Plan generation failed. Live execution will not silently fall back to mock data.",
        },
        { status: 400 }
      );
    }

    const budgetNumber = budgetValidation.budget;

    // Check if asynchronous execution is requested (body.async or Prefer: respond-async)
    const preferHeader = req.headers.get("prefer") || "";
    const isAsyncRequested = body?.async === true || preferHeader.includes("respond-async");

    // In serverless environments (e.g. Vercel / AWS Lambda), background promises are frozen after 202 is returned
    // and subsequent polling requests hit separate isolated lambda instances without shared memory.
    // On Vercel (process.env.VERCEL is set), execute synchronously within maxDuration (60s)
    // so the live deployment generates plans with 100% reliability without losing jobs.
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (isAsyncRequested && !isServerless) {
      const job = createPlanJob({
        prompt: prompt.trim(),
        budget: budgetNumber,
        location,
        preference,
        timeoutMs: customTimeoutMs ? Number(customTimeoutMs) : 70000,
      });

      return NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: job.status,
          checkUrl: `/api/plan/jobs?id=${job.id}`,
          message: "Plan generation started in background.",
        },
        {
          status: 202,
          headers: {
            Location: `/api/plan/jobs?id=${job.id}`,
            "Retry-After": "2",
          },
        }
      );
    }

    // Synchronous execution path
    const effectiveTimeoutMs = customTimeoutMs ? Number(customTimeoutMs) : 25000;

    const plan = await generateRealShoppingPlan(prompt.trim(), budgetNumber, {
      location,
      preference,
      signal: req.signal,
      timeoutMs: effectiveTimeoutMs,
    });

    return NextResponse.json({
      success: true,
      plan,
      disclaimer:
        "Plan generated with real Amazon India products and prices via ScraperAPI. Prices are subject to change on Amazon.in and are not guaranteed at checkout.",
    });
  } catch (err: any) {
    if (req.signal?.aborted) {
      return NextResponse.json(
        {
          success: false,
          error: "Request was cancelled by client.",
          errorCode: "REQUEST_ABORTED",
          isRetryable: true,
          userFriendlyMessage: "Search was cancelled.",
        },
        { status: 499 }
      );
    }

    const rawMessage = err?.message || "Failed to generate shopping plan.";
    const message = sanitizeErrorMessage(rawMessage);

    let status = 500;
    if (err instanceof ScraperApiKeyMissingError) {
      status = 503;
    } else if (err instanceof ScraperApiError) {
      status = err.statusCode;
    } else if (typeof err?.statusCode === "number") {
      status = err.statusCode;
    } else if (message.includes("401") || message.toLowerCase().includes("unauthorized") || err?.name === "UnauthorizedError") {
      status = 401;
    } else if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
      status = 403;
    } else if (
      message.includes("429") ||
      message.toLowerCase().includes("rate limit") ||
      message.toLowerCase().includes("too many requests") ||
      message.toLowerCase().includes("resource_exhausted") ||
      err?.name === "AiQuotaExhaustedError"
    ) {
      status = 429;
    } else if (
      message.includes("504") ||
      message.toLowerCase().includes("timed out") ||
      message.toLowerCase().includes("timeout") ||
      message.includes("ETIMEDOUT")
    ) {
      status = 504;
    } else if (
      message.includes("502") ||
      message.toLowerCase().includes("fetch failed") ||
      message.toLowerCase().includes("network error")
    ) {
      status = 502;
    } else if (message.toLowerCase().includes("no products found")) {
      status = 404;
    } else if (message.toLowerCase().includes("available prices") || message.toLowerCase().includes("cannot compute budget")) {
      status = 422;
    }

    const isTimeout =
      status === 504 ||
      (err instanceof ScraperApiError && err.statusCode === 504) ||
      message.toLowerCase().includes("timed out") ||
      message.includes("ETIMEDOUT");
    const isRateLimit = status === 429;
    const isAiQuota = err?.name === "AiQuotaExhaustedError" || message.toLowerCase().includes("gemini ai");
    const isAuth = status === 401 || status === 403;
    const isConfig = status === 503 && err instanceof ScraperApiKeyMissingError;

    const errorCode =
      err?.errorCode ||
      (isTimeout
        ? "PROVIDER_TIMEOUT"
        : isAiQuota
        ? "AI_QUOTA_EXHAUSTED"
        : isRateLimit
        ? "RATE_LIMITED"
        : isConfig
        ? "SCRAPERAPI_KEY_MISSING"
        : isAuth
        ? "AUTHENTICATION_ERROR"
        : status === 404
        ? "NO_PRODUCTS_FOUND"
        : status === 422
        ? "UNPRICED_PRODUCTS"
        : status === 503
        ? "SERVICE_UNAVAILABLE"
        : status === 502
        ? "UPSTREAM_ERROR"
        : "SEARCH_FAILED");

    const isRetryable =
      err?.isRetryable !== undefined
        ? err.isRetryable
        : isTimeout || isRateLimit || status === 502 || (status === 503 && !isConfig);

    const userFriendlyMessage =
      err?.userFriendlyMessage ||
      (isTimeout
        ? "Live product search is taking longer than expected. Please retry."
        : isAiQuota
        ? "AI assistant is temporarily at free-tier capacity. Please retry shortly."
        : isRateLimit
        ? "Rate limit reached with product search. Please retry in a few seconds."
        : isConfig
        ? "Product search API key is not configured."
        : isAuth
        ? "Authentication failed with product search provider."
        : status === 404
        ? `No products found on Amazon India matching your request.`
        : message);

    return NextResponse.json(
      {
        success: false,
        error: message,
        details: err?.providerDetails || err?.cause?.message || undefined,
        errorCode,
        isRetryable,
        userFriendlyMessage,
        elapsedMs: err?.elapsedMs,
        disclaimer: "Plan generation failed. Live execution will not silently fall back to mock data.",
      },
      { status }
    );
  }
}
