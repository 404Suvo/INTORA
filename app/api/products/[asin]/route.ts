import { NextResponse } from "next/server";
import { registerCatalogProduct } from "@/lib/catalog";
import {
  formatAmazonIndiaUrl,
  getAmazonOffersIfAvailable,
  getAmazonProductDetails,
  parsePriceToPaise,
  scraperApiMonitor,
} from "@/lib/scraperapi";

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
    const { product, retrievedAt, cached } = await getAmazonProductDetails(cleanAsin);

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
    });
  } catch (err: any) {
    const message = err.message || "Failed to retrieve Amazon product details.";
    const status = message.includes("401")
      ? 401
      : message.includes("403")
      ? 403
      : message.includes("429")
      ? 429
      : 500;

    return NextResponse.json(
      {
        error: message,
        disclaimer: "ScraperAPI product request failed. No mock data substituted.",
      },
      { status }
    );
  }
}
