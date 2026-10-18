import { NextResponse } from "next/server";
import { createPlanJob, getPlanJob, listPlanJobs } from "@/lib/plan-jobs";
import { validateBudgetInr } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/plan/jobs?id=job_...
 * Polls the status of an asynchronous plan generation job.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("id");

  if (!jobId) {
    const allJobs = listPlanJobs().map((j) => ({
      id: j.id,
      prompt: j.prompt,
      budget: j.budget,
      status: j.status,
      elapsedMs: j.elapsedMs,
      createdAt: j.createdAt,
    }));
    return NextResponse.json({ jobs: allJobs });
  }

  const job = getPlanJob(jobId);
  if (!job) {
    return NextResponse.json(
      {
        success: false,
        error: `Job '${jobId}' not found or expired.`,
        errorCode: "JOB_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  if (job.status === "completed") {
    return NextResponse.json({
      success: true,
      status: "completed",
      jobId: job.id,
      plan: job.plan,
      elapsedMs: job.elapsedMs,
      disclaimer:
        "Plan generated with real Amazon India products and prices via ScraperAPI. Prices are subject to change on Amazon.in and are not guaranteed at checkout.",
    });
  }

  if (job.status === "failed") {
    const errorDetails = job.error || {
      message: "Plan generation failed.",
      errorCode: "SEARCH_FAILED",
      statusCode: 500,
      isRetryable: true,
      userFriendlyMessage: "Plan generation failed.",
    };

    return NextResponse.json(
      {
        success: false,
        status: "failed",
        jobId: job.id,
        error: errorDetails.message,
        errorCode: errorDetails.errorCode,
        statusCode: errorDetails.statusCode,
        isRetryable: errorDetails.isRetryable,
        userFriendlyMessage: errorDetails.userFriendlyMessage,
        details: errorDetails.details,
        elapsedMs: job.elapsedMs,
        disclaimer: "Plan generation failed. Live execution will not silently fall back to mock data.",
      },
      { status: errorDetails.statusCode || 500 }
    );
  }

  // Pending or processing: return 200 with Retry-After header
  return NextResponse.json(
    {
      success: true,
      status: job.status,
      jobId: job.id,
      progressMessage: job.progressMessage,
      elapsedMs: job.elapsedMs,
      checkUrl: `/api/plan/jobs?id=${job.id}`,
    },
    {
      status: 200,
      headers: {
        "Retry-After": "2",
      },
    }
  );
}

/**
 * POST /api/plan/jobs
 * Initiates an asynchronous plan generation job.
 */
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
        },
        { status: 400 }
      );
    }

    const { prompt, budget, location, preference, timeoutMs } = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "A natural language situation 'prompt' is required.",
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
        },
        { status: 400 }
      );
    }

    const job = createPlanJob({
      prompt: prompt.trim(),
      budget: budgetValidation.budget,
      location,
      preference,
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
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
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to create plan job.",
      },
      { status: 500 }
    );
  }
}
