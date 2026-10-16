/**
 * SCRAPERAPI CLIENT FOR REAL AMAZON INDIA PRODUCT SEARCH & PRICING
 *
 * Official ScraperAPI Structured Data Endpoints for Amazon:
 * - Search: https://api.scraperapi.com/structured/amazon/search
 * - Product: https://api.scraperapi.com/structured/amazon/product
 * - Offers: https://api.scraperapi.com/structured/amazon/offers
 *
 * Configured specifically for Amazon India:
 * - tld: "in" (Amazon.in marketplace)
 * - country_code: "in" (India geo-targeting)
 * - output_format: "json"
 */

import { formatInr } from "./catalog";
import { ProductCatalogItem } from "./types";
import { ProductItem } from "@/data/mockData";
import { calculateProductCost } from "./trade-off-engine";

// Ensure local .env file is loaded if running in Node without Next.js
try {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // Gracefully ignored if .env does not exist or was already loaded
}

export const AMAZON_SEARCH_ENDPOINT = "https://api.scraperapi.com/structured/amazon/search";
export const AMAZON_PRODUCT_ENDPOINT = "https://api.scraperapi.com/structured/amazon/product";
export const AMAZON_OFFERS_ENDPOINT = "https://api.scraperapi.com/structured/amazon/offers";

export const AMAZON_INDIA_TLD = "in";
export const AMAZON_INDIA_COUNTRY_CODE = "in";

export function getScraperApiTimeoutMs(): number {
  const envVal = process.env.SCRAPERAPI_TIMEOUT_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 35000; // 35 seconds default to avoid exceeding platform execution thresholds
}

export const DEFAULT_SCRAPERAPI_TIMEOUT_MS = getScraperApiTimeoutMs();
export const MAX_SCRAPERAPI_RETRIES = 2; // Up to 2 retries after initial attempt = 3 attempts total

export interface ScraperApiSearchItem {
  type?: string;
  position?: number;
  asin: string;
  name: string;
  image?: string;
  has_prime?: boolean;
  is_best_seller?: boolean;
  is_amazon_choice?: boolean;
  is_limited_deal?: boolean;
  purchase_history_message?: string;
  stars?: number;
  total_reviews?: number;
  url?: string;
  spec?: Record<string, any>;
  price_string?: string;
  price_symbol?: string;
  price?: number | null;
  original_price?: {
    price_string?: string;
    price_symbol?: string;
    price?: number | null;
  };
}

export interface ScraperApiSearchResponse {
  results?: ScraperApiSearchItem[];
  pagination?: {
    current_page?: number;
    total_pages?: number;
  };
}

export interface ScraperApiProductResponse {
  name?: string;
  product_information?: Record<string, any>;
  brand?: string;
  brand_url?: string;
  full_description?: string;
  images?: string[];
  product_category?: string;
  feature_bullets?: string[];
  model?: string;
  ships_from?: string;
  sold_by?: string;
  pricing?: string | number;
  list_price?: string | number;
  availability_status?: string;
  average_rating?: number;
  total_reviews?: number;
  asin?: string;
  is_coupon_exists?: boolean;
  reviews?: any[];
}

export interface ScraperApiOffersResponse {
  item?: {
    name?: string;
    asin?: string;
    image?: string;
    average_rating?: number;
    total_reviews?: number;
  };
  listings?: Array<{
    price?: number | null;
    price_with_currency?: string;
    shipping_price?: number | null;
    has_prime_shipping?: boolean;
    ships_from?: string;
    sold_by?: string;
    fullfilled_by_amazon?: boolean;
  }>;
}

export interface AmazonProductDetail {
  id: string;
  asin: string;
  name: string;
  category: string;
  description: string;
  priceMinor: number | null;
  unitPrice: number | null;
  priceDisplay: string;
  inStock: boolean;
  availableStock: number;
  unit: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  totalReviews?: number;
  featureBullets?: string[];
  retrievedAt: string;
  badge?: string;
}

export interface PriceParseResult {
  priceMinor: number | null;
  priceRupees: number | null;
  priceDisplay: string;
}

/**
 * Extracts integer minor units (paise) and rupees from diverse ScraperAPI price formats.
 * Handles numbers, formatted strings ("₹1,499.00", "$23.98", "1,499"), and nulls.
 * If price is missing or unparseable, returns nulls without fabricating values.
 */
