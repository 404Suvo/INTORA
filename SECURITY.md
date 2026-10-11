# Security Policy

## Non-Custodial Architecture

Intora is strictly architected around a non-custodial security model:

1. **Client-Side Signatures Only**: The Gemini agent, server, and API routes **never** request, store, or manage user private keys. All blockchain state modifications require explicit user confirmation through an external wallet (e.g. MetaMask).
2. **Server-Side API Key Isolation**: The `GEMINI_API_KEY` is loaded exclusively into server-side runtime environments (`app/api/agent/route.ts` and `lib/concierge-server.ts`). It is never bundled into client JavaScript.
3. **Paise Integer Representation**: All currency amounts are represented in integer minor units (paise) to eliminate floating-point rounding errors and precision exploit vectors.
4. **Zero-Trust Pricing**: Proposed plans are cross-checked against the authoritative catalog (`lib/catalog.ts`). AI-hallucinated prices are immediately overwritten with catalog ground truth.
5. **No Direct Commerce / Escrow**: The smart contract `ShoppingIntentRegistry.sol` only stores cryptographic commitment hashes (`keccak256`). It holds no Ether, processes no payments, and handles no escrow.

## Reporting a Vulnerability

If you discover a security vulnerability within Intora:

1. **Do not create a public GitHub issue.**
2. Email your findings directly to the project maintainers or report via GitHub Security Advisories.
3. Include:
   - Description of the potential impact.
   - Steps to reproduce or proof-of-concept.
   - Any suggested mitigations.

We will review your submission and respond promptly.

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` (Base Sepolia Testnet) | ✅ Active |
