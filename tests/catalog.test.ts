import { describe, it } from "node:test";
import assert from "node:assert";
import {
  PRODUCT_CATALOG,
  getProductById,
  searchCatalog,
  getInStockProducts,
  getCatalogCategories,
  formatInr,
} from "../lib/catalog";

describe("Catalog & Indexing Verification", () => {
  it("has non-empty catalog with strictly positive integer prices", () => {
    assert.ok(PRODUCT_CATALOG.length > 0, "Catalog should have items");
    for (const item of PRODUCT_CATALOG) {
      assert.strictEqual(typeof item.id, "string");
      assert.ok(item.id.length > 0);
      assert.strictEqual(Number.isInteger(item.priceMinor), true);
      assert.ok(item.priceMinor > 0);
      assert.strictEqual(typeof item.inStock, "boolean");
      assert.ok(item.availableStock >= 0);
    }
  });

  it("retrieves product by id via O(1) map index", () => {
    const notebook = getProductById("college-notebook-pack");
    assert.ok(notebook !== undefined);
    assert.strictEqual(notebook?.priceMinor, 25000);

    const nonExistent = getProductById("non-existent-product-id-xyz");
    assert.strictEqual(nonExistent, undefined);
  });

  it("filters products by multi-token search terms", () => {
    const results = searchCatalog("spiral notebooks");
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].id, "college-notebook-pack");

    const empty = searchCatalog("quantum-teleporter-impossible");
    assert.strictEqual(empty.length, 0);
  });

  it("filters products by category correctly", () => {
    const stationery = searchCatalog("", "stationery");
    assert.ok(stationery.length > 0);
    assert.ok(stationery.every((i) => i.category === "stationery"));

    const electronics = searchCatalog("", "electronics");
    assert.ok(electronics.length > 0);
    assert.ok(electronics.every((i) => i.category === "electronics"));
  });

  it("filters in-stock products accurately", () => {
    const inStock = getInStockProducts();
    assert.ok(inStock.length > 0);
    assert.ok(inStock.every((i) => i.inStock && i.availableStock > 0));

    // Ensure out of stock item is excluded
    const discontinued = inStock.find((i) => i.id === "discontinued-usb-fan");
    assert.strictEqual(discontinued, undefined);
  });

  it("returns distinct catalog categories", () => {
    const categories = getCatalogCategories();
    assert.ok(categories.includes("stationery"));
    assert.ok(categories.includes("electronics"));
    assert.ok(categories.includes("supplies"));
    assert.ok(categories.includes("snacks"));
  });

  it("formats integer paise to Indian Rupee strings accurately", () => {
    const formatted3000 = formatInr(300000);
    assert.ok(formatted3000.includes("3,000") || formatted3000.includes("3000"));

    const formattedZero = formatInr(0);
    assert.ok(formattedZero.includes("0.00"));
  });
});