export function parsePriceToPaise(
  rawPrice: number | string | null | undefined,
  rawPriceString?: string | null
): PriceParseResult {
  // 1. Direct number check
  if (typeof rawPrice === "number" && !isNaN(rawPrice) && rawPrice > 0) {
    const minor = Math.round(rawPrice * 100);
    return {
      priceMinor: minor,
      priceRupees: rawPrice,
      priceDisplay: formatInr(minor),
    };
  }

  // 2. String parsing (e.g., "₹1,499.00", "₹ 1,499", "Rs. 450", "INR 2,999.50")
  const text = (typeof rawPrice === "string" ? rawPrice : rawPriceString) || "";
  if (text.trim()) {
    // Match numeric price amount (e.g. 1,499.00 or 450 or 2,999.50)
    const match = text.match(/([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/);
    if (match && match[1]) {
      const cleaned = match[1].replace(/,/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) {
        const minor = Math.round(parsed * 100);
        return {
          priceMinor: minor,
          priceRupees: parsed,
          priceDisplay: formatInr(minor),
        };
      }
    }
  }

  // 3. Unavailable / Missing price
  return {
    priceMinor: null,
    priceRupees: null,
    priceDisplay: "Price unavailable",
  };
}

/**
 * Ensures product URL points directly to the Amazon India marketplace listing.
 */
export function formatAmazonIndiaUrl(asin: string, rawUrl?: string): string {
  if (rawUrl && rawUrl.includes("amazon.in")) {
    return rawUrl;
  }
  const cleanAsin = asin.trim();
  return `https://www.amazon.in/dp/${cleanAsin}`;
}

/**
 * Sanitizes any message, URL, or error object to ensure API keys are never exposed.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return "";
  let sanitized = String(message).replace(/([?&]api_key=)[^&\s"'`]+/gi, "$1***");
  const apiKey = process.env.SCRAPERAPI_KEY?.trim();
  if (apiKey && apiKey.length > 4) {
    sanitized = sanitized.replaceAll(apiKey, "***");
  }
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && geminiKey.length > 4) {
    sanitized = sanitized.replaceAll(geminiKey, "***");
  }
  return sanitized;
}

/**
 * Conservative In-Memory Caching & Monitoring
 */
export class ScraperApiError extends Error {
  statusCode: number;
  endpoint: string;
  providerDetails?: string;
  cause?: unknown;
  errorCode: string;
  isRetryable: boolean;
  userFriendlyMessage: string;
  elapsedMs?: number;

  get providerDetail(): string | undefined {
    return this.providerDetails;
  }

  constructor(
    message: string,
    statusCode: number,
    endpoint: string,
    providerDetails?: string,
    cause?: unknown,
    options?: {
      errorCode?: string;
      isRetryable?: boolean;
      userFriendlyMessage?: string;
      elapsedMs?: number;
    }
  ) {
    const cleanMsg = sanitizeErrorMessage(message);
    super(cleanMsg, cause !== undefined ? { cause } : undefined);
    this.name = "ScraperApiError";
    this.statusCode = statusCode;
    this.endpoint = sanitizeErrorMessage(endpoint);
    if (providerDetails) {
      this.providerDetails = sanitizeErrorMessage(providerDetails);
    }
    if (cause !== undefined) {
      this.cause = cause;
    }

    const isTimeout =
      statusCode === 504 ||
      cleanMsg.includes("ETIMEDOUT") ||
      cleanMsg.toLowerCase().includes("timed out");
    const isRateLimit = statusCode === 429;
    const isAuth = statusCode === 401 || statusCode === 403;

    this.errorCode =
      options?.errorCode ||
      (isTimeout
        ? "PROVIDER_TIMEOUT"
        : isRateLimit
        ? "RATE_LIMITED"
        : isAuth
        ? "AUTHENTICATION_ERROR"
        : statusCode === 502 || statusCode === 503
        ? "UPSTREAM_ERROR"
        : "SEARCH_FAILED");

    this.isRetryable =
      options?.isRetryable !== undefined
        ? options.isRetryable
        : isTimeout || isRateLimit || statusCode === 502 || statusCode === 503;

    this.userFriendlyMessage =
      options?.userFriendlyMessage ||
      (isTimeout
        ? "Live product search is taking too long. Please retry."
        : isRateLimit
        ? "Amazon India search rate limit reached. Please wait a moment and retry."
        : isAuth
        ? "Authentication failed with product search provider. Please verify credentials."
        : cleanMsg);

    this.elapsedMs = options?.elapsedMs;
  }
}

export class ScraperApiKeyMissingError extends Error {
  statusCode: number = 503;
  errorCode: string = "SCRAPERAPI_KEY_MISSING";
  isRetryable: boolean = false;
  userFriendlyMessage: string =
    "Product search service is temporarily unconfigured. Please configure SCRAPERAPI_KEY in the backend environment.";

  constructor(
    message = "SCRAPERAPI_KEY environment variable is missing. Please add SCRAPERAPI_KEY to your .env file or Vercel Environment Variables."
  ) {
    super(sanitizeErrorMessage(message));
    this.name = "ScraperApiKeyMissingError";
  }
}

/**
 * Calculates exponential backoff with jitter, respecting Retry-After headers when present.
 */
export function calculateBackoffDelay(
  attempt: number,
  retryAfterHeader?: string | null,
  timeoutMs?: number
): number {
  if (retryAfterHeader) {
    const parsedSec = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsedSec) && parsedSec > 0) {
      return Math.min(15000, parsedSec * 1000);
    }
    const dateParsed = Date.parse(retryAfterHeader);
    if (!isNaN(dateParsed)) {
      const diffMs = dateParsed - Date.now();
      if (diffMs > 0) {
        return Math.min(15000, diffMs);
      }
    }
  }

  // Scale down backoff for fast unit test timeouts
  if (timeoutMs && timeoutMs < 3000) {
    const maxDelay = Math.max(5, Math.floor(timeoutMs / 2));
    const base = Math.pow(2, attempt - 1) * 5;
    const jitter = Math.random() * 5;
    return Math.max(1, Math.min(maxDelay, base + jitter));
  }

  const maxDelay = 8000;
  const base = Math.pow(2, attempt - 1) * 800;
  const jitter = Math.random() * 400;
  return Math.min(maxDelay, base + jitter);
}

/**
 * Cache entry with TTL timestamp
 */
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  customTtlMs?: number;
}

