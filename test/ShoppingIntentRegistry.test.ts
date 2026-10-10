import assert from "node:assert";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, stringToHex, type Hex } from "viem";

describe("Phase 3: ShoppingIntentRegistry Contract", async () => {
  const dummyIntentId = keccak256(stringToHex("test-intent-1"));
  const dummyPlanHash1 = keccak256(stringToHex("canonical-plan-v1"));
  const dummyPlanHash2 = keccak256(stringToHex("canonical-plan-v2"));
  const zeroBytes32: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

  async function deployFixture() {
    const conn = await network.connect();
    const registry = await conn.viem.deployContract("ShoppingIntentRegistry");
    const [ownerClient, otherClient] = await conn.viem.getWalletClients();
    const publicClient = await conn.viem.getPublicClient();
    const block = await publicClient.getBlock();
    const now = Number(block.timestamp);
    const validExpiry = BigInt(now + 86400 * 7); // 7 days ahead

    return { conn, registry, ownerClient, otherClient, publicClient, now, validExpiry };
  }

  it("records first version (version 1) successfully", async () => {
    const { registry, ownerClient, validExpiry } = await deployFixture();

    const hash = await registry.write.recordIntent([
      dummyIntentId,
      dummyPlanHash1,
      1,
      validExpiry,
    ]);
    assert.ok(hash);

    const latest = await registry.read.getLatestVersion([dummyIntentId]);
    assert.strictEqual(latest, 1);

    const isValid = await registry.read.isIntentValid([dummyIntentId]);
    assert.strictEqual(isValid, true);

    const commitment: any = await registry.read.getCommitment([dummyIntentId, 1]);
    assert.strictEqual(commitment[0].toLowerCase(), ownerClient.account.address.toLowerCase());
    assert.strictEqual(commitment[1], dummyPlanHash1);
    assert.strictEqual(commitment[2], 1);
    assert.strictEqual(commitment[3], validExpiry);
  });

  it("rejects invalid first version (version != 1)", async () => {
    const { registry, validExpiry } = await deployFixture();

    await assert.rejects(async () => {
      await registry.write.recordIntent([
        dummyIntentId,
        dummyPlanHash1,
        2, // invalid: first version must be 1
        validExpiry,
      ]);
    });
  });

  it("rejects duplicate recordIntent for the same intentId", async () => {
    const { registry, validExpiry } = await deployFixture();

    await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, validExpiry]);

    await assert.rejects(async () => {
      await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, validExpiry]);
    });
  });

  it("records sequential versions and preserves historical versions", async () => {
    const { registry, validExpiry } = await deployFixture();

    await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, validExpiry]);

    const expiryV2 = validExpiry + 3600n;
    await registry.write.recordVersion([dummyIntentId, dummyPlanHash2, 2, expiryV2]);

    const latest = await registry.read.getLatestVersion([dummyIntentId]);
    assert.strictEqual(latest, 2);

    // Verify version 1 is intact
    const v1Commitment: any = await registry.read.getCommitment([dummyIntentId, 1]);
    assert.strictEqual(v1Commitment[1], dummyPlanHash1);
    assert.strictEqual(v1Commitment[2], 1);

    // Verify version 2 is recorded
    const v2Commitment: any = await registry.read.getCommitment([dummyIntentId, 2]);
    assert.strictEqual(v2Commitment[1], dummyPlanHash2);
    assert.strictEqual(v2Commitment[2], 2);
    assert.strictEqual(v2Commitment[3], expiryV2);
  });

  it("rejects skipped versions (e.g. version 3 when latest is 1)", async () => {
    const { registry, validExpiry } = await deployFixture();

    await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, validExpiry]);

    await assert.rejects(async () => {
      await registry.write.recordVersion([dummyIntentId, dummyPlanHash2, 3, validExpiry]);
    });
  });

  it("rejects non-owner modifications", async () => {
    const { conn, registry, otherClient, validExpiry } = await deployFixture();

    await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, validExpiry]);

    const otherRegistry = await conn.viem.getContractAt(
      "ShoppingIntentRegistry",
      registry.address,
      { client: { wallet: otherClient } }
    );

    // Other account attempts recordVersion -> rejected
    await assert.rejects(async () => {
      await otherRegistry.write.recordVersion([dummyIntentId, dummyPlanHash2, 2, validExpiry]);
    });

    // Other account attempts cancelIntent -> rejected
    await assert.rejects(async () => {
      await otherRegistry.write.cancelIntent([dummyIntentId]);
    });
  });

  it("rejects expired expiry timestamps", async () => {
    const { registry, now } = await deployFixture();
    const expiredTimestamp = BigInt(now - 100);

    await assert.rejects(async () => {
      await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, expiredTimestamp]);
    });
  });

  it("cancels intent and permanently blocks future revisions", async () => {
    const { registry, validExpiry } = await deployFixture();

    await registry.write.recordIntent([dummyIntentId, dummyPlanHash1, 1, validExpiry]);
    assert.strictEqual(await registry.read.isIntentValid([dummyIntentId]), true);

    await registry.write.cancelIntent([dummyIntentId]);
    assert.strictEqual(await registry.read.isIntentValid([dummyIntentId]), false);

    // Re-recording a version must fail
    await assert.rejects(async () => {
      await registry.write.recordVersion([dummyIntentId, dummyPlanHash2, 2, validExpiry]);
    });

    // Cancelling an already cancelled intent must fail
    await assert.rejects(async () => {
      await registry.write.cancelIntent([dummyIntentId]);
    });
  });

  it("handles zero-value rejections properly", async () => {
    const { registry, validExpiry } = await deployFixture();

    // Zero intentId
    await assert.rejects(async () => {
      await registry.write.recordIntent([zeroBytes32, dummyPlanHash1, 1, validExpiry]);
    });

    // Zero planHash
    await assert.rejects(async () => {
      await registry.write.recordIntent([dummyIntentId, zeroBytes32, 1, validExpiry]);
    });
  });

  it("validates queries for non-existent intents or versions", async () => {
    const { registry } = await deployFixture();
    const nonExistentId = keccak256(stringToHex("non-existent"));

    assert.strictEqual(await registry.read.getLatestVersion([nonExistentId]), 0);
    assert.strictEqual(await registry.read.isIntentValid([nonExistentId]), false);

    await assert.rejects(async () => {
      await registry.read.getCommitment([nonExistentId, 1]);
    });
  });
});
