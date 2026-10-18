import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { POST as generatePOST } from "../app/api/plan/generate/route";
import { GET as jobsGET, POST as jobsPOST } from "../app/api/plan/jobs/route";
import {
  searchAmazonIndia,
  ScraperApiError,
  ScraperApiKeyMissingError,
  clearScraperApiCache,
} from "../lib/scraperapi";
import {
  isGeminiQuotaExhausted,
  recordGeminiQuotaExhaustion,
  resetGeminiQuotaStatus,
  parseGeminiRetryDelay,
  getGeminiQuotaStatus,
  createAiQuotaError,
} from "../lib/gemini-quota";
import {
  interpretBudgetIntent,
  parseBudgetIntentDeterministically,
  isHighConfidenceDeterministicIntent,
  clearBudgetIntentCache,
} from "../lib/budget-intent";
import {
  extractAmazonSearchQueries,
  deriveDeterministicSearchQueries,
  clearQueryExtractionCache,
  generateRealShoppingPlan,
} from "../lib/planner-engine";
import { createPlanJob, getPlanJob } from "../lib/plan-jobs";
import { generatePlan } from "../lib/stubs";

describe("ScraperAPI Timeouts & Provider Failures (Issue A)", { concurrency: 1 }, () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SCRAPERAPI_KEY;

  beforeEach(() => {
    clearScraperApiCache();
    clearQueryExtractionCache();
    clearBudgetIntentCache();
    resetGeminiQuotaStatus();
    process.env.SCRAPERAPI_KEY = "test_scraperapi_key_valid";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey !== undefined) {
      process.env.SCRAPERAPI_KEY = originalKey;
    } else {
      delete process.env.SCRAPERAPI_KEY;
    }
    clearScraperApiCache();
    clearQueryExtractionCache();
    clearBudgetIntentCache();
    resetGeminiQuotaStatus();
  });

  it("handles ScraperAPI timeout (504 / ETIMEDOUT) with distinct status and error code", async () => {
    (globalThis as any).fetch = async (url: string, init?: any) => {
      // Simulate slow response that triggers abort signal
      if (init?.signal) {
        return new Promise((_, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("fetch aborted"));
          }, 300);
          init.signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            const abortErr = new Error("This operation was aborted");
            abortErr.name = "AbortError";
            reject(abortErr);
          });
        });
      }
      throw new Error("No signal provided");
    };

    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Mehendi outfit", budget: 3000, timeoutMs: 200 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 504);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, "PROVIDER_TIMEOUT");
    assert.strictEqual(body.isRetryable, true);
    assert.ok(body.error.includes("timed out") || body.error.includes("ETIMEDOUT"));
  });

  it("handles HTTP 429 rate limiting with distinct status code and retryable flag", async () => {
    (globalThis as any).fetch = async () => {
      return new Response(
        JSON.stringify({ message: "API rate limit reached. Concurrency limit exceeded." }),
        {
          status: 429,
          headers: { "Retry-After": "3", "Content-Type": "application/json" },
        }
      );
    };

    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "wireless earbuds", budget: 2000 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 429);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, "RATE_LIMITED");
    assert.strictEqual(body.isRetryable, true);
  });

  it("handles 502 / upstream failures with bounded retries and distinct error code", async () => {
    let callCount = 0;
    (globalThis as any).fetch = async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes("scraperapi.com")) {
        callCount++;
      }
      return new Response(
        JSON.stringify({ error: "Bad Gateway - ScraperAPI proxy connection failure" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    };

    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "backpack", budget: 1500, timeoutMs: 1500 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 502);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, "UPSTREAM_ERROR");
    assert.strictEqual(body.isRetryable, true);
    // Bounded retries: should not loop endlessly
    assert.ok(callCount <= 3);
  });

  it("handles 401 authentication failure immediately without retrying", async () => {
    let callCount = 0;
    (globalThis as any).fetch = async () => {
      callCount++;
      return new Response(
        JSON.stringify({ error: "Unauthorized. Invalid ScraperAPI API key." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    };

    // Verify searchAmazonIndia throws ScraperApiError 401 and does NOT retry
    await assert.rejects(
      async () => {
        await searchAmazonIndia("travel adapter");
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.errorCode, "AUTHENTICATION_ERROR");
        assert.strictEqual(err.isRetryable, false);
        return true;
      }
    );
    // Crucial: 401 must NEVER be retried
    assert.strictEqual(callCount, 1);

    // Verify POST /api/plan/generate maps 401 cleanly
    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "laptop", budget: 50000 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 401);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, "AUTHENTICATION_ERROR");
    assert.strictEqual(body.isRetryable, false);
  });

  it("returns 404 NO_PRODUCTS_FOUND on empty results and NEVER fabricates products", async () => {
    (globalThis as any).fetch = async () => {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "xyznonexistentproductquery123", budget: 5000 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, "NO_PRODUCTS_FOUND");
    assert.strictEqual(body.isRetryable, false);
    assert.strictEqual(body.plan, undefined);
  });

  it("returns 503 SCRAPERAPI_KEY_MISSING when API key is unconfigured", async () => {
    delete process.env.SCRAPERAPI_KEY;

    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "laptop", budget: 50000 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 503);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, "SCRAPERAPI_KEY_MISSING");
  });

  it("preserves valid partial results when one query succeeds and another fails", async () => {
    let callIndex = 0;
    (globalThis as any).fetch = async (url: string) => {
      callIndex++;
      if (url.includes("query=fresh+rose")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                asin: "B0ROSEPART01",
                name: "Fresh Red Roses Bouquet Special",
                price: 899,
                price_string: "₹899.00",
                stars: 4.5,
                total_reviews: 350,
                url: "https://www.amazon.in/dp/B0ROSEPART01",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // Second query times out
      return new Response(JSON.stringify({ error: "Gateway Timeout" }), { status: 504 });
    };

    const plan = await generateRealShoppingPlan("fresh roses and greeting card", 2000, {
      skipGemini: true,
      timeoutMs: 1500,
    });

    assert.ok(plan);
    assert.strictEqual(plan.items.length, 1);
    assert.strictEqual(plan.items[0].asin, "B0ROSEPART01");
    assert.strictEqual(plan.items[0].unitPrice, 899);
  });
});

