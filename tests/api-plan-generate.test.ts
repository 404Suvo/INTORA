import { describe, it } from "node:test";
import assert from "node:assert";
import { POST } from "../app/api/plan/generate/route";
import { GET as searchGET } from "../app/api/products/search/route";
import { GET as asinGET } from "../app/api/products/[asin]/route";
import { GET as healthGET } from "../app/api/health/route";

describe("API Route: POST /api/plan/generate", () => {
  it("returns 400 if prompt is missing or whitespace", async () => {
    const req1 = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "", budget: 1000 }),
    });
    const res1 = await POST(req1);
    assert.strictEqual(res1.status, 400);
    const data1 = await res1.json();
    assert.strictEqual(data1.success, false);
    assert.ok(data1.error.includes("prompt"));

    const req2 = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   ", budget: 1000 }),
    });
    const res2 = await POST(req2);
    assert.strictEqual(res2.status, 400);
  });

  it("returns 400 if budget is invalid or below ₹100", async () => {
    const req1 = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "notebooks", budget: -50 }),
    });
    const res1 = await POST(req1);
    assert.strictEqual(res1.status, 400);
    const data1 = await res1.json();
    assert.strictEqual(data1.success, false);
    assert.ok(data1.error.includes("budget"));

    const req2 = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "notebooks", budget: 50 }),
    });
    const res2 = await POST(req2);
    assert.strictEqual(res2.status, 400);
    const data2 = await res2.json();
    assert.strictEqual(data2.success, false);
    assert.ok(data2.error.includes("100"));
  });

  it("rejects budgets above ₹2,00,000 (such as ₹2,00,001) with 400 status and clear error message", async () => {
    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "creator workstation gear", budget: 200001 }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes("2,00,000"));
  });

  it("rejects zero, negative, and non-numeric budgets with 400 status", async () => {
    for (const invalidBudget of [0, -100, "not-a-number"]) {
      const req = new Request("http://localhost:3000/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "study supplies", budget: invalidBudget }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 400, `Budget ${invalidBudget} should be rejected with 400`);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    }
  });

  it("accepts valid budgets of ₹500, ₹3,000, ₹50,000, ₹1,50,000, and ₹2,00,000", async () => {
    const originalKey = process.env.SCRAPERAPI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SCRAPERAPI_KEY = "test_key_dummy";

    (globalThis as any).fetch = async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              asin: "B0HIGHVAL01",
              name: "Professional High-End Gear Item",
              price: 45000,
              price_string: "₹45,000.00",
              stars: 4.8,
              total_reviews: 1200,
              url: "https://www.amazon.in/dp/B0HIGHVAL01",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const validBudgets = [500, 3000, 50000, 150000, 200000];
      for (const b of validBudgets) {
        const req = new Request("http://localhost:3000/api/plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "high value equipment", budget: b }),
        });
        const res = await POST(req);
        assert.strictEqual(res.status, 200, `Budget ₹${b} should be accepted`);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.plan.budget, b);
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.SCRAPERAPI_KEY = originalKey;
      } else {
        delete process.env.SCRAPERAPI_KEY;
      }
    }
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new Request("http://localhost:3000/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes("Invalid JSON"));
  });

  it("returns 503 when SCRAPERAPI_KEY is not configured", async () => {
    const originalKey = process.env.SCRAPERAPI_KEY;
    delete process.env.SCRAPERAPI_KEY;

    try {
      const req = new Request("http://localhost:3000/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "college notebooks", budget: 1500 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 503);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes("SCRAPERAPI_KEY"));
    } finally {
      if (originalKey) {
        process.env.SCRAPERAPI_KEY = originalKey;
      }
    }
  });

  it("returns 404 when no products are found on Amazon India", async () => {
    const originalKey = process.env.SCRAPERAPI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SCRAPERAPI_KEY = "test_key_dummy";

    // Mock fetch returning empty results
    (globalThis as any).fetch = async () => {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const req = new Request("http://localhost:3000/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "unfindable-xyz-item-9999", budget: 2000 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes("No products found"));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.SCRAPERAPI_KEY = originalKey;
      } else {
        delete process.env.SCRAPERAPI_KEY;
      }
    }
  });

  it("returns 502 on upstream ScraperAPI network failure without leaking secrets", async () => {
    const originalKey = process.env.SCRAPERAPI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SCRAPERAPI_KEY = "test_key_secret_998877";

    (globalThis as any).fetch = async () => {
      const err: any = new TypeError("fetch failed");
      err.cause = { code: "ECONNRESET", message: "socket hang up" };
      throw err;
    };

    try {
      const req = new Request("http://localhost:3000/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "rose", budget: 1000 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 502);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes("network error") || data.error.includes("fetch failed"));
      assert.ok(!data.error.includes("test_key_secret_998877"));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.SCRAPERAPI_KEY = originalKey;
      } else {
        delete process.env.SCRAPERAPI_KEY;
      }
    }
  });

  it("returns 200 and successful plan when products are found", async () => {
    const originalKey = process.env.SCRAPERAPI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SCRAPERAPI_KEY = "test_key_dummy";

    (globalThis as any).fetch = async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              asin: "B0TESTAPI01",
              name: "Pilot V5 Liquid Ink Rollerball Pen - Pack of 3",
              price: 210,
              price_string: "₹210.00",
              stars: 4.5,
              total_reviews: 4500,
              url: "https://www.amazon.in/dp/B0TESTAPI01",
            },
            {
              asin: "B0TESTAPI02",
              name: "Classmate Notebooks A5 Ruled - Pack of 6",
              price: 390,
              price_string: "₹390.00",
              stars: 4.4,
              total_reviews: 2100,
              url: "https://www.amazon.in/dp/B0TESTAPI02",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const req = new Request("http://localhost:3000/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "pens and notebooks", budget: 1000 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.plan);
      assert.strictEqual(data.plan.items.length, 2);
      assert.strictEqual(data.plan.totalAmount, 210 + 390);
      assert.strictEqual(data.plan.validation.budgetCompliant, true);
      assert.ok(data.plan.planHash.startsWith("0x"));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.SCRAPERAPI_KEY = originalKey;
      } else {
        delete process.env.SCRAPERAPI_KEY;
      }
    }
  });

  it("returns 504 with structured error response (errorCode: PROVIDER_TIMEOUT, isRetryable: true) on ScraperAPI timeout", async () => {
    const originalKey = process.env.SCRAPERAPI_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SCRAPERAPI_KEY = "test_key_dummy";

    (globalThis as any).fetch = async () => {
      const err: any = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      err.code = "ETIMEDOUT";
      throw err;
    };

    try {
      const req = new Request("http://localhost:3000/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "college fest shirts", budget: 2000 }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 504);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.errorCode, "PROVIDER_TIMEOUT");
      assert.strictEqual(data.isRetryable, true);
      assert.strictEqual(data.userFriendlyMessage, "Live product search is taking too long. Please retry.");
      assert.ok(data.disclaimer);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.SCRAPERAPI_KEY = originalKey;
      } else {
        delete process.env.SCRAPERAPI_KEY;
      }
    }
  });

  describe("Product Routes & Health Check: Missing SCRAPERAPI_KEY Handling", () => {
    it("GET /api/products/search returns 503 without substituting mock products when key is missing", async () => {
      const originalKey = process.env.SCRAPERAPI_KEY;
      delete process.env.SCRAPERAPI_KEY;
      try {
        const req = new Request("http://localhost:3000/api/products/search?q=laptop");
        const res = await searchGET(req);
        assert.strictEqual(res.status, 503);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.errorCode, "SCRAPERAPI_KEY_MISSING");
        assert.ok(data.error?.includes("SCRAPERAPI_KEY"));
        assert.ok(data.disclaimer?.includes("No fabricated mock data substituted"));
        assert.ok(data.hint?.includes("Vercel"));
      } finally {
        if (originalKey !== undefined) process.env.SCRAPERAPI_KEY = originalKey;
      }
    });

    it("GET /api/products/[asin] returns 503 without substituting mock products when key is missing", async () => {
      const originalKey = process.env.SCRAPERAPI_KEY;
      delete process.env.SCRAPERAPI_KEY;
      try {
        const req = new Request("http://localhost:3000/api/products/B09XYZ1234");
        const res = await asinGET(req, { params: Promise.resolve({ asin: "B09XYZ1234" }) });
        assert.strictEqual(res.status, 503);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.errorCode, "SCRAPERAPI_KEY_MISSING");
        assert.ok(data.error?.includes("SCRAPERAPI_KEY"));
        assert.ok(data.disclaimer?.includes("No mock data substituted"));
        assert.ok(data.hint?.includes("Vercel"));
      } finally {
        if (originalKey !== undefined) process.env.SCRAPERAPI_KEY = originalKey;
      }
    });

    it("GET /api/health safely reflects ScraperAPI configuration state without leaking keys", async () => {
      const originalKey = process.env.SCRAPERAPI_KEY;
      try {
        // Case A: Missing key
        delete process.env.SCRAPERAPI_KEY;
        const resMissing = await healthGET();
        const dataMissing = await resMissing.json();
        assert.strictEqual(dataMissing.services.scraperapi.configured, false);
        assert.strictEqual(dataMissing.services.scraperapi.status, "missing_key");

        // Case B: Configured key
        process.env.SCRAPERAPI_KEY = "dummy_configured_key_1234";
        const resConfigured = await healthGET();
        const dataConfigured = await resConfigured.json();
        assert.strictEqual(dataConfigured.services.scraperapi.configured, true);
        assert.strictEqual(dataConfigured.services.scraperapi.status, "configured");
        const serialized = JSON.stringify(dataConfigured);
        assert.ok(!serialized.includes("dummy_configured_key_1234"), "Must never leak key in health check");
      } finally {
        if (originalKey !== undefined) process.env.SCRAPERAPI_KEY = originalKey;
        else delete process.env.SCRAPERAPI_KEY;
      }
    });
  });
});
