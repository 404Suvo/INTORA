/**
 * Safe, server-side diagnostic script for ScraperAPI Amazon India endpoint.
 * Never prints or leaks the API key.
 * Measures latency, status code, response headers, and validates payload schema.
 */

import {
  checkScraperApiConfig,
  getScraperApiKey,
  sanitizeErrorMessage,
  AMAZON_SEARCH_ENDPOINT,
  AMAZON_INDIA_TLD,
  AMAZON_INDIA_COUNTRY_CODE,
} from "../lib/scraperapi";

async function runDiagnostic() {
  console.log("=== SCRAPERAPI DIAGNOSTIC TEST ===");
  
  // 1. Config check
  const config = checkScraperApiConfig();
  console.log("1. Configuration status:", {
    configured: config.configured,
    missing: config.missing,
    hasKeyEnv: Boolean(process.env.SCRAPERAPI_KEY),
    keyLength: process.env.SCRAPERAPI_KEY?.trim()?.length || 0,
  });

  if (!config.configured) {
    console.error("❌ SCRAPERAPI_KEY is not configured:", config.error);
    process.exit(1);
  }

  const apiKey = getScraperApiKey();
  const query = "notebooks";
  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    country_code: AMAZON_INDIA_COUNTRY_CODE,
    tld: AMAZON_INDIA_TLD,
  });

  const fullUrl = `${AMAZON_SEARCH_ENDPOINT}?${params.toString()}`;
  const maskedUrl = sanitizeErrorMessage(fullUrl);
  console.log("2. Endpoint:", maskedUrl);

  const timeoutMs = 35000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = Date.now();
  console.log(`3. Sending minimal request for query="${query}" with ${timeoutMs}ms timeout...`);

  try {
    const res = await fetch(fullUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timer);
    const elapsedMs = Date.now() - startTime;

    console.log("4. Response received:");
    console.log(`   - Elapsed Time: ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(2)}s)`);
    console.log(`   - HTTP Status: ${res.status} ${res.statusText}`);
    console.log(`   - Content-Type: ${res.headers.get("content-type")}`);
    
    // Check relevant headers without exposing secrets
    const headerInfo: Record<string, string | null> = {
      "retry-after": res.headers.get("retry-after"),
      "x-scraperapi-render": res.headers.get("x-scraperapi-render"),
      "x-scraperapi-status": res.headers.get("x-scraperapi-status"),
    };
    console.log("   - Response Headers:", headerInfo);

    if (!res.ok) {
      const errorText = await res.text();
      const sanitizedBody = sanitizeErrorMessage(errorText.slice(0, 300));
      console.error(`❌ HTTP Error ${res.status}:`, sanitizedBody);

      if (res.status === 401) {
        console.error("   Classification: AUTHENTICATION_ERROR (Invalid or expired API key)");
      } else if (res.status === 403) {
        console.error("   Classification: FORBIDDEN (Plan limits, concurrency, or permissions exceeded)");
      } else if (res.status === 429) {
        console.error("   Classification: RATE_LIMITED (Exceeded request rate)");
      } else if (res.status >= 500) {
        console.error("   Classification: UPSTREAM_PROVIDER_ERROR");
      }
      return;
    }

    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("❌ Classification: MALFORMED_RESPONSE (Non-JSON payload received)");
      console.error("   Preview:", sanitizeErrorMessage(rawText.slice(0, 200)));
      return;
    }

    // Validate structure
    const results = data?.results;
    if (!Array.isArray(results)) {
      console.warn("⚠️ Response parsed as JSON but missing 'results' array.");
      console.log("   Top-level keys:", Object.keys(data));
      return;
    }

    if (results.length === 0) {
      console.log("ℹ️ Classification: VALID_EMPTY_RESULTS (Query returned 0 items)");
      return;
    }

    console.log("✓ Classification: SUCCESS");
    console.log(`   - Total items returned: ${results.length}`);
    const sample = results[0];
    console.log("   - Sample item validation:", {
      hasAsin: Boolean(sample.asin),
      asin: sample.asin,
      hasName: Boolean(sample.name),
      name: sample.name ? sample.name.slice(0, 50) + "..." : null,
      price: sample.price,
      price_string: sample.price_string,
      hasImage: Boolean(sample.image),
    });

    console.log("\n=== DIAGNOSTIC COMPLETE: PROVIDER IS HEALTHY AND FUNCTIONING ===");
  } catch (err: any) {
    clearTimeout(timer);
    const elapsedMs = Date.now() - startTime;
    const isTimeout =
      err?.name === "AbortError" ||
      err?.code === "ETIMEDOUT" ||
      String(err?.message || "").includes("ETIMEDOUT");

    console.error(`❌ Request Failed after ${elapsedMs}ms:`);
    if (isTimeout) {
      console.error("   Classification: TIMEOUT (Request exceeded timeout threshold)");
    } else {
      console.error("   Classification: NETWORK_ERROR:", sanitizeErrorMessage(err?.message || String(err)));
    }
  }
}

runDiagnostic();