describe("Asynchronous Background Plan Job Architecture (Issue A)", { concurrency: 1 }, () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SCRAPERAPI_KEY;

  beforeEach(() => {
    process.env.SCRAPERAPI_KEY = "test_scraperapi_key_valid";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey !== undefined) {
      process.env.SCRAPERAPI_KEY = originalKey;
    } else {
      delete process.env.SCRAPERAPI_KEY;
    }
  });

  it("delegates to background job when async=true, returning 202 Accepted", async () => {
    (globalThis as any).fetch = async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              asin: "B0ASYNC001",
              name: "Async Generated Amazon Item",
              price: 1999,
              price_string: "₹1,999.00",
              stars: 4.6,
              total_reviews: 400,
              url: "https://www.amazon.in/dp/B0ASYNC001",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "college fest supplies", budget: 5000, async: true }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 202);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.jobId.startsWith("job_"));
    assert.ok(data.checkUrl.includes(data.jobId));

    // Poll the job endpoint
    const pollReq = new Request(`http://localhost:3000${data.checkUrl}`);
    // Wait briefly for worker execution
    await new Promise((r) => setTimeout(r, 100));

    const pollRes = await jobsGET(pollReq);
    assert.strictEqual(pollRes.status, 200);
    const pollData = await pollRes.json();
    assert.ok(["pending", "processing", "completed"].includes(pollData.status));
  });

  it("supports direct job creation via POST /api/plan/jobs", async () => {
    const req = new Request("http://localhost:3000/api/plan/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "wireless headphones", budget: 3000 }),
    });

    const res = await jobsPOST(req);
    assert.strictEqual(res.status, 202);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.jobId);
    assert.ok(data.checkUrl);
  });
});

