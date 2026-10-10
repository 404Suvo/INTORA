# System Assumptions & Non-Negotiable Rules Compliance

This document records the core assumptions, constraints, and explicit compliance status for the **Intent-to-Commerce** project.

---

## 1. Compliance with Non-Negotiable Rules

| # | Rule | Status | Implementation Details |
|---|------|--------|------------------------|
| **1** | **Gemini API key lives server-side only** | **ENFORCED** | The `GEMINI_API_KEY` is loaded exclusively within server-side endpoints (`app/api/agent/route.ts` and `agent/agent.ts`). It is never referenced in client components (`"use client"`) and never logged to stdout or client telemetry. |
| **2** | **Never ask for, store, or print seed phrase or private key** | **ENFORCED** | Private keys are never accepted in UI inputs or agent prompts. Only `.env` (git-ignored) holds a throwaway deployer key for Base Sepolia testnet. `.env` is never printed or included in chat/artifacts. |
| **3** | **AI agent never signs or sends transactions** | **ENFORCED** | The agent and server only compute validation, canonicalization, and ABI-encoded calldata (`prepare_transaction`). All transactions require explicit user approval and signature via MetaMask (`eth_sendTransaction`). |
| **4** | **Never trust model output** | **ENFORCED** | AI model suggestions are treated as untrusted candidates. Product IDs, prices, and stock availability are strictly looked up in `lib/catalog.ts`. Hallucinated prices are detected, flagged, and overwritten with catalog values. Totals are recomputed in code. |
| **5** | **All money is integer minor units (paise)** | **ENFORCED** | Currency is strictly `"INR"`. All monetary calculations, schemas, and canonical JSON strings use integer paise (`1 INR = 100 paise`). Floating-point numbers are rejected by Zod validators. Values that may exceed $2^{53}$ are handled safely. |
| **6** | **Testnet only (Base Sepolia, chainId 84532)** | **ENFORCED** | Strict check for Chain ID `84532`. Transactions and RPC queries check the chain ID before proceeding. Network mismatch warning and "Switch to Base Sepolia" are prompted in MetaMask. |
| **7** | **No purchases, payments, or escrow** | **ENFORCED** | The platform explicitly disclaims commerce execution. The UI and calldata outputs display: *"This records a commitment to your approved plan. It does not place an order."* The hash proves canonical plan integrity, not authenticity, inventory, seller reliability, payment, or delivery. |
| **8** | **Scope strictly limited to SPEC.md Sections 1–18** | **ENFORCED** | Sections 19–20 (seller counter-signatures, order execution lifecycle, Midnight privacy proofs, Stellar payments, and loyalty rewards) are future scope and have not been implemented. |
| **9** | **Extend existing app without rebuilding** | **ENFORCED** | Built by extending the existing Next.js App Router codebase, `@google/genai` agent server, and `viem` integrations without replacing framework foundations. |
| **10** | **Phase completion protocol** | **ENFORCED** | All 34 automated unit, integration, and contract tests pass before concluding any phase. Assumptions are documented here for user review. |

---

## 2. Catalog & Currency Assumptions
- **Authoritative Catalog**: Defined in [catalog.ts](file:///c:/Users/jitsu/OneDrive/Desktop/my-agent_suvo/lib/catalog.ts). Every product has `id`, `name`, `category`, `description`, `priceMinor` (in paise), and `inStock` / `availableStock`.
- **Currency**: Indian Rupees (`"INR"`). Display strings format paise as rupees (e.g., `248900 paise -> ₹2,489.00`).
- **Total Calculation**: Strictly calculated as `sum(unitPriceMinor * quantity)` across normalized items.

---

## 3. Plan Canonicalization & Hashing Assumptions
- **Canonical Ordering**:
  - Keys sorted alphabetically: `budgetMinor`, `currency`, `expiry`, `intentId`, `items`, `schemaVersion`, `totalMinor`, `version`.
  - Items sorted deterministically by `productId` ascending.
  - Duplicate `productId` entries are merged and their quantities summed before validation and canonicalization.
  - Zero extraneous whitespace.
- **Hash Computation**: `keccak256(toHex(canonicalUtf8String))`.
- **Salting (Privacy)**: Optional and disabled by default (`NEXT_PUBLIC_ENABLE_SALT=false`). When enabled, a 32-byte hex salt is appended to prevent brute-forcing of low-entropy plans.

---

## 4. Blockchain & Smart Contract Assumptions
- **Target Network**: Base Sepolia (`chainId: 84532`).
- **Contract**: [ShoppingIntentRegistry.sol](file:///c:/Users/jitsu/OneDrive/Desktop/my-agent_suvo/contracts/ShoppingIntentRegistry.sol).
- **Versioning**:
  - Initial commitment is recorded with `recordIntent` (`version = 1`).
  - Subsequent amendments use `recordVersion` with `version = latestVersion + 1`, preserving the same `intentId`.
  - Revising an expired version is permitted because expiry bounds the commitment validity window of that specific version, not the user's ownership of the intent.
  - Historical versions remain permanently readable and immutable on-chain.
- **Cancellation**: Calling `cancelIntent` by the owner permanently blocks future revisions under that `intentId`.
- **Zero-Value Checks**: `bytes32(0)` for `intentId` or `planHash` reverts with custom errors.

---

## 5. Scope Boundary (Sections 1–18 vs 19–20)
- **Included (Sections 1–18)**:
  - Natural language intent parsing and budget extraction.
  - Controlled catalog searching and bundle optimization.
  - Independent validation, price overwrite, and total recomputation.
  - Canonical JSON serialization and keccak256 hashing.
  - Calldata preparation for MetaMask approval.
  - Base Sepolia smart contract deployment and version recording.
  - Off-chain storage and dual-source read-back verification (on-chain vs off-chain hash comparison).
  - Version revision flow preserving `intentId` with diff summary.
- **Excluded Future Scope (Sections 19–20)**:
  - Seller order counter-signatures.
  - Order fulfillment, escrow, payment, and refund lifecycle.
  - Midnight ZK-privacy proofs.
  - Stellar anchor integration.
  - Rewards and loyalty tokens.
