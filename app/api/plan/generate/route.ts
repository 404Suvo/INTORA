import { NextResponse } from "next/server";
import { generateRealShoppingPlan } from "@/lib/planner-engine";
import {
  ScraperApiError,
  ScraperApiKeyMissingError,
  sanitizeErrorMessage,
} from "@/lib/scraperapi";
import { validateBudgetInr } from "@/lib/types";

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

    const { prompt, budget, location, preference } = body || {};

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

    const plan = await generateRealShoppingPlan(prompt.trim(), budgetNumber, {
      location,
      preference,
      signal: req.signal,
    });

    return NextResponse.json({
      success: true,
      plan,
      disclaimer:
        "Plan generated with real Amazon India products and prices via ScraperAPI. Prices are subject to change on Amazon.in and are not guaranteed at checkout.",
    });
  } catch (err: any) {
    const rawMessage = err?.message || "Failed to generate shopping plan.";
    const message = sanitizeErrorMessage(rawMessage);

    let status = 500;
    if (err instanceof ScraperApiKeyMissingError) {
      status = 503;
    } else if (err instanceof ScraperApiError) {
      status = err.statusCode;
    } else if (typeof err?.statusCode === "number") {
      status = err.statusCode;
    } else if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      status = 401;
    } else if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
      status = 403;
    } else if (message.includes("429") || message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("too many requests")) {
      status = 429;
    } else if (message.includes("504") || message.toLowerCase().includes("timed out") || message.toLowerCase().includes("timeout")) {
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
    const isAuth = status === 401 || status === 403;

    const errorCode =
      err?.errorCode ||
      (isTimeout
        ? "PROVIDER_TIMEOUT"
        : isRateLimit
        ? "RATE_LIMITED"
        : isAuth
        ? "AUTHENTICATION_ERROR"
        : status === 503
        ? "SERVICE_UNAVAILABLE"
        : status === 502
        ? "UPSTREAM_ERROR"
        : "SEARCH_FAILED");

    const isRetryable =
      err?.isRetryable !== undefined
        ? err.isRetryable
        : isTimeout || isRateLimit || status === 502 || status === 503;

    const userFriendlyMessage =
      err?.userFriendlyMessage ||
      (isTimeout
        ? "Live product search is taking too long. Please retry."
        : isRateLimit
        ? "Rate limit reached with product search. Please retry in a few seconds."
        : isAuth
        ? "Authentication failed with product search provider."
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