describe("Gemini Quota Exhaustion & Deterministic Parsing (Issue B)", { concurrency: 1 }, () => {
  beforeEach(() => {
    resetGeminiQuotaStatus();
    clearBudgetIntentCache();
    clearQueryExtractionCache();
  });

  afterEach(() => {
    resetGeminiQuotaStatus();
    clearBudgetIntentCache();
    clearQueryExtractionCache();
  });

  it("parses retryDelay correctly from RPC details, headers, and error messages", () => {
    // 1. RPC details array with retryDelay string
    const rpcErr = {
      status: 429,
      error: {
        code: 429,
        message: "Resource has been exhausted",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            retryDelay: "15077s",
          },
        ],
      },
    };
    assert.strictEqual(parseGeminiRetryDelay(rpcErr), 15077);

    // 2. Retry-After header
    const headerErr = {
      status: 429,
      headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "3600" : null) },
    };
    assert.strictEqual(parseGeminiRetryDelay(headerErr), 3600);

    // 3. Human readable message with hours, mins, secs
    const msgErr = {
      message: "Quota exceeded: Please retry in 4h11m17.779s.",
    };
    assert.strictEqual(parseGeminiRetryDelay(msgErr), 4 * 3600 + 11 * 60 + 18);
  });

  it("activates circuit breaker on recordGeminiQuotaExhaustion and prevents redundant calls", () => {
    assert.strictEqual(isGeminiQuotaExhausted(), false);

    recordGeminiQuotaExhaustion({
      status: 429,
      message: "429 RESOURCE_EXHAUSTED: Free tier requests per day exceeded.",
    });

    assert.strictEqual(isGeminiQuotaExhausted(), true);
    const status = getGeminiQuotaStatus();
    assert.strictEqual(status.isExhausted, true);
    assert.ok(status.remainingSeconds > 0);

    // createAiQuotaError generates structured error
    const quotaErr = createAiQuotaError("Test Task");
    assert.strictEqual(quotaErr.statusCode, 429);
    assert.strictEqual(quotaErr.errorCode, "AI_QUOTA_EXHAUSTED");
    assert.strictEqual(quotaErr.isRetryable, false);
    assert.ok(quotaErr.userFriendlyMessage.includes("free-tier API quota is currently exhausted"));
  });

  it("distinguishes product-level targeting from basket caps without calling Gemini", async () => {
    // Case 1: "Laptop around ₹1 lakh" -> single_product_target
    const singleIntent = await interpretBudgetIntent("Laptop around ₹1 lakh", 100000, { skipGemini: true });
    assert.strictEqual(singleIntent.budgetMode, "single_product_target");
    assert.strictEqual(singleIntent.targetPrice, 100000);
    assert.strictEqual(singleIntent.targetProduct, "laptop");
    assert.strictEqual(singleIntent.mustHaveAccessories, false);
    // Tolerance should bracket ₹1,00,000 (approx ₹85,000 to ₹1,10,000)
    assert.ok(singleIntent.priceTolerance.minPrice <= 90000);
    assert.ok(singleIntent.priceTolerance.maxPrice >= 105000);

    // Case 2: "Laptop and accessories within ₹1 lakh" -> total_basket_cap
    const basketIntent = await interpretBudgetIntent("Laptop and accessories within ₹1 lakh", 100000, { skipGemini: true });
    assert.strictEqual(basketIntent.budgetMode, "total_basket_cap");
    assert.strictEqual(basketIntent.targetPrice, 100000);
    assert.strictEqual(basketIntent.mustHaveAccessories, true);
  });

  it("parses diverse Indian rupee formats deterministically (lakh, lac, k, commas)", () => {
    const intent1 = parseBudgetIntentDeterministically("Laptop around ₹1.5 lakh", 150000);
    assert.strictEqual(intent1.targetPrice, 150000);
    assert.strictEqual(intent1.budgetMode, "single_product_target");

    const intent2 = parseBudgetIntentDeterministically("Gaming PC around 2 lakhs", 200000);
    assert.strictEqual(intent2.targetPrice, 200000);

    const intent3 = parseBudgetIntentDeterministically("Smartwatch around 50k", 50000);
    assert.strictEqual(intent3.targetPrice, 50000);

    const intent4 = parseBudgetIntentDeterministically("Phone under ₹1,20,000", 120000);
    assert.strictEqual(intent4.maximumPrice, 120000);
    assert.strictEqual(intent4.budgetMode, "single_product_max");
  });

  it("detects high-confidence deterministic intents and avoids calling Gemini", () => {
    assert.strictEqual(isHighConfidenceDeterministicIntent("Laptop around ₹1 lakh"), true);
    assert.strictEqual(isHighConfidenceDeterministicIntent("Laptop and accessories within ₹1 lakh"), true);
    assert.strictEqual(isHighConfidenceDeterministicIntent("Mobile under 25000"), true);
    assert.strictEqual(isHighConfidenceDeterministicIntent("earbuds under ₹2,000"), true);
  });

  it("deduplicates redundant search queries deterministically", () => {
    // For single product, uses exact targeted product
    const queries = deriveDeterministicSearchQueries("Mehendi outfit");
    assert.ok(queries.length > 0);
    // Should NOT generate generic "mehendi" alongside "mehendi outfit"
    assert.strictEqual(queries.some((q) => q === "mehendi" && queries.includes("mehendi outfit")), false);
  });
});