export class ScraperApiMonitor {
  private static instance: ScraperApiMonitor;
  private cache = new Map<string, CacheEntry<any>>();
  private ttlMs: number;
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    apiErrors: 0,
    lastRequestTime: null as string | null,
    lastError: null as string | null,
  };

  constructor(ttlMinutes = 30) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    ScraperApiMonitor.instance = this;
  }

  static getInstance(): ScraperApiMonitor {
    if (!ScraperApiMonitor.instance) {
      ScraperApiMonitor.instance = new ScraperApiMonitor(30);
    }
    return ScraperApiMonitor.instance;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const ttl = entry.customTtlMs !== undefined ? entry.customTtlMs : this.ttlMs;
    if (Date.now() - entry.cachedAt > ttl) {
      this.cache.delete(key);
      return null;
    }
    this.stats.cacheHits++;
    return entry.data;
  }

  getWithTimestamp<T>(key: string): { data: T; cachedAt: number } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const ttl = entry.customTtlMs !== undefined ? entry.customTtlMs : this.ttlMs;
    if (Date.now() - entry.cachedAt > ttl) {
      this.cache.delete(key);
      return null;
    }
    this.stats.cacheHits++;
    return { data: entry.data, cachedAt: entry.cachedAt };
  }

  getCache<T>(key: string): T | null {
    return this.get<T>(key);
  }

  set<T>(key: string, data: T, customTtlMs?: number): void {
    this.cache.set(key, { data, cachedAt: Date.now(), customTtlMs });
  }

  setCache<T>(key: string, data: T, customTtlMs?: number): void {
    this.set<T>(key, data, customTtlMs);
  }

  recordRequest(): void {
    this.stats.totalRequests++;
    this.stats.lastRequestTime = new Date().toISOString();
  }

  recordMiss(): void {
    this.stats.cacheMisses++;
  }

  recordError(err: string): void {
    this.stats.apiErrors++;
    this.stats.lastError = err;
  }

  getStats() {
    return {
      ...this.stats,
      cachedEntriesCount: this.cache.size,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}

export const scraperApiMonitor = new ScraperApiMonitor(30);

export interface ScraperApiConfigStatus {
  configured: boolean;
  missing: boolean;
  error?: string;
  hint?: string;
}

/**
 * Safely inspects whether SCRAPERAPI_KEY is configured in the backend environment.
 * NEVER makes a network request and NEVER prints or exposes the actual key.
 */
export function checkScraperApiConfig(): ScraperApiConfigStatus {
  const rawKey = process.env.SCRAPERAPI_KEY;
  const key = rawKey?.trim();

  if (!key || key === "your_scraperapi_key_here") {
    return {
      configured: false,
      missing: true,
      error: "SCRAPERAPI_KEY is not configured in backend environment.",
      hint: "Add SCRAPERAPI_KEY to your .env file for local development, or configure SCRAPERAPI_KEY in Vercel Environment Variables and redeploy.",
    };
  }

  return {
    configured: true,
    missing: false,
  };
}

/**
 * Non-throwing boolean check for whether ScraperAPI is configured.
 * Safe to call from health checks or status indicators.
 */
export function isScraperApiConfigured(): boolean {
  return checkScraperApiConfig().configured;
}

/**
 * Returns the ScraperAPI key from server environment or throws a structured error.
 * Key is accessed ONLY in server-side contexts.
 */
export function getScraperApiKey(): string {
  const config = checkScraperApiConfig();
  if (!config.configured) {
    throw new ScraperApiKeyMissingError(
      `${config.error} ${config.hint || "Please add SCRAPERAPI_KEY to your .env file or Vercel Environment Variables."}`
    );
  }
  return process.env.SCRAPERAPI_KEY!.trim();
}

/**
 * Converts a ScraperAPI Amazon search result item to Intora's ProductCatalogItem.
 */
export function mapSearchItemToCatalogItem(
  item: ScraperApiSearchItem,
  fallbackCategory = "supplies",
  retrievedAt = new Date().toISOString()
): ProductCatalogItem | null {
  if (!item.asin || !item.name) return null;

  const priceResult = parsePriceToPaise(item.price, item.price_string);
  if (priceResult.priceMinor === null) {
    // Missing or unavailable price
    return null;
  }

  const url = formatAmazonIndiaUrl(item.asin, item.url);

  return {
    id: item.asin,
    asin: item.asin,
    name: item.name.trim(),
    category: fallbackCategory,
    description: item.name.trim(),
    priceMinor: priceResult.priceMinor,
    inStock: true,
    availableStock: 50,
    unit: "piece",
    url,
    imageUrl: item.image,
    rating: item.stars,
    totalReviews: item.total_reviews,
    retrievedAt,
  };
}

/**
 * Converts a ScraperAPI Amazon search result item to Intora's UI ProductItem.
 */
export function mapSearchItemToProductItem(
  item: ScraperApiSearchItem,
  category = "Essentials",
  rationale = "Retrieved live from Amazon India with verified stock and pricing.",
  retrievedAt = new Date().toISOString()
): ProductItem | null {
  if (!item.asin || !item.name) return null;

  const priceResult = parsePriceToPaise(item.price, item.price_string);
  if (priceResult.priceMinor === null || priceResult.priceRupees === null) {
    return null;
  }

  const url = formatAmazonIndiaUrl(item.asin, item.url);

  let badge: string | undefined = undefined;
  if (item.is_amazon_choice) badge = "Amazon's Choice";
  else if (item.is_best_seller) badge = "Best Seller";
  else if (item.is_limited_deal) badge = "Limited Deal";
  else if (item.has_prime) badge = "Prime";

  const costBreakdown = calculateProductCost(priceResult.priceRupees, 1, {
    hasPrime: item.has_prime,
    shippingCost: item.has_prime ? 0 : undefined,
  });

  return {
    id: item.asin,
    asin: item.asin,
    name: item.name.trim(),
    category,
    quantity: 1,
    unitPrice: priceResult.priceRupees,
    totalPrice: priceResult.priceRupees,
    subtotal: priceResult.priceRupees,
    rationale,
    inStock: true,
    imagePlaceholder: item.image || "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
    badge,
    url,
    rating: item.stars,
    totalReviews: item.total_reviews,
    retrievedAt,
    merchant: "Amazon India",
    shippingCost: costBreakdown.shippingCost,
    taxes: costBreakdown.taxes,
    discounts: costBreakdown.discounts,
    costBreakdown,
    estimatedTotalCost: costBreakdown.estimatedTotalCost,
    source: "scraperapi",
  };
}

/**
 * Performs a live Amazon India search query via ScraperAPI.
 */
export interface SearchAmazonIndiaOptions {
  page?: number;
  category?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  skipCache?: boolean;
  country_code?: string;
  tld?: string;
  signal?: AbortSignal;
  maxTotalTimeMs?: number;
}

/**
 * Performs a live Amazon India search query via ScraperAPI.
 * If query is an ASIN format (10 alphanumeric chars), routes to structured product endpoint.
 */
export async function searchAmazonIndia(
  query: string,
  options: SearchAmazonIndiaOptions = {}
): Promise<{ items: ScraperApiSearchItem[]; retrievedAt: string; cached: boolean }> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { items: [], retrievedAt: new Date().toISOString(), cached: false };
  }

  // 1. ASIN Routing: Route 10-char ASINs to the product endpoint
  const isAsin = /^[B0-9][A-Z0-9]{9}$/i.test(trimmedQuery);
  if (isAsin) {
    const { product, retrievedAt, cached } = await getAmazonProductDetails(trimmedQuery, {
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
      skipCache: options.skipCache,
      signal: options.signal,
      maxTotalTimeMs: options.maxTotalTimeMs,
    });

    const priceParse = parsePriceToPaise(
      product.pricing,
      typeof product.pricing === "string" ? product.pricing : undefined
    );

    const searchItem: ScraperApiSearchItem = {
      asin: product.asin || trimmedQuery,
      name: product.name || trimmedQuery,
      image: product.images?.[0],
      stars: product.average_rating,
      total_reviews: product.total_reviews,
      url: formatAmazonIndiaUrl(trimmedQuery),
      price: priceParse.priceRupees,
      price_string: typeof product.pricing === "string" ? product.pricing : undefined,
    };

    return {
      items: [searchItem],
      retrievedAt,
      cached,
    };
  }

  // 2. Keyword Search: Use Amazon Search endpoint
  const cacheKey = `search:${trimmedQuery.toLowerCase()}:${options.page || 1}`;
  if (!options.skipCache) {
    const cached = scraperApiMonitor.get<ScraperApiSearchItem[]>(cacheKey);
    if (cached) {
      return {
        items: cached,
        retrievedAt: new Date().toISOString(),
        cached: true,
      };
    }
  }

  scraperApiMonitor.recordMiss();
  scraperApiMonitor.recordRequest();

  const apiKey = getScraperApiKey();
  const params = new URLSearchParams({
    api_key: apiKey,
    query: trimmedQuery,
    country_code: options.country_code || AMAZON_INDIA_COUNTRY_CODE,
    tld: options.tld || AMAZON_INDIA_TLD,
  });

  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  const url = `${AMAZON_SEARCH_ENDPOINT}?${params.toString()}`;
  const timeoutMs = options.timeoutMs ?? getScraperApiTimeoutMs();
  const maxAttempts = options.maxAttempts ?? (1 + MAX_SCRAPERAPI_RETRIES);
  const maxTotalTimeMs = options.maxTotalTimeMs ?? (timeoutMs * maxAttempts + 15000);
  const startTime = Date.now();
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsedSoFar = Date.now() - startTime;
    if (attempt > 1 && options.maxTotalTimeMs && elapsedSoFar >= options.maxTotalTimeMs) {
      break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let onExternalAbort: (() => void) | undefined;
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new ScraperApiError("Request was cancelled by client.", 499, AMAZON_SEARCH_ENDPOINT, "CANCELLED", undefined, {
          errorCode: "REQUEST_CANCELLED",
          isRetryable: false,
          userFriendlyMessage: "Request was cancelled.",
        });
      }
      onExternalAbort = () => controller.abort();
      options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);
      if (options.signal && onExternalAbort) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }

      if (!res.ok) {
        let responseBody = "";
        try {
          responseBody = await res.text();
        } catch (_) {}

        let providerDetail = "";
        if (responseBody) {
          try {
            const parsed = JSON.parse(responseBody);
            providerDetail = parsed.message || parsed.error || parsed.detail || "";
          } catch (_) {
            providerDetail = responseBody.slice(0, 150).trim();
          }
        }
        providerDetail = sanitizeErrorMessage(providerDetail);

        // 1. Permanent Authentication Errors (401, 403) - DO NOT RETRY
        if (res.status === 401) {
          const msg = `ScraperAPI error: 401 Unauthorized. Please verify your SCRAPERAPI_KEY.${providerDetail ? ` (${providerDetail})` : ""}`;
          const err = new ScraperApiError(msg, 401, AMAZON_SEARCH_ENDPOINT, providerDetail, undefined, {
            errorCode: "AUTHENTICATION_ERROR",
            isRetryable: false,
            userFriendlyMessage: "Authentication failed with product search provider. Please verify your SCRAPERAPI_KEY.",
            elapsedMs: Date.now() - startTime,
          });
          scraperApiMonitor.recordError(err.message);
          throw err;
        }

        if (res.status === 403) {
          const msg = `ScraperAPI error: 403 Forbidden. Your plan may have exceeded concurrency or limits.${providerDetail ? ` (${providerDetail})` : ""}`;
          const err = new ScraperApiError(msg, 403, AMAZON_SEARCH_ENDPOINT, providerDetail, undefined, {
            errorCode: "FORBIDDEN",
            isRetryable: false,
            userFriendlyMessage: "Access forbidden by product search provider. Plan limit or concurrency exceeded.",
            elapsedMs: Date.now() - startTime,
          });
          scraperApiMonitor.recordError(err.message);
          throw err;
        }

        // 2. Client Errors (400, 404, 422) - DO NOT RETRY
        if (res.status === 400 || res.status === 404 || res.status === 422) {
          const msg = `ScraperAPI client error: ${res.status} ${res.statusText}.${providerDetail ? ` (${providerDetail})` : ""}`;
          const err = new ScraperApiError(msg, res.status, AMAZON_SEARCH_ENDPOINT, providerDetail, undefined, {
            errorCode: "CLIENT_ERROR",
            isRetryable: false,
            userFriendlyMessage: `Product search returned ${res.status} error. Please check search parameters.`,
            elapsedMs: Date.now() - startTime,
          });
          scraperApiMonitor.recordError(err.message);
          throw err;
        }

        // 3. Rate Limit (429) - RETRY WITH EXPONENTIAL BACKOFF / RETRY-AFTER
        if (res.status === 429) {
          const retryAfter = res.headers?.get?.("retry-after");
          const msg = `ScraperAPI error: 429 Too Many Requests. Rate limit reached.${providerDetail ? ` (${providerDetail})` : ""}`;
          lastError = new ScraperApiError(msg, 429, AMAZON_SEARCH_ENDPOINT, providerDetail, undefined, {
            errorCode: "RATE_LIMITED",
            isRetryable: true,
            userFriendlyMessage: "Amazon India search rate limit reached. Please wait a moment and retry.",
            elapsedMs: Date.now() - startTime,
          });

          if (attempt < maxAttempts) {
            const delayMs = calculateBackoffDelay(attempt, retryAfter, timeoutMs);
            if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }
          }
          scraperApiMonitor.recordError(lastError.message);
          throw lastError;
        }

        // 4. Server Errors (500, 502, 503, 504) - RETRY WITH EXPONENTIAL BACKOFF
        if (res.status >= 500) {
          const retryAfter = res.headers?.get?.("retry-after");
          const msg = `ScraperAPI error: ${res.status} Server Error. Upstream service failed.${providerDetail ? ` (${providerDetail})` : ""}`;
          lastError = new ScraperApiError(msg, res.status, AMAZON_SEARCH_ENDPOINT, providerDetail, undefined, {
            errorCode: "UPSTREAM_ERROR",
            isRetryable: true,
            userFriendlyMessage: "Amazon India search service is temporarily unavailable. Please retry.",
            elapsedMs: Date.now() - startTime,
          });

          if (attempt < maxAttempts) {
            const delayMs = calculateBackoffDelay(attempt, retryAfter, timeoutMs);
            if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }
          }
          scraperApiMonitor.recordError(lastError.message);
          throw lastError;
        }

        const defaultMsg = `ScraperAPI Amazon Search returned status ${res.status} (${res.statusText}).${providerDetail ? ` (${providerDetail})` : ""}`;
        const err = new ScraperApiError(defaultMsg, res.status, AMAZON_SEARCH_ENDPOINT, providerDetail, undefined, {
          errorCode: "SEARCH_FAILED",
          isRetryable: false,
          userFriendlyMessage: "Live product search returned an unexpected status. Please retry.",
          elapsedMs: Date.now() - startTime,
        });
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      let data: ScraperApiSearchResponse;
      try {
        data = (await res.json()) as ScraperApiSearchResponse;
      } catch (jsonErr: any) {
        const err = new ScraperApiError(
          "ScraperAPI returned malformed non-JSON response.",
          502,
          AMAZON_SEARCH_ENDPOINT,
          undefined,
          jsonErr,
          {
            errorCode: "MALFORMED_RESPONSE",
            isRetryable: true,
            userFriendlyMessage: "ScraperAPI returned an invalid non-JSON response. Please retry.",
            elapsedMs: Date.now() - startTime,
          }
        );
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      const items = Array.isArray(data?.results) ? data.results : [];
      scraperApiMonitor.set(cacheKey, items);

      return {
        items,
        retrievedAt: new Date().toISOString(),
        cached: false,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (options.signal && onExternalAbort) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }

      if (options.signal?.aborted) {
        throw new ScraperApiError("Request was cancelled by client.", 499, AMAZON_SEARCH_ENDPOINT, "CANCELLED", undefined, {
          errorCode: "REQUEST_CANCELLED",
          isRetryable: false,
          userFriendlyMessage: "Request was cancelled.",
        });
      }

      // Permanent auth/missing key errors or client errors should not be retried
      if (
        err instanceof ScraperApiKeyMissingError ||
        (err instanceof ScraperApiError &&
          (err.statusCode === 401 ||
            err.statusCode === 403 ||
            err.statusCode === 400 ||
            err.statusCode === 404 ||
            err.statusCode === 422 ||
            err.statusCode === 499))
      ) {
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      // Check for Timeout / Abort errors
      const isTimeout =
        err.name === "AbortError" ||
        err.name === "TimeoutError" ||
        err?.cause?.name === "TimeoutError" ||
        err?.cause?.name === "AbortError" ||
        err?.code === "ETIMEDOUT" ||
        err?.cause?.code === "ETIMEDOUT" ||
        String(err?.message || "").includes("ETIMEDOUT") ||
        String(err?.cause?.message || "").includes("ETIMEDOUT");

      if (isTimeout) {
        const elapsed = Date.now() - startTime;
        const timeoutMsg = sanitizeErrorMessage(
          `ScraperAPI request timed out after ${Math.round(timeoutMs / 1000)} seconds (ETIMEDOUT).`
        );
        lastError = new ScraperApiError(timeoutMsg, 504, AMAZON_SEARCH_ENDPOINT, "ETIMEDOUT", err, {
          errorCode: "PROVIDER_TIMEOUT",
          isRetryable: true,
          userFriendlyMessage: "Live product search is taking too long. Please retry.",
          elapsedMs: elapsed,
        });

        if (attempt < maxAttempts) {
          const delayMs = calculateBackoffDelay(attempt, null, timeoutMs);
          if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
        }

        scraperApiMonitor.recordError(lastError.message);
        throw lastError;
      }

      if (err instanceof ScraperApiError) {
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      // Network exception (e.g. fetch failed, ECONNRESET, ENOTFOUND)
      const elapsed = Date.now() - startTime;
      const cause = err?.cause;
      const causeDetail = cause?.message || cause?.code || "";
      const baseDetail = err?.message || "fetch failed";
      const detailStr = causeDetail ? `${baseDetail} (${causeDetail})` : baseDetail;
      const safeNetworkMsg = sanitizeErrorMessage(`ScraperAPI network error: ${detailStr}`);

      lastError = new ScraperApiError(safeNetworkMsg, 502, AMAZON_SEARCH_ENDPOINT, causeDetail, err, {
        errorCode: "NETWORK_ERROR",
        isRetryable: true,
        userFriendlyMessage: "Network connection to ScraperAPI failed. Please check internet connection and retry.",
        elapsedMs: elapsed,
      });

      if (attempt < maxAttempts) {
        const delayMs = calculateBackoffDelay(attempt, null, timeoutMs);
        if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }

      scraperApiMonitor.recordError(lastError.message);
      throw lastError;
    }
  }

  throw (
    lastError ||
    new ScraperApiError("ScraperAPI request failed after retries.", 502, AMAZON_SEARCH_ENDPOINT, undefined, undefined, {
      errorCode: "SEARCH_FAILED",
      isRetryable: true,
      userFriendlyMessage: "Live product search failed after retries. Please retry.",
      elapsedMs: Date.now() - startTime,
    })
  );
}

export interface GetAmazonProductDetailsOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  skipCache?: boolean;
  signal?: AbortSignal;
  maxTotalTimeMs?: number;
}

/**
 * Retrieves comprehensive details for an Amazon product by ASIN.
 */
export async function getAmazonProductDetails(
  asin: string,
  options: GetAmazonProductDetailsOptions = {}
): Promise<{ product: ScraperApiProductResponse; retrievedAt: string; cached: boolean }> {
  const cleanAsin = asin.trim();
  if (!cleanAsin) {
    throw new Error("ASIN parameter cannot be empty.");
  }

  const cacheKey = `product:${cleanAsin}`;
  if (!options.skipCache) {
    const cached = scraperApiMonitor.get<ScraperApiProductResponse>(cacheKey);
    if (cached) {
      return {
        product: cached,
        retrievedAt: new Date().toISOString(),
        cached: true,
      };
    }
  }

  scraperApiMonitor.recordMiss();
  scraperApiMonitor.recordRequest();

  const apiKey = getScraperApiKey();
  const params = new URLSearchParams({
    api_key: apiKey,
    asin: cleanAsin,
    country_code: AMAZON_INDIA_COUNTRY_CODE,
    tld: AMAZON_INDIA_TLD,
  });

  const url = `${AMAZON_PRODUCT_ENDPOINT}?${params.toString()}`;
  const timeoutMs = options.timeoutMs ?? getScraperApiTimeoutMs();
  const maxAttempts = options.maxAttempts ?? (1 + MAX_SCRAPERAPI_RETRIES);
  const maxTotalTimeMs = options.maxTotalTimeMs ?? (timeoutMs * maxAttempts + 15000);
  const startTime = Date.now();
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsedSoFar = Date.now() - startTime;
    if (attempt > 1 && options.maxTotalTimeMs && elapsedSoFar >= options.maxTotalTimeMs) {
      break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let onExternalAbort: (() => void) | undefined;
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new ScraperApiError("Request was cancelled by client.", 499, AMAZON_PRODUCT_ENDPOINT, "CANCELLED", undefined, {
          errorCode: "REQUEST_CANCELLED",
          isRetryable: false,
          userFriendlyMessage: "Request was cancelled.",
        });
      }
      onExternalAbort = () => controller.abort();
      options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);
      if (options.signal && onExternalAbort) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }

      if (!res.ok) {
        let responseBody = "";
        try {
          responseBody = await res.text();
        } catch (_) {}

        let providerDetail = "";
        if (responseBody) {
          try {
            const parsed = JSON.parse(responseBody);
            providerDetail = parsed.message || parsed.error || parsed.detail || "";
          } catch (_) {
            providerDetail = responseBody.slice(0, 150).trim();
          }
        }
        providerDetail = sanitizeErrorMessage(providerDetail);

        // 1. Permanent Authentication Errors (401, 403) - DO NOT RETRY
        if (res.status === 401) {
          const msg = `ScraperAPI product error: 401 Unauthorized. Please verify your SCRAPERAPI_KEY.${providerDetail ? ` (${providerDetail})` : ""}`;
          const err = new ScraperApiError(msg, 401, AMAZON_PRODUCT_ENDPOINT, providerDetail, undefined, {
            errorCode: "AUTHENTICATION_ERROR",
            isRetryable: false,
            userFriendlyMessage: "Authentication failed with product search provider. Please verify your SCRAPERAPI_KEY.",
            elapsedMs: Date.now() - startTime,
          });
          scraperApiMonitor.recordError(err.message);
          throw err;
        }

        if (res.status === 403) {
          const msg = `ScraperAPI product error: 403 Forbidden. Your plan may have exceeded concurrency or limits.${providerDetail ? ` (${providerDetail})` : ""}`;
          const err = new ScraperApiError(msg, 403, AMAZON_PRODUCT_ENDPOINT, providerDetail, undefined, {
            errorCode: "FORBIDDEN",
            isRetryable: false,
            userFriendlyMessage: "Access forbidden by product search provider. Plan limit or concurrency exceeded.",
            elapsedMs: Date.now() - startTime,
          });
          scraperApiMonitor.recordError(err.message);
          throw err;
        }

        // 2. Client Errors (400, 404, 422) - DO NOT RETRY
        if (res.status === 400 || res.status === 404 || res.status === 422) {
          const msg = `ScraperAPI product client error: ${res.status} ${res.statusText}.${providerDetail ? ` (${providerDetail})` : ""}`;
          const err = new ScraperApiError(msg, res.status, AMAZON_PRODUCT_ENDPOINT, providerDetail, undefined, {
            errorCode: "CLIENT_ERROR",
            isRetryable: false,
            userFriendlyMessage: `Product detail request returned ${res.status} error.`,
            elapsedMs: Date.now() - startTime,
          });
          scraperApiMonitor.recordError(err.message);
          throw err;
        }

        // 3. Rate Limit (429) - RETRY WITH EXPONENTIAL BACKOFF / RETRY-AFTER
        if (res.status === 429) {
          const retryAfter = res.headers?.get?.("retry-after");
          const msg = `ScraperAPI product error: 429 Too Many Requests. Rate limit reached.${providerDetail ? ` (${providerDetail})` : ""}`;
          lastError = new ScraperApiError(msg, 429, AMAZON_PRODUCT_ENDPOINT, providerDetail, undefined, {
            errorCode: "RATE_LIMITED",
            isRetryable: true,
            userFriendlyMessage: "Amazon India product rate limit reached. Please wait a moment and retry.",
            elapsedMs: Date.now() - startTime,
          });

          if (attempt < maxAttempts) {
            const delayMs = calculateBackoffDelay(attempt, retryAfter, timeoutMs);
            if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }
          }
          scraperApiMonitor.recordError(lastError.message);
          throw lastError;
        }

        // 4. Server Errors (500, 502, 503, 504) - RETRY WITH EXPONENTIAL BACKOFF
        if (res.status >= 500) {
          const retryAfter = res.headers?.get?.("retry-after");
          const msg = `ScraperAPI product error: ${res.status} Server Error. Upstream service failed.${providerDetail ? ` (${providerDetail})` : ""}`;
          lastError = new ScraperApiError(msg, res.status, AMAZON_PRODUCT_ENDPOINT, providerDetail, undefined, {
            errorCode: "UPSTREAM_ERROR",
            isRetryable: true,
            userFriendlyMessage: "Amazon India product service is temporarily unavailable. Please retry.",
            elapsedMs: Date.now() - startTime,
          });

          if (attempt < maxAttempts) {
            const delayMs = calculateBackoffDelay(attempt, retryAfter, timeoutMs);
            if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }
          }
          scraperApiMonitor.recordError(lastError.message);
          throw lastError;
        }

        const defaultMsg = `ScraperAPI Amazon Product returned status ${res.status} (${res.statusText}).${providerDetail ? ` (${providerDetail})` : ""}`;
        const err = new ScraperApiError(defaultMsg, res.status, AMAZON_PRODUCT_ENDPOINT, providerDetail, undefined, {
          errorCode: "PRODUCT_FAILED",
          isRetryable: false,
          userFriendlyMessage: "Product details retrieval returned an unexpected status. Please retry.",
          elapsedMs: Date.now() - startTime,
        });
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      let product: ScraperApiProductResponse;
      try {
        product = (await res.json()) as ScraperApiProductResponse;
      } catch (jsonErr: any) {
        const err = new ScraperApiError(
          "ScraperAPI product endpoint returned malformed non-JSON response.",
          502,
          AMAZON_PRODUCT_ENDPOINT,
          undefined,
          jsonErr,
          {
            errorCode: "MALFORMED_RESPONSE",
            isRetryable: true,
            userFriendlyMessage: "ScraperAPI returned an invalid non-JSON product response. Please retry.",
            elapsedMs: Date.now() - startTime,
          }
        );
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      if (product && !product.asin) {
        product.asin = cleanAsin;
      }
      scraperApiMonitor.set(cacheKey, product);

      return {
        product,
        retrievedAt: new Date().toISOString(),
        cached: false,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (options.signal && onExternalAbort) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }

      if (options.signal?.aborted) {
        throw new ScraperApiError("Request was cancelled by client.", 499, AMAZON_PRODUCT_ENDPOINT, "CANCELLED", undefined, {
          errorCode: "REQUEST_CANCELLED",
          isRetryable: false,
          userFriendlyMessage: "Request was cancelled.",
        });
      }

      // Permanent auth/missing key errors or client errors should not be retried
      if (
        err instanceof ScraperApiKeyMissingError ||
        (err instanceof ScraperApiError &&
          (err.statusCode === 401 ||
            err.statusCode === 403 ||
            err.statusCode === 400 ||
            err.statusCode === 404 ||
            err.statusCode === 422 ||
            err.statusCode === 499))
      ) {
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      // Check for Timeout / Abort errors
      const isTimeout =
        err.name === "AbortError" ||
        err.name === "TimeoutError" ||
        err?.cause?.name === "TimeoutError" ||
        err?.cause?.name === "AbortError" ||
        err?.code === "ETIMEDOUT" ||
        err?.cause?.code === "ETIMEDOUT" ||
        String(err?.message || "").includes("ETIMEDOUT") ||
        String(err?.cause?.message || "").includes("ETIMEDOUT");

      if (isTimeout) {
        const elapsed = Date.now() - startTime;
        const timeoutMsg = sanitizeErrorMessage(
          `ScraperAPI product request timed out after ${Math.round(timeoutMs / 1000)} seconds (ETIMEDOUT).`
        );
        lastError = new ScraperApiError(timeoutMsg, 504, AMAZON_PRODUCT_ENDPOINT, "ETIMEDOUT", err, {
          errorCode: "PROVIDER_TIMEOUT",
          isRetryable: true,
          userFriendlyMessage: "Live product lookup is taking too long. Please retry.",
          elapsedMs: elapsed,
        });

        if (attempt < maxAttempts) {
          const delayMs = calculateBackoffDelay(attempt, null, timeoutMs);
          if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
        }

        scraperApiMonitor.recordError(lastError.message);
        throw lastError;
      }

      if (err instanceof ScraperApiError) {
        scraperApiMonitor.recordError(err.message);
        throw err;
      }

      // Network exception (e.g. fetch failed, ECONNRESET, ENOTFOUND)
      const elapsed = Date.now() - startTime;
      const cause = err?.cause;
      const causeDetail = cause?.message || cause?.code || "";
      const baseDetail = err?.message || "fetch failed";
      const detailStr = causeDetail ? `${baseDetail} (${causeDetail})` : baseDetail;
      const safeNetworkMsg = sanitizeErrorMessage(`ScraperAPI product network error: ${detailStr}`);

      lastError = new ScraperApiError(safeNetworkMsg, 502, AMAZON_PRODUCT_ENDPOINT, causeDetail, err, {
        errorCode: "NETWORK_ERROR",
        isRetryable: true,
        userFriendlyMessage: "Network connection to product detail service failed. Please retry.",
        elapsedMs: elapsed,
      });

      if (attempt < maxAttempts) {
        const delayMs = calculateBackoffDelay(attempt, null, timeoutMs);
        if (!options.maxTotalTimeMs || Date.now() - startTime + delayMs < options.maxTotalTimeMs) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }

      scraperApiMonitor.recordError(lastError.message);
      throw lastError;
    }
  }

  throw (
    lastError ||
    new ScraperApiError("ScraperAPI product request failed after retries.", 502, AMAZON_PRODUCT_ENDPOINT, undefined, undefined, {
      errorCode: "PRODUCT_FAILED",
      isRetryable: true,
      userFriendlyMessage: "Product detail request failed after retries. Please retry.",
      elapsedMs: Date.now() - startTime,
    })
  );
}

/**
 * Inspects the Amazon Offers endpoint for an ASIN if available in account.
 * Integrates gracefully without throwing if Offers is not supported on current subscription tier.
 */
export async function getAmazonOffersIfAvailable(
  asin: string,
  options: { timeoutMs?: number } = {}
): Promise<ScraperApiOffersResponse | null> {
  try {
    const apiKey = getScraperApiKey();
    const cleanAsin = asin.trim();

    const params = new URLSearchParams({
      api_key: apiKey,
      asin: cleanAsin,
      country_code: AMAZON_INDIA_COUNTRY_CODE,
      tld: AMAZON_INDIA_TLD,
    });

    const url = `${AMAZON_OFFERS_ENDPOINT}?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`ScraperAPI Amazon Offers not available (status ${res.status})`);
      return null;
    }

    return (await res.json()) as ScraperApiOffersResponse;
  } catch (err) {
    console.warn("ScraperAPI Amazon Offers endpoint unavailable or failed:", sanitizeErrorMessage(String(err)));
    return null;
  }
}
