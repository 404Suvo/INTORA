import { Address, getAddress, isAddress } from "viem";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const DEFAULT_BASE_SEPOLIA_RPC = "https://sepolia.base.org";

/**
 * Human-readable ABI for ShoppingIntentRegistry contract.
 */
export const SHOPPING_INTENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "planHash", type: "bytes32" },
      { name: "version", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordVersion",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "planHash", type: "bytes32" },
      { name: "version", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelIntent",
    stateMutability: "nonpayable",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getCommitment",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [
      { name: "owner", type: "address" },
      { name: "planHash", type: "bytes32" },
      { name: "version", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "getLatestVersion",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "isIntentValid",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "IntentRecorded",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "planHash", type: "bytes32", indexed: false },
      { name: "version", type: "uint32", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VersionRecorded",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "planHash", type: "bytes32", indexed: false },
      { name: "version", type: "uint32", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentCancelled",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

/**
 * Resolves the configured contract address for Base Sepolia.
 */
export function getRegistryContractAddress(): Address {
  const envAddr =
    process.env.NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS ||
    process.env.INTENT_REGISTRY_ADDRESS;

  if (envAddr && isAddress(envAddr)) {
    return getAddress(envAddr);
  }

  try {
    // Check if deployed-address.json exists
    if (typeof window === "undefined") {
      const fs = require("fs");
      const path = require("path");
      const deployedFile = path.join(process.cwd(), "contracts", "deployed-address.json");
      if (fs.existsSync(deployedFile)) {
        const config = JSON.parse(fs.readFileSync(deployedFile, "utf8"));
        if (config.address && isAddress(config.address)) {
          return getAddress(config.address);
        }
      }
    }
  } catch {
    // Ignore in browser context
  }

  // Fallback to a zero-placeholder if not yet configured
  return "0x0000000000000000000000000000000000000000";
}
