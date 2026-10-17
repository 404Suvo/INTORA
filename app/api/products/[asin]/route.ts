import { NextResponse } from "next/server";
import { registerCatalogProduct } from "@/lib/catalog";
import {
  formatAmazonIndiaUrl,
  getAmazonOffersIfAvailable,
  getAmazonProductDetails,
  parsePriceToPaise,
  scraperApiMonitor,
  ScraperApiKeyMissingError,
  ScraperApiError,
} from "@/lib/scraperapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ asin: string }> }
) {
  const { asin } = await params;
  if (!asin || !asin.trim()) {
    return NextResponse.json({ error: "ASIN parameter is required." }, { status: 400 });
  }

  const cleanAsin = asin.trim();

  try {
    const { product, retrievedAt, cached } = await getAmazonProductDetails(cleanAsin, {
      signal: req.signal,
      timeoutMs: 20000,
      maxTotalTimeMs: 25000,
    });

    // Parse pricing
    let priceResult = parsePriceToPaise(product.pricing, product.list_price?.toString());

    // If pricing is missing from the Product endpoint, inspect the Offers endpoint if available
    let offersData = null;
    if (priceResult.priceMinor === null) {
      offersData = await getAmazonOffersIfAvailable(cleanAsin);
      if (offersData?.listings && offersData.listings.length > 0) {
        const topListing = offersData.listings[0];
        priceResult = parsePriceToPaise(topListing.price, topListing.price_with_currency);
      }
    }

    const inStock =
      product.availability_status?.toLowerCase().includes("out of stock")
        ? false
        : priceResult.priceMinor !== null;

    const url = formatAmazonIndiaUrl(cleanAsin);

    // Register into catalog if price is available
    if (priceResult.priceMinor !== null) {
      registerCatalogProduct({
        id: cleanAsin,
        asin: cleanAsin,
        name: product.name || cleanAsin,
        category: product.product_category || "supplies",
        description: product.full_description || product.name || "",
        priceMinor: priceResult.priceMinor,
        inStock,
        availableStock: inStock ? 50 : 0,
        unit: "piece",
        url,
        imageUrl: product.images?.[0],
        rating: product.average_rating,
        totalReviews: product.total_reviews,
        retrievedAt,
      });
    }

    return NextResponse.json({
      asin: cleanAsin,
      name: product.name,
      brand: product.brand,
      brandUrl: product.brand_url,
      category: product.product_category,
      priceMinor: priceResult.priceMinor,
      unitPrice: priceResult.priceRupees,
      priceDisplay: priceResult.priceDisplay,
      inStock,
      availabilityStatus: product.availability_status,
      description: product.full_description,
      featureBullets: product.feature_bullets,
      images: product.images || [],
      rating: product.average_rating,
      totalReviews: product.total_reviews,
      url,
      retrievedAt,
      cached,
      stats: scraperApiMonitor.getStats(),
      disclaimer:
        "Prices and product details retrieved live from Amazon India via ScraperAPI. Prices are subject to change on Amazon.in and are not guaranteed at checkout.",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    const rawMessage = err?.message || "Failed to retrieve Amazon product details.";
    const isMissingKey =
      err instanceof ScraperApiKeyMissingError ||
      err?.errorCode === "SCRAPERAPI_KEY_MISSING" ||
      err?.statusCode === 503 ||
      rawMessage.includes("SCRAPERAPI_KEY");

    const status = isMissingKey
      ? 503
      : err instanceof ScraperApiError
      ? err.statusCode
      : rawMessage.includes("401")
      ? 401
      : rawMessage.includes("403")
      ? 403
      : rawMessage.includes("429")
      ? 429
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: rawMessage,
        errorCode: isMissingKey ? "SCRAPERAPI_KEY_MISSING" : err?.errorCode || "PRODUCT_FAILED",
        isRetryable: isMissingKey ? false : err?.isRetryable ?? true,
        userFriendlyMessage: isMissingKey
          ? "Product search service is temporarily unconfigured. Please configure SCRAPERAPI_KEY in the backend environment."
          : err?.userFriendlyMessage || rawMessage,
        hint: isMissingKey
          ? "Add SCRAPERAPI_KEY to your .env file for local development, or configure SCRAPERAPI_KEY in Vercel Environment Variables and redeploy."
          : undefined,
        disclaimer: "ScraperAPI product request failed. No mock data substituted.",
      },
      { status }
    );
  }
}
