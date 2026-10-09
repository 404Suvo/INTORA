import fs from "fs";
import path from "path";
import { network } from "hardhat";
import { BASE_SEPOLIA_CHAIN_ID } from "../lib/contract-config";

async function main() {
  console.log("Starting ShoppingIntentRegistry deployment...");

  const conn = await network.connect();
  const [deployer] = await conn.viem.getWalletClients();
  const publicClient = await conn.viem.getPublicClient();

  const chainId = await publicClient.getChainId();
  console.log(`Connected to network: ${conn.networkName} (Chain ID: ${chainId})`);
  console.log(`Deployer address: ${deployer.account.address}`);

  // Hard rule 6: Testnet only (84532 for Base Sepolia, or 31337 for local simulation)
  if (chainId !== BASE_SEPOLIA_CHAIN_ID && chainId !== 31337) {
    throw new Error(`Refusing deployment to unexpected chain ID ${chainId}. Must be Base Sepolia (84532) or local (31337).`);
  }

  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Deployer balance: ${balance.toString()} wei`);

  console.log("Deploying ShoppingIntentRegistry...");
  const registry = await conn.viem.deployContract("ShoppingIntentRegistry");
  console.log(`ShoppingIntentRegistry deployed to: ${registry.address}`);

  // Write deployed address to contracts/deployed-address.json
  const deployedConfig = {
    address: registry.address,
    chainId,
    network: conn.networkName,
    deployedAt: new Date().toISOString(),
    basescanUrl: `https://sepolia.basescan.org/address/${registry.address}`,
  };

  const outputDir = path.join(process.cwd(), "contracts");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, "deployed-address.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedConfig, null, 2), "utf8");
  console.log(`Wrote deployed address config to: ${outputPath}`);

  if (process.env.BASESCAN_API_KEY && chainId === BASE_SEPOLIA_CHAIN_ID) {
    console.log("To verify on Basescan, run:");
    console.log(`npx hardhat verify --network baseSepolia ${registry.address}`);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
