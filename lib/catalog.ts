import { ProductCatalogItem } from "./types";

/**
 * Authoritative in-memory product catalog.
 * In accordance with Hard Rule 3: Never trust AI output.
 * Product IDs, prices, availability, and totals must come from the app's catalog.
 * All prices are integers in paise (INR minor units). 1 INR = 100 paise.
 */
export const PRODUCT_CATALOG: readonly ProductCatalogItem[] = [
  {
    id: "college-notebook-pack",
    name: "5-Subject Spiral Notebooks (Pack of 3)",
    category: "stationery",
    description: "High quality 300-page ruled spiral notebooks for lecture notes and project assignments.",
    priceMinor: 25000, // ₹250.00
    inStock: true,
    availableStock: 50,
    unit: "pack",
  },
  {
    id: "gel-pen-set",
    name: "Fine Gel Pens Assorted (Pack of 10)",
    category: "stationery",
    description: "0.5mm smooth black and blue ink pens for long writing sessions.",
    priceMinor: 12000, // ₹120.00
    inStock: true,
    availableStock: 100,
    unit: "pack",
  },
  {
    id: "highlighter-pack",
    name: "Pastel Chisel Highlighters (Pack of 5)",
    category: "stationery",
    description: "Non-bleeding pastel ink highlighters for textbook studying and notes revision.",
    priceMinor: 16000, // ₹160.00
    inStock: true,
    availableStock: 40,
    unit: "pack",
  },
  {
    id: "sticky-notes-pad",
    name: "Sticky Notes Color Cube (400 Sheets)",
    category: "stationery",
    description: "3x3 inch self-adhesive notes for quick reminders, page flags, and brainstorming.",
    priceMinor: 11000, // ₹110.00
    inStock: true,
    availableStock: 60,
    unit: "pad",
  },
  {
    id: "stainless-water-bottle",
    name: "Insulated Stainless Steel Bottle (750ml)",
    category: "supplies",
    description: "Double-walled vacuum insulated flask keeping water cold for 24 hours.",
    priceMinor: 45000, // ₹450.00
    inStock: true,
    availableStock: 35,
    unit: "piece",
  },
  {
    id: "energy-bar-box",
    name: "Nutty Granola Energy Bars (Box of 6)",
    category: "snacks",
    description: "Wholesome oats, almonds, and honey snack bars for long college activity days.",
    priceMinor: 30000, // ₹300.00
    inStock: true,
    availableStock: 45,
    unit: "box",
  },
  {
    id: "power-bank-10000",
    name: "10,000mAh Dual-Port Power Bank",
    category: "electronics",
    description: "Slim fast-charging external battery pack with USB-A and USB-C output.",
    priceMinor: 99900, // ₹999.00
    inStock: true,
    availableStock: 25,
    unit: "piece",
  },
  {
    id: "usb-flash-drive-64gb",
    name: "64GB High-Speed USB 3.2 Drive",
    category: "electronics",
    description: "Reliable metal keychain flash drive for presentations and lab assignments.",
    priceMinor: 49900, // ₹499.00
    inStock: true,
    availableStock: 30,
    unit: "piece",
  },
  {
    id: "college-backpack",
    name: "Water-Resistant Campus Daypack (24L)",
    category: "supplies",
    description: "Durable ergonomic backpack with padded laptop sleeve and multiple utility pockets.",
    priceMinor: 89900, // ₹899.00
    inStock: true,
    availableStock: 20,
    unit: "piece",
  },
  {
    id: "hand-sanitizer-pocket",
    name: "Pocket Hand Sanitizer Spray (Pack of 3)",
    category: "hygiene",
    description: "70% alcohol moisturizing spray with soothing aloe vera.",
    priceMinor: 9900, // ₹99.00
    inStock: true,
    availableStock: 80,
    unit: "pack",
  },
  {
    id: "mini-first-aid-kit",
    name: "Compact 20-Piece Travel First Aid Kit",
    category: "supplies",
    description: "Essential bandages, antiseptic wipes, burn gel, and tape in a travel pouch.",
    priceMinor: 22000, // ₹220.00
    inStock: true,
    availableStock: 25,
    unit: "kit",
  },
  {
    id: "electrolyte-hydration-powder",
    name: "Electrolyte Hydration Drink Mix (Pack of 6)",
    category: "snacks",
    description: "Refreshing lemon-flavored rehydration packets with essential minerals.",
    priceMinor: 15000, // ₹150.00
    inStock: true,
    availableStock: 50,
    unit: "pack",
  },
  {
    id: "wired-earphones",
    name: "Bass Boost In-Ear Earphones with Mic",
    category: "electronics",
    description: "Tangle-free 3.5mm wired earphones for study playlists and conference calls.",
    priceMinor: 34900, // ₹349.00
    inStock: true,
    availableStock: 30,
    unit: "piece",
  },
  {
    id: "id-card-lanyard-holder",
    name: "Durable Campus ID Card Badge & Lanyard",
    category: "supplies",
    description: "Transparent waterproof card holder with quick-release breakaway lanyard.",
    priceMinor: 8000, // ₹80.00
    inStock: true,
    availableStock: 100,
    unit: "piece",
  },
  {
    id: "discontinued-usb-fan",
    name: "Portable USB Desk Fan",
    category: "electronics",
    description: "Compact desk fan - currently sold out.",
    priceMinor: 19900, // ₹199.00
    inStock: false,
    availableStock: 0,
    unit: "piece",
  },
];

