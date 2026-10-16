import { describe, it, before, after } from "node:test";
import assert from "node:assert";

// Load .env if present
try {
  process.loadEnvFile?.();
} catch (_) {}

import {
  parsePriceToPaise,
  formatAmazonIndiaUrl,
  mapSearchItemToCatalogItem,
  mapSearchItemToProductItem,
  ScraperApiMonitor,
  searchAmazonIndia,
  getAmazonProductDetails,
  getAmazonOffersIfAvailable,
  ScraperApiError,
  ScraperApiKeyMissingError,
  ScraperApiSearchItem,
  sanitizeErrorMessage,
  getScraperApiTimeoutMs,
} from "../lib/scraperapi";
import { getDemoFallbackPlan } from "../lib/stubs";
import {
  isTransientGeminiError,
  deriveDeterministicSearchQueries,
  extractAmazonSearchQueries,
  generateRealShoppingPlan,
} from "../lib/planner-engine";
import {
  getProductById,
  searchCatalog,
  registerCatalogProduct,
  registerCatalogProducts,
  PRODUCT_CATALOG,
} from "../lib/catalog";

describe("ScraperAPI Amazon India Integration Tests", () => {
  describe("Price Parsing & Integer Minor Units (Paise)", () => {
    it("parses numeric prices into exact integer paise", () => {
      const res1 = parsePriceToPaise(249.5);
      assert.strictEqual(res1.priceMinor, 24950);
      assert.strictEqual(res1.priceRupees, 249.5);

      const res2 = parsePriceToPaise(999);
      assert.strictEqual(res2.priceMinor, 99900);
      assert.strictEqual(res2.priceRupees, 999);
    });

    it("parses formatted INR currency strings with symbols and commas", () => {
      const res1 = parsePriceToPaise(undefined, "₹1,499.00");
      assert.strictEqual(res1.priceMinor, 149900);
      assert.strictEqual(res1.priceRupees, 1499);

      const res2 = parsePriceToPaise(undefined, "INR 2,999.50");
      assert.strictEqual(res2.priceMinor, 299950);
      assert.strictEqual(res2.priceRupees, 2999.5);

      const res3 = parsePriceToPaise(undefined, "Rs. 450");
      assert.strictEqual(res3.priceMinor, 45000);
      assert.strictEqual(res3.priceRupees, 450);
    });

    it("returns null for missing, non-numeric, or unavailable prices without fabricating", () => {
      const res1 = parsePriceToPaise(null, null);
      assert.strictEqual(res1.priceMinor, null);
      assert.strictEqual(res1.priceRupees, null);
      assert.strictEqual(res1.priceDisplay, "Price unavailable");

      const res2 = parsePriceToPaise(undefined, "Currently unavailable");
      assert.strictEqual(res2.priceMinor, null);
      assert.strictEqual(res2.priceRupees, null);

      const res3 = parsePriceToPaise(undefined, "");
      assert.strictEqual(res3.priceMinor, null);
      assert.strictEqual(res3.priceRupees, null);

      const res4 = parsePriceToPaise(-50);
      assert.strictEqual(res4.priceMinor, null);
      assert.strictEqual(res4.priceRupees, null);
    });
  });

  describe("Amazon India Canonical URL Formatting", () => {
    it("formats standard ASINs into canonical Amazon.in URLs", () => {
      const url = formatAmazonIndiaUrl("B08N5WRWNW");
      assert.strictEqual(url, "https://www.amazon.in/dp/B08N5WRWNW");
    });

    it("canonicalizes .com or relative Amazon URLs to amazon.in", () => {
      const urlCom = formatAmazonIndiaUrl("B08N5WRWNW", "https://www.amazon.com/dp/B08N5WRWNW");
      assert.strictEqual(urlCom, "https://www.amazon.in/dp/B08N5WRWNW");

      const urlRel = formatAmazonIndiaUrl("B08N5WRWNW", "/dp/B08N5WRWNW");
      assert.strictEqual(urlRel, "https://www.amazon.in/dp/B08N5WRWNW");
    });
  });

  describe("Schema Mapping (ScraperAPI -> Intora)", () => {
    const sampleSearchItem: ScraperApiSearchItem = {
      asin: "B0TESTSKU1",
      name: "Classmate Pulse 6 Subject Spiral Notebook - Pack of 2",
      price: 340,
      price_string: "₹340.00",
      image: "https://m.media-amazon.com/images/I/71example.jpg",
      stars: 4.4,
      total_reviews: 1250,
      url: "https://www.amazon.in/dp/B0TESTSKU1",
      is_best_seller: true,
      has_prime: true,
    };

    it("maps search result to ProductCatalogItem with paise price and metadata", () => {
      const catalogItem = mapSearchItemToCatalogItem(sampleSearchItem, "stationery");
      assert.ok(catalogItem !== null);
      assert.strictEqual(catalogItem?.id, "B0TESTSKU1");
      assert.strictEqual(catalogItem?.asin, "B0TESTSKU1");
      assert.strictEqual(catalogItem?.name, "Classmate Pulse 6 Subject Spiral Notebook - Pack of 2");
      assert.strictEqual(catalogItem?.priceMinor, 34000);
      assert.strictEqual(catalogItem?.category, "stationery");
      assert.strictEqual(catalogItem?.url, "https://www.amazon.in/dp/B0TESTSKU1");
      assert.strictEqual(catalogItem?.imageUrl, "https://m.media-amazon.com/images/I/71example.jpg");
      assert.strictEqual(catalogItem?.rating, 4.4);
      assert.strictEqual(catalogItem?.totalReviews, 1250);
      assert.strictEqual(catalogItem?.inStock, true);
    });

    it("maps search result to UI ProductItem with badges and rupee unit prices", () => {
      const productItem = mapSearchItemToProductItem(sampleSearchItem, "Stationery");
      assert.ok(productItem !== null);
      assert.strictEqual(productItem?.id, "B0TESTSKU1");
      assert.strictEqual(productItem?.unitPrice, 340);
      assert.strictEqual(productItem?.totalPrice, 340);
      assert.strictEqual(productItem?.badge, "Best Seller");
      assert.strictEqual(productItem?.rating, 4.4);
      assert.strictEqual(productItem?.totalReviews, 1250);
      assert.ok(productItem?.url?.includes("amazon.in/dp/B0TESTSKU1"));
    });

    it("rejects items without valid pricing without fabrication", () => {
      const unpricedItem: ScraperApiSearchItem = {
        asin: "B0UNPRICED",
        name: "Unpriced Mystery Item",
      };
      const catalogRes = mapSearchItemToCatalogItem(unpricedItem);
      assert.strictEqual(catalogRes, null);

      const productRes = mapSearchItemToProductItem(unpricedItem);
      assert.strictEqual(productRes, null);
    });
  });

  describe("Dynamic Catalog Integration", () => {
    it("dynamically registers live Amazon products and retrieves them by ID", () => {
      const liveProduct = {
        id: "B0LIVETEST1",
        asin: "B0LIVETEST1",
        name: "Live Test Bluetooth Speaker",
        category: "electronics" as const,
        description: "Live test item from ScraperAPI",
        priceMinor: 149900,
        inStock: true,
        availableStock: 25,
        unit: "piece",
        url: "https://www.amazon.in/dp/B0LIVETEST1",
        rating: 4.5,
        totalReviews: 890,
        source: "scraperapi" as const,
      };

      registerCatalogProduct(liveProduct);

      const retrieved = getProductById("B0LIVETEST1");
      assert.ok(retrieved !== undefined);
      assert.strictEqual(retrieved?.id, "B0LIVETEST1");
      assert.strictEqual(retrieved?.priceMinor, 149900);
      assert.strictEqual(retrieved?.source, "scraperapi");
    });

    it("retains existing fixture isolation for offline testing", () => {
      const notebook = getProductById("college-notebook-pack");
      assert.ok(notebook !== undefined);
      assert.strictEqual(notebook?.priceMinor, 25000);

      // Verify fixture catalog is intact
      assert.ok(PRODUCT_CATALOG.length >= 10);
    });
  });

  describe("In-Memory Caching & ScraperApiMonitor", () => {
    it("caches responses and tracks cache hits", () => {
      const monitor = ScraperApiMonitor.getInstance();
      const initialStats = monitor.getStats();

      monitor.setCache("test_cache_key", { data: "test" }, 60_000);
      const cached = monitor.getCache<{ data: string }>("test_cache_key");
      assert.ok(cached !== null);
      assert.strictEqual(cached?.data, "test");

      const stats = monitor.getStats();
      assert.ok(stats.cacheHits >= initialStats.cacheHits + 1);
    });

    it("expires cache entries after TTL", async () => {
      const monitor = ScraperApiMonitor.getInstance();
      monitor.setCache("short_ttl_key", { data: "expired_soon" }, 10); // 10ms

      await new Promise((r) => setTimeout(r, 25));
      const expired = monitor.getCache("short_ttl_key");
      assert.strictEqual(expired, null);
    });
  });

  describe("Error Handling & Zero Mock Substitution in Production", () => {
    it("throws ScraperApiKeyMissingError when SCRAPERAPI_KEY is unset in production call", async () => {
      const originalKey = process.env.SCRAPERAPI_KEY;
      delete process.env.SCRAPERAPI_KEY;

      try {
        await searchAmazonIndia("spiral notebooks");
        assert.fail("Should have thrown ScraperApiKeyMissingError");
      } catch (err: any) {
        assert.ok(
          err instanceof ScraperApiKeyMissingError ||
            err.message.includes("SCRAPERAPI_KEY environment variable is missing"),
          "Expected ScraperApiKeyMissingError"
        );
      } finally {
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        }
      }
    });

    it("instantiates custom ScraperApiError with status code and endpoint", () => {
      const error = new ScraperApiError(
        "Rate limit reached (429)",
        429,
        "https://api.scraperapi.com/structured/amazon/search"
      );
      assert.strictEqual(error.statusCode, 429);
      assert.strictEqual(error.endpoint, "https://api.scraperapi.com/structured/amazon/search");
      assert.strictEqual(error.name, "ScraperApiError");
    });
  });

  describe("Gemini 503/429 Error Handling & Transient Retries", () => {
    it("correctly identifies transient Gemini errors for bounded retry", () => {
      // 503 Service Unavailable / overloaded
      assert.strictEqual(
        isTransientGeminiError({ status: 503, message: "The model is overloaded. Please try again later." }),
        true
      );
      // 429 Resource Exhausted / rate limit
      assert.strictEqual(
        isTransientGeminiError({ status: 429, message: "Resource exhausted: quota exceeded" }),
        true
      );
      // Network fetch failures
      assert.strictEqual(isTransientGeminiError(new Error("fetch failed")), true);
      assert.strictEqual(isTransientGeminiError({ message: "ECONNRESET socket closed" }), true);
    });

    it("rejects permanent client errors from retry loops", () => {
      // 400 Bad request / invalid argument
      assert.strictEqual(
        isTransientGeminiError({ status: 400, message: "Invalid argument: contents is required" }),
        false
      );
      // 401 Unauthorized / invalid key
      assert.strictEqual(
        isTransientGeminiError({ status: 401, message: "API key not valid. Please pass a valid API key." }),
        false
      );
      // 403 Forbidden / permission denied
      assert.strictEqual(
        isTransientGeminiError({ status: 403, message: "Permission denied on resource" }),
        false
      );
      // 404 Model not found
      assert.strictEqual(
        isTransientGeminiError({ status: 404, message: "Model gemini-invalid not found" }),
        false
      );
    });
  });

  describe("Deterministic Fallback Search Query Derivation", () => {
    it("never searches unrelated terms such as 'rose' when user asks for other items", () => {
      const festQueries = deriveDeterministicSearchQueries("Kolkata college cultural fest supplies under 3000");
      assert.ok(festQueries.length > 0);
      assert.ok(festQueries.every((q) => !q.toLowerCase().includes("rose")));
      assert.ok(festQueries.some((q) => q.includes("fest") || q.includes("supplies") || q.includes("party")));

      const trekQueries = deriveDeterministicSearchQueries("Western Ghats monsoon trek essentials under 5000");
      assert.ok(trekQueries.length > 0);
      assert.ok(trekQueries.every((q) => !q.toLowerCase().includes("rose")));
      assert.ok(trekQueries.some((q) => q.includes("poncho") || q.includes("bag") || q.includes("waterproof")));

      const hostelQueries = deriveDeterministicSearchQueries("First year hostel room move-in setup");
      assert.ok(hostelQueries.length > 0);
      assert.ok(hostelQueries.every((q) => !q.toLowerCase().includes("rose")));
    });

    it("correctly derives rose-related search queries when the user explicitly requests roses", () => {
      const roseQueries = deriveDeterministicSearchQueries("Fresh red roses for Valentine's under 1000");
      assert.ok(roseQueries.length > 0);
      assert.ok(roseQueries.some((q) => q.toLowerCase().includes("rose")));
    });

    it("derives safe non-empty queries from arbitrary requests without sending empty queries", () => {
      const singleWord = deriveDeterministicSearchQueries("backpack");
      assert.ok(singleWord.length > 0);
      assert.ok(singleWord[0].length > 1);

      const emptyPrompt = deriveDeterministicSearchQueries("");
      assert.ok(emptyPrompt.length > 0);
      assert.ok(emptyPrompt[0].length > 1);
      assert.strictEqual(emptyPrompt[0], "daily utility essentials");

      const whitespacePrompt = deriveDeterministicSearchQueries("   \n\t  ");
      assert.ok(whitespacePrompt.length > 0);
      assert.ok(whitespacePrompt[0].length > 1);
    });

    it("extractAmazonSearchQueries falls back to deterministic derivation when Gemini is skipped or unavailable", async () => {
      const queries = await extractAmazonSearchQueries("Stainless water bottle and fast charging power bank", {
        skipGemini: true,
      });
      assert.ok(Array.isArray(queries));
      assert.ok(queries.length >= 2);
      assert.ok(queries.some((q) => q.includes("bottle")));
      assert.ok(queries.some((q) => q.includes("power bank")));
    });
  });

  describe("ScraperAPI Network Failure Handling & Secret Masking", () => {
    it("masks API keys and prevents credential leaks in error messages", () => {
      const urlWithKey = "https://api.scraperapi.com/structured/amazon/search?api_key=SECRET_KEY_12345&query=rose";
      const sanitized = sanitizeErrorMessage(`Failed to fetch ${urlWithKey}`);
      assert.ok(!sanitized.includes("SECRET_KEY_12345"));
      assert.ok(sanitized.includes("api_key=***"));
    });

    it("handles ScraperAPI network failure with status 502 without leaking secrets", async () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.SCRAPERAPI_KEY;
      process.env.SCRAPERAPI_KEY = "dummy_test_key_abc123";

      // Mock fetch to simulate network failure (TypeError: fetch failed)
      (globalThis as any).fetch = async () => {
        const err: any = new TypeError("fetch failed");
        err.cause = { code: "ECONNRESET", message: "read ECONNRESET" };
        throw err;
      };

      try {
        await searchAmazonIndia("test network failure", { skipCache: true, timeoutMs: 500 });
        assert.fail("Should have thrown ScraperApiError on network failure");
      } catch (err: any) {
        assert.ok(err instanceof ScraperApiError, "Error should be instance of ScraperApiError");
        assert.strictEqual(err.statusCode, 502);
        assert.ok(err.message.includes("network error") || err.message.includes("fetch failed"));
        assert.ok(!err.message.includes("dummy_test_key_abc123"), "API key should not be leaked");
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("handles ScraperAPI request timeout with status 504 and ETIMEDOUT code", async () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.SCRAPERAPI_KEY;
      process.env.SCRAPERAPI_KEY = "dummy_test_key_abc123";

      let attempts = 0;
      (globalThis as any).fetch = async () => {
        attempts++;
        const err: any = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      };

      try {
        await searchAmazonIndia("test timeout", { skipCache: true, timeoutMs: 10, maxAttempts: 2 });
        assert.fail("Should have thrown ScraperApiError on timeout");
      } catch (err: any) {
        assert.ok(err instanceof ScraperApiError, "Error should be instance of ScraperApiError");
        assert.strictEqual(err.statusCode, 504);
        assert.ok(err.message.includes("timed out") && err.message.includes("ETIMEDOUT"));
        assert.strictEqual(err.providerDetail, "ETIMEDOUT");
        assert.strictEqual(attempts, 2, "Should attempt retry on transient timeout");
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("retries on 429 Rate Limit with bounded backoff", async () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.SCRAPERAPI_KEY;
      process.env.SCRAPERAPI_KEY = "dummy_test_key_abc123";

      let attempts = 0;
      (globalThis as any).fetch = async () => {
        attempts++;
        if (attempts === 1) {
          return new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "0" },
          });
        }
        return new Response(
          JSON.stringify({
            results: [{ asin: "B0SUCCESS1", name: "Success item", price: 999 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      try {
        const result = await searchAmazonIndia("test 429 retry", { skipCache: true, timeoutMs: 50 });
        assert.strictEqual(attempts, 2);
        assert.strictEqual(result.items.length, 1);
        assert.strictEqual(result.items[0].asin, "B0SUCCESS1");
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("does not retry permanent 401 Unauthorized authentication errors", async () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.SCRAPERAPI_KEY;
      process.env.SCRAPERAPI_KEY = "invalid_api_key";

      let attempts = 0;
      (globalThis as any).fetch = async () => {
        attempts++;
        return new Response(JSON.stringify({ message: "Invalid API key" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      };

      try {
        await searchAmazonIndia("test 401 no retry", { skipCache: true, timeoutMs: 50, maxAttempts: 3 });
        assert.fail("Should have thrown 401 error");
      } catch (err: any) {
        assert.ok(err instanceof ScraperApiError);
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(attempts, 1, "Should not retry 401 Unauthorized");
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });
  });

  describe("Empty Product Results & Validation", () => {
    it("handles empty product search results with 404 status without fabricating data", async () => {
      const originalKey = process.env.SCRAPERAPI_KEY;
      const originalFetch = globalThis.fetch;
      process.env.SCRAPERAPI_KEY = "dummy_test_key_xyz";

      // Mock fetch to return empty results
      (globalThis as any).fetch = async () => {
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      try {
        await generateRealShoppingPlan("nonexistent xyz query item 999", 2000, { skipGemini: true });
        assert.fail("Should have thrown error on empty results");
      } catch (err: any) {
        assert.strictEqual(err.statusCode, 404);
        assert.ok(err.message.includes("No products found"));
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("successfully creates a verified shopping plan grounded strictly in real items", async () => {
      const originalKey = process.env.SCRAPERAPI_KEY;
      const originalFetch = globalThis.fetch;
      process.env.SCRAPERAPI_KEY = "dummy_test_key_xyz";

      // Mock fetch to return real products
      (globalThis as any).fetch = async () => {
        return new Response(
          JSON.stringify({
            results: [
              {
                asin: "B0MOCKSKU01",
                name: "Milton Stainless Steel Water Bottle 750ml",
                price: 499,
                price_string: "₹499.00",
                stars: 4.5,
                total_reviews: 1200,
                url: "https://www.amazon.in/dp/B0MOCKSKU01",
              },
              {
                asin: "B0MOCKSKU02",
                name: "Mi 10000mAh Power Bank Fast Charging",
                price: 1299,
                price_string: "₹1,299.00",
                stars: 4.6,
                total_reviews: 3500,
                url: "https://www.amazon.in/dp/B0MOCKSKU02",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      try {
        const plan = await generateRealShoppingPlan("Water bottle and power bank", 2500, { skipGemini: true });
        assert.ok(plan !== null);
        assert.strictEqual(plan.items.length, 2);
        assert.strictEqual(plan.validation.budgetCompliant, true);
        assert.strictEqual(plan.validation.integerPaiseExact, true);
        assert.strictEqual(plan.totalAmount, 499 + 1299);
        assert.strictEqual(plan.remainingAmount, 2500 - (499 + 1299));
        assert.ok(plan.planHash.startsWith("0x"));
        assert.strictEqual(plan.items[0].id, "B0MOCKSKU02"); // Sorted by rating/reviews
        assert.strictEqual(plan.items[0].url, "https://www.amazon.in/dp/B0MOCKSKU02");
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });
  });

  describe("Timeout, Concurrency & Reliability Enhancements", () => {
    it("respects configurable timeout via SCRAPERAPI_TIMEOUT_MS and defaults to 35000", () => {
      const origEnv = process.env.SCRAPERAPI_TIMEOUT_MS;
      try {
        delete process.env.SCRAPERAPI_TIMEOUT_MS;
        assert.strictEqual(getScraperApiTimeoutMs(), 35000);

        process.env.SCRAPERAPI_TIMEOUT_MS = "45000";
        assert.strictEqual(getScraperApiTimeoutMs(), 45000);

        process.env.SCRAPERAPI_TIMEOUT_MS = "invalid";
        assert.strictEqual(getScraperApiTimeoutMs(), 35000);
      } finally {
        if (origEnv !== undefined) {
          process.env.SCRAPERAPI_TIMEOUT_MS = origEnv;
        } else {
          delete process.env.SCRAPERAPI_TIMEOUT_MS;
        }
      }
    });

    it("automatically routes 10-character ASIN queries to the structured product endpoint", async () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.SCRAPERAPI_KEY;
      let requestedUrl = "";

      try {
        process.env.SCRAPERAPI_KEY = "test_scraperapi_key_valid";
        globalThis.fetch = async (input: any) => {
          requestedUrl = String(input);
          return new Response(
            JSON.stringify({
              name: "Apple AirPods Pro (2nd Generation)",
              asin: "B08N5WRWNW",
              pricing: "₹24,900.00",
              average_rating: 4.8,
              total_reviews: 1420,
              images: ["https://m.media-amazon.com/images/I/airpods.jpg"],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        };

        const res = await searchAmazonIndia("B08N5WRWNW", { skipCache: true });
        assert.ok(requestedUrl.includes("/structured/amazon/product"), "Expected product endpoint call for ASIN");
        assert.ok(requestedUrl.includes("asin=B08N5WRWNW"), "Expected asin parameter in URL");
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].asin, "B08N5WRWNW");
        assert.strictEqual(res.items[0].price, 24900);
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("attaches structured errorCode, isRetryable, and userFriendlyMessage to ScraperApiError", () => {
      const timeoutErr = new ScraperApiError(
        "ScraperAPI request timed out after 35 seconds (ETIMEDOUT).",
        504,
        "https://api.scraperapi.com/structured/amazon/search",
        "ETIMEDOUT"
      );
      assert.strictEqual(timeoutErr.statusCode, 504);
      assert.strictEqual(timeoutErr.errorCode, "PROVIDER_TIMEOUT");
      assert.strictEqual(timeoutErr.isRetryable, true);
      assert.strictEqual(timeoutErr.userFriendlyMessage, "Live product search is taking too long. Please retry.");

      const rateLimitErr = new ScraperApiError(
        "ScraperAPI error: 429 Too Many Requests.",
        429,
        "https://api.scraperapi.com/structured/amazon/search"
      );
      assert.strictEqual(rateLimitErr.errorCode, "RATE_LIMITED");
      assert.strictEqual(rateLimitErr.isRetryable, true);

      const authErr = new ScraperApiError(
        "ScraperAPI error: 401 Unauthorized.",
        401,
        "https://api.scraperapi.com/structured/amazon/search"
      );
      assert.strictEqual(authErr.errorCode, "AUTHENTICATION_ERROR");
      assert.strictEqual(authErr.isRetryable, false);
    });

    it("preserves partial results when one search query succeeds and another fails", async () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.SCRAPERAPI_KEY;

      try {
        process.env.SCRAPERAPI_KEY = "test_scraperapi_key_valid";
        globalThis.fetch = async (input: any) => {
          const urlStr = String(input);
          if (urlStr.includes("water") || urlStr.includes("bottle")) {
            return new Response(
              JSON.stringify({
                results: [
                  {
                    asin: "B0BOTTLE01",
                    name: "Milton Thermosteel Water Bottle 1000ml",
                    price: 699,
                    stars: 4.5,
                    total_reviews: 420,
                  },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          // Simulate timeout on secondary query
          return new Response(
            JSON.stringify({ message: "Task timed out after proxy rotation" }),
            { status: 504, headers: { "Content-Type": "application/json" } }
          );
        };

        const plan = await generateRealShoppingPlan("stainless steel water bottle and backpack", 3000, {
          skipGemini: true,
          timeoutMs: 500,
        });

        assert.ok(plan !== null);
        assert.ok(plan.items.length > 0, "Plan should be populated from successful query");
        assert.ok(plan.items.some((i) => i.id === "B0BOTTLE01"));
        assert.strictEqual(plan.validation.catalogGrounded, true);
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("aborts active requests immediately when client passes an aborted AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();

      const originalKey = process.env.SCRAPERAPI_KEY;
      try {
        process.env.SCRAPERAPI_KEY = "test_scraperapi_key_valid";
        await assert.rejects(
          async () => {
            await searchAmazonIndia("test keywords", { signal: controller.signal });
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 499);
            assert.strictEqual(err.errorCode, "REQUEST_CANCELLED");
            return true;
          }
        );
      } finally {
        if (originalKey) {
          process.env.SCRAPERAPI_KEY = originalKey;
        } else {
          delete process.env.SCRAPERAPI_KEY;
        }
      }
    });

    it("generates an explicitly labeled offline demo plan without claiming live verification", () => {
      const demoPlan = getDemoFallbackPlan("campus fest supplies", 4000);

      assert.strictEqual(demoPlan.isDemoFallback, true);
      assert.ok(demoPlan.demoDisclaimer?.includes("NOT verified in real-time"));
      assert.ok(demoPlan.title.includes("[Demo]"));
      assert.ok(demoPlan.budget === 4000);
      assert.ok(demoPlan.totalAmount <= demoPlan.budget);
      assert.strictEqual(demoPlan.validation.budgetCompliant, true);
      assert.ok(demoPlan.items.length > 0);
    });
  });

  describe("Live API Verification (Conditional)", () => {
    it(
      "verifies live ScraperAPI credentials and queries Amazon India live",
      { timeout: 120000 },
      async function (t: any) {
        const runLive = process.env.RUN_LIVE_SCRAPERAPI_TESTS === "true";
        const key = process.env.SCRAPERAPI_KEY?.trim();

        if (!runLive) {
          t?.skip?.(
            "Live ScraperAPI integration test is opt-in. Set RUN_LIVE_SCRAPERAPI_TESTS=true to execute live network requests."
          );
          return;
        }

        if (!key) {
          t?.skip?.(
            "SCRAPERAPI_KEY is not configured in environment. Skipping live ScraperAPI integration test."
          );
          return;
        }

        console.log("⚡ RUN_LIVE_SCRAPERAPI_TESTS=true detected. Executing live Amazon India search test...");
        const startTime = Date.now();
        let searchResult;
        try {
          searchResult = await searchAmazonIndia("notebooks", { country_code: "in", tld: "in" });
        } catch (err: any) {
          const duration = Date.now() - startTime;
          console.error(
            `❌ Live ScraperAPI Amazon India search failed after ${duration}ms: ${err?.message} (status: ${err?.statusCode || "unknown"})`
          );
          throw err;
        }

        const duration = Date.now() - startTime;
        console.log(
          `✓ Live search succeeded in ${duration}ms: returned ${searchResult.items.length} items from Amazon India.`
        );
        assert.ok(searchResult !== null);
        assert.ok(Array.isArray(searchResult.items));
        assert.ok(searchResult.items.length > 0, "Live search for 'notebooks' returned empty list");

        const first = searchResult.items[0];
        console.log(`  Sample Live Item: "${first.name}" | ASIN: ${first.asin} | Price: ₹${first.price}`);
        assert.ok(first.asin, "Live search item should have an ASIN");
        assert.ok(first.name, "Live search item should have a name");
        assert.ok(typeof first.price === "number" || first.price === null);

        // Test Product details endpoint live with the retrieved ASIN
        console.log(`⚡ Testing Amazon Product endpoint live for ASIN: ${first.asin}...`);
        const productDetail = await getAmazonProductDetails(first.asin);
        if (productDetail && productDetail.product) {
          console.log(
            `✓ Live product details retrieved: "${productDetail.product.name}" | ASIN: ${productDetail.product.asin}`
          );
          assert.strictEqual(productDetail.product.asin, first.asin);
        }
      }
    );
  });
});
