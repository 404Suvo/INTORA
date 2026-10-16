import { NextResponse } from "next/server";
import { registerCatalogProducts } from "@/lib/catalog";
import {
  mapSearchItemToCatalogItem,
  mapSearchItemToProductItem,
  scraperApiMonitor,
  searchAmazonIndia,
} from "@/lib/scraperapi";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || searchParams.get("query") || "";
  const category = searchParams.get("category") || undefined;
  const pageParam = searchParams.get("page");
  const page = pageParam ? parseInt(pageParam, 10) : 1;

  if (!q.trim()) {
    return NextResponse.json(
      { error: "Query parameter 'q' or 'query' is required." },
      { status: 400 }
    );
  }

  try {
    const { items, retrievedAt, cached } = await searchAmazonIndia(q, {
      page,
      category,
    });

    // Map to catalog items and register them in the dynamic catalog
    const catalogItems = items
      .map((item) => mapSearchItemToCatalogItem(item, category || "supplies", retrievedAt))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    registerCatalogProducts(catalogItems);

    // Map to ProductItem for UI consumption
    const products = items
      .map((item) => mapSearchItemToProductItem(item, category || "Amazon India", undefined, retrievedAt))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({
      query: q,
      totalReturned: items.length,
      validProductsCount: products.length,
      products,
      retrievedAt,
      cached,
      stats: scraperApiMonitor.getStats(),
      disclaimer: "Prices and stock status retrieved live from Amazon India via ScraperAPI. Prices are subject to change on Amazon.in and are not guaranteed at checkout.",
    });
  } catch (err: any) {
    const message = err.message || "Failed to search Amazon India via ScraperAPI.";
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
        disclaimer: "ScraperAPI request failed. No fabricated mock data substituted.",
      },
      { status }
    );
  }
}
