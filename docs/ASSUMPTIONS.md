# System Assumptions: Intent-to-Commerce

## 1. Project Base and Catalog
- The original repository was an `agentmaxxin` starter kit with Next.js (App Router, React 19, TypeScript), `@google/genai` (v2.24.0), and `viem`.
- No existing commerce product catalog existed in the template. An authoritative, realistic catalog of student supplies, electronics, and daily essentials has been established in `lib/catalog.ts`.
- Every product contains `id`, `name`, `category`, `description`, `priceMinor` (in INR paise, 1 INR = 100 paise), and `inStock` (boolean & quantity).

## 2. Currency and Minor Units
- Currency is strictly `"INR"`.
- All monetary values are integers representing paise. No floating-point values are ever permitted in plans, calculations, canonical representations, or hash inputs.
- Display formats convert paise to rupees for UI display (e.g. `300000 paise -> ₹3,000.00`), while raw data models and hashes use integer minor units.

## 3. Plan Canonicalization & Hashing
- Canonical serialization follows strict deterministic JSON format:
  - Alphabetically sorted keys at all levels (`budgetMinor`, `currency`, `expiry`, `intentId`, `items`, `schemaVersion`, `totalMinor`, `version`).
  - Items sorted deterministically by `productId` ascending.
  - Duplicate product IDs in items are merged with summed quantities prior to canonicalization.
  - Zero extraneous whitespace.
  - Amounts safely encoded within JSON number specifications.
- Plan hash is computed as `keccak256(toHex(canonicalUtf8String))`.
- Salt is optional and disabled by default (`SALT_ENABLED=false`). When enabled, a 32-byte hex salt is appended to the plan metadata off-chain.

## 4. Blockchain & Contract Constraints
- Target network: Base Sepolia testnet only (`chainId: 84532`).
- Contract: `ShoppingIntentRegistry.sol` deployed on Base Sepolia.
- Revising an intent (`recordVersion`) whose previous version has reached expiry is explicitly permitted because expiry bounds the commitment lifespan of that version, but does not invalidate the user's authority to propose and commit an amended plan version.
- Cancellation (`cancelIntent`) permanently prevents any future version recordings under that `intentId`.

## 5. Storage & Privacy
- On-chain storage records only `(intentId, version) => (planHash, expiry, owner)`.
- Full off-chain plans are persisted server-side in `data/plans.json` with a backup in client `localStorage`.
- Notice displayed: "This records a commitment to your approved plan. It does not place an order."