describe("Combined Failures: Gemini 429 Quota Exhaustion + ScraperAPI Execution", { concurrency: 1 }, () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SCRAPERAPI_KEY;

  beforeEach(() => {
    clearScraperApiCache();
    clearQueryExtractionCache();
    clearBudgetIntentCache();
    resetGeminiQuotaStatus();
    process.env.SCRAPERAPI_KEY = "test_scraperapi_key_valid";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey !== undefined) {
      process.env.SCRAPERAPI_KEY = originalKey;
    } else {
      delete process.env.SCRAPERAPI_KEY;
    }
    clearScraperApiCache();
    clearQueryExtractionCache();
    clearBudgetIntentCache();
    resetGeminiQuotaStatus();
  });

  it("successfully generates plan when Gemini quota is exhausted using deterministic intent and real ScraperAPI items", async () => {
    // Trip Gemini circuit breaker beforehand
    recordGeminiQuotaExhaustion(3600);
    assert.strictEqual(isGeminiQuotaExhausted(), true);

    (globalThis as any).fetch = async (url: string) => {
      return new Response(
        JSON.stringify({
          results: [
            {
              asin: "B0COMBINED01",
              name: "Acer Swift Laptop 16GB RAM 512GB SSD",
              price: 98500,
              price_string: "₹98,500.00",
              stars: 4.5,
              total_reviews: 820,
              url: "https://www.amazon.in/dp/B0COMBINED01",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    // Plan generation request with prompt "Laptop around ₹1 lakh"
    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Laptop around ₹1 lakh", budget: 100000 }),
    });

    const res = await generatePOST(req);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.plan);
    assert.strictEqual(body.plan.budgetMode, "single_product_target");
    assert.strictEqual(body.plan.items.length, 1);
    assert.strictEqual(body.plan.items[0].asin, "B0COMBINED01");
    // Verify item price is near ₹1 lakh target
    assert.strictEqual(body.plan.items[0].unitPrice, 98500);
  });

  it("retries early socket connect hiccups (ETIMEDOUT) and succeeds on subsequent attempt", async () => {
    let scraperCalls = 0;
    (globalThis as any).fetch = async (url: string) => {
      const urlStr = String(url);
      if (!urlStr.includes("stainles")) {
        // Return empty results for any background job queries still in flight
        return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      scraperCalls++;
      if (scraperCalls === 1) {
        // First attempt suffers instantaneous TCP socket drop
        const socketErr: any = new Error("connect ETIMEDOUT 18.154.144.108:443");
        socketErr.code = "ETIMEDOUT";
        throw socketErr;
      }
      return new Response(
        JSON.stringify({
          results: [
            {
              asin: "B0BOTTLE01",
              name: "Stainless Steel Water Bottle 750ml",
              price: 599,
              price_string: "₹599.00",
              stars: 4.4,
              total_reviews: 1200,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const result = await searchAmazonIndia("stainless steel water bottle 750ml", {
      skipCache: true,
      timeoutMs: 10000,
    });

    assert.strictEqual(scraperCalls, 2);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].asin, "B0BOTTLE01");
    assert.strictEqual(result.items[0].price, 599);
  });

  it("generatePlan in browser environment defaults to async execution and polls background job successfully", async () => {
    (globalThis as any).window = {};
    let generateBodySent: any = null;
    let generateHeadersSent: any = null;
    let pollCount = 0;

    try {
      (globalThis as any).fetch = async (url: string, init?: any) => {
        if (url.includes("/api/plan/generate")) {
          generateBodySent = JSON.parse(init?.body || "{}");
          generateHeadersSent = init?.headers || {};
          return new Response(
            JSON.stringify({
              success: true,
              jobId: "job_test_polling_123",
              checkUrl: "/api/plan/jobs?id=job_test_polling_123",
              status: "pending",
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.includes("/api/plan/jobs?id=job_test_polling_123")) {
          pollCount++;
          if (pollCount === 1) {
            return new Response(
              JSON.stringify({
                status: "processing",
                progressMessage: "Retrieving live ASIN pricing...",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({
              status: "completed",
              plan: {
                title: "Curated Camping Essentials",
                budget: 5000,
                totalAmount: 4200,
                remainingAmount: 800,
                items: [
                  {
                    id: "B0CAMP01",
                    asin: "B0CAMP01",
                    name: "Camping Lantern LED",
                    unitPrice: 1200,
                    totalPrice: 1200,
                    quantity: 1,
                    inStock: true,
                  },
                ],
                validation: { budgetCompliant: true },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      };

      const plan = await generatePlan("camping lantern and gear", 5000);

      assert.strictEqual(generateBodySent?.async, true);
      assert.strictEqual(generateHeadersSent?.["Prefer"], "respond-async");
      assert.ok(pollCount >= 1);
      assert.strictEqual(plan.title, "Curated Camping Essentials");
      assert.strictEqual(plan.items.length, 1);
      assert.strictEqual(plan.totalAmount, 4200);
    } finally {
      delete (globalThis as any).window;
    }
  });
});

