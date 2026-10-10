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
 * Canonical evidence sink address on Ethereum / Base networks.
 * Used for zero-value evidence anchoring when no dedicated contract is deployed
 * or to prevent MetaMask internal account collision errors.
 */
export const EVIDENCE_SINK_ADDRESS: Address = "0x000000000000000000000000000000000000dEaD";

/**
 * Resolves the configured contract address for Base Sepolia.
 * If sender is specified and matches the target address (or if target is an internal account),
 * routes safely to EVIDENCE_SINK_ADDRESS to prevent MetaMask error:
 * "External transactions to internal accounts cannot include data".
 */
export function getRegistryContractAddress(sender?: string | null): Address {
  const envAddr =
    process.env.NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS ||
    process.env.INTENT_REGISTRY_ADDRESS;

  let targetAddr: Address = "0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3";

  if (envAddr && isAddress(envAddr)) {
    targetAddr = getAddress(envAddr);
  } else {
    try {
      // Check if deployed-address.json exists
      if (typeof window === "undefined") {
        const fs = require("fs");
        const path = require("path");
        const deployedFile = path.join(process.cwd(), "contracts", "deployed-address.json");
        if (fs.existsSync(deployedFile)) {
          const config = JSON.parse(fs.readFileSync(deployedFile, "utf8"));
          if (config.address && isAddress(config.address)) {
            targetAddr = getAddress(config.address);
          }
        }
      }
    } catch {
      // Ignore in browser context
    }
  }

  // Prevent self-call / internal account error in MetaMask
  if (sender && targetAddr.toLowerCase() === sender.toLowerCase()) {
    return EVIDENCE_SINK_ADDRESS;
  }

  return targetAddr;
}

export const INTENT_REGISTRY_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS && isAddress(process.env.NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS))
    ? getAddress(process.env.NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS)
    : "0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3";