// Fast O(1) in-memory lookup index for test fixtures
const CATALOG_BY_ID = new Map<string, ProductCatalogItem>(
  PRODUCT_CATALOG.map((p) => [p.id, p])
);

// Dynamic registry for real Amazon India products fetched via ScraperAPI
const DYNAMIC_CATALOG_BY_ID = new Map<string, ProductCatalogItem>();

/**
 * Registers a live Amazon product fetched from ScraperAPI into the catalog registry.
 */
export function registerCatalogProduct(product: ProductCatalogItem): void {
  if (product && product.id) {
    DYNAMIC_CATALOG_BY_ID.set(product.id, product);
    if (product.asin && product.asin !== product.id) {
      DYNAMIC_CATALOG_BY_ID.set(product.asin, product);
    }
  }
}

/**
 * Batch registers live Amazon products fetched from ScraperAPI.
 */
export function registerCatalogProducts(products: ProductCatalogItem[]): void {
  for (const product of products) {
    registerCatalogProduct(product);
  }
}

/**
 * Retrieves all currently registered live Amazon products.
 */
export function getRegisteredLiveProducts(): ProductCatalogItem[] {
  return Array.from(DYNAMIC_CATALOG_BY_ID.values());
}

/**
 * Retrieves product by ID or ASIN.
 * Checks live ScraperAPI registered products first, then falls back to test fixtures.
 */
export function getProductById(id: string): ProductCatalogItem | undefined {
  if (!id) return undefined;
  // 1. Live dynamic catalog (ScraperAPI)
  const live = DYNAMIC_CATALOG_BY_ID.get(id);
  if (live) return live;

  // 2. Test fixtures fallback (for automated unit tests)
  return CATALOG_BY_ID.get(id);
}

/**
 * Searches the catalog with category filtering, stock prioritization, and multi-token keyword matching.
 * Combines live ScraperAPI products and test fixtures.
 */
export function searchCatalog(
  query: string,
  category?: string,
  options: { includeFixtures?: boolean } = {}
): ProductCatalogItem[] {
  const q = query.toLowerCase().trim();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  const pool: ProductCatalogItem[] = [];
  const liveItems = Array.from(DYNAMIC_CATALOG_BY_ID.values());
  pool.push(...liveItems);

  // Include test fixtures if dynamic catalog is empty or explicitly requested
  if (options.includeFixtures !== false || liveItems.length === 0) {
    for (const fixture of PRODUCT_CATALOG) {
      if (!DYNAMIC_CATALOG_BY_ID.has(fixture.id)) {
        pool.push(fixture);
      }
    }
  }

  return pool.filter((item) => {
    if (category && item.category !== category) return false;
    if (tokens.length === 0) return true;

    const searchableText = `${item.name} ${item.description} ${item.id} ${item.category}`.toLowerCase();
    // Matches if all query tokens appear in the searchable text
    return tokens.every((token) => searchableText.includes(token));
  });
}

/** Returns all active in-stock products */
export function getInStockProducts(): ProductCatalogItem[] {
  const pool = Array.from(DYNAMIC_CATALOG_BY_ID.values());
  if (pool.length === 0) {
    pool.push(...PRODUCT_CATALOG);
  }
  return pool.filter((item) => item.inStock && item.availableStock > 0);
}

/** Returns unique available categories */
export function getCatalogCategories(): string[] {
  const all = [...Array.from(DYNAMIC_CATALOG_BY_ID.values()), ...PRODUCT_CATALOG];
  return Array.from(new Set(all.map((p) => p.category)));
}

/** Format minor units (paise) to human-readable INR string */
export function formatInr(minor: number): string {
  const rupees = minor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

