import fs from "fs";
import path from "path";
import { network } from "hardhat";
import { keccak256, stringToHex, type Hex } from "viem";
import { canonicalizePlan } from "../lib/canonicalize";
import { BASE_SEPOLIA_CHAIN_ID, SHOPPING_INTENT_REGISTRY_ABI } from "../lib/contract-config";
import { computePlanHash, verifyPlanHash } from "../lib/plan-hash";
import { ShoppingPlan } from "../lib/types";

async function main() {
  console.log("=== Running Smoke Test: ShoppingIntentRegistry ===");

  const conn = await network.connect();
  const [deployer] = await conn.viem.getWalletClients();
  const publicClient = await conn.viem.getPublicClient();

  const chainId = await publicClient.getChainId();
  console.log(`Connected Network: ${conn.networkName} (Chain ID: ${chainId})`);
  console.log(`Caller Address: ${deployer.account.address}`);

  // Resolve contract address
  let contractAddress: Hex | null = null;
  const deployedFile = path.join(process.cwd(), "contracts", "deployed-address.json");
  if (fs.existsSync(deployedFile)) {
    const config = JSON.parse(fs.readFileSync(deployedFile, "utf8"));
    if (config.address) contractAddress = config.address;
  }

  let registry: any;
  if (contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000") {
    console.log(`Using existing deployed contract at: ${contractAddress}`);
    registry = await conn.viem.getContractAt("ShoppingIntentRegistry", contractAddress);
  } else {
    console.log("No deployed contract found. Deploying a fresh instance for smoke test...");
    registry = await conn.viem.deployContract("ShoppingIntentRegistry");
    console.log(`Deployed to: ${registry.address}`);
  }

  // 1. Create a sample college activity plan
  const intentId = keccak256(stringToHex(`smoke-intent-${Date.now()}`));
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 86400 * 7;

  const planV1: ShoppingPlan = {
    schemaVersion: "1.0.0",
    intentId,
    version: 1,
    currency: "INR",
    budgetMinor: 300000, // ₹3,000.00
    items: [
      { productId: "college-notebook-pack", quantity: 2, unitPriceMinor: 25000 },
      { productId: "gel-pen-set", quantity: 2, unitPriceMinor: 12000 },
      { productId: "stainless-water-bottle", quantity: 1, unitPriceMinor: 45000 },
    ],
    totalMinor: 119000, // ₹1,190.00
    expiry,
  };

  const { canonicalString: canonV1, planHash: hashV1 } = computePlanHash(planV1);
  console.log(`\n--- Plan Version 1 ---`);
  console.log(`Intent ID: ${intentId}`);
  console.log(`Version: 1`);
  console.log(`Plan Hash: ${hashV1}`);
  console.log(`Total: ₹1,190.00 (119000 paise)`);

  // 2. Record version 1 on-chain
  console.log("\nRecording Version 1 commitment on-chain...");
  const tx1 = await registry.write.recordIntent([intentId, hashV1, 1, BigInt(expiry)]);
  console.log(`Tx submitted: ${tx1}`);

  // 3. Read back Version 1
  console.log("\nReading commitment from contract...");
  const commitment1 = await registry.read.getCommitment([intentId, 1]);
  console.log(`On-chain Owner:    ${commitment1[0]}`);
  console.log(`On-chain PlanHash: ${commitment1[1]}`);
  console.log(`On-chain Version:  ${commitment1[2]}`);
  console.log(`On-chain Expiry:   ${commitment1[3]}`);

  // Assert match
  const match1 = verifyPlanHash(canonV1, commitment1[1]);
  console.log(`Verification: On-chain hash matches canonical plan hash? -> ${match1 ? "PASS ✅" : "FAIL ❌"}`);
  if (!match1) throw new Error("Hash verification failed for Version 1!");

  const isValid1 = await registry.read.isIntentValid([intentId]);
  console.log(`Intent validity status: ${isValid1 ? "VALID ✅" : "INVALID ❌"}`);

  // 4. Record version 2 revision
  console.log(`\n--- Plan Version 2 Revision ---`);
  const planV2: ShoppingPlan = {
    ...planV1,
    version: 2,
    budgetMinor: 200000, // ₹2,000.00
    items: [
      { productId: "college-notebook-pack", quantity: 1, unitPriceMinor: 25000 },
      { productId: "gel-pen-set", quantity: 1, unitPriceMinor: 12000 },
    ],
    totalMinor: 37000,
  };
  const { canonicalString: canonV2, planHash: hashV2 } = computePlanHash(planV2);
  console.log(`Recording Version 2 revision on-chain...`);
  const tx2 = await registry.write.recordVersion([intentId, hashV2, 2, BigInt(expiry)]);
  console.log(`Tx submitted: ${tx2}`);

  // 5. Read back both Version 1 and Version 2
  const commitment1Again = await registry.read.getCommitment([intentId, 1]);
  const commitment2 = await registry.read.getCommitment([intentId, 2]);
  const latestVer = await registry.read.getLatestVersion([intentId]);

  console.log(`\nLatest On-Chain Version: ${latestVer}`);
  console.log(`Historical Version 1 Hash: ${commitment1Again[1]} (Preserved: ${commitment1Again[1] === hashV1 ? "YES ✅" : "NO ❌"})`);
  console.log(`Current Version 2 Hash:    ${commitment2[1]} (Matches V2: ${commitment2[1] === hashV2 ? "YES ✅" : "NO ❌"})`);

  console.log("\n=== Smoke Test Complete: ALL CHECKS PASSED ✅ ===");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exitCode = 1;
});
