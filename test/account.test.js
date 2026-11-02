import test from "node:test";
import assert from "node:assert/strict";
import { parseAccount, fetchAccount } from "../site/account.js";

const sample = (over = {}) => ({
  status: "available",
  account: "0x598958abf7d8db8dd468cb53dd6ba705581bff54",
  rewards: { claimableBaseUnits: "2500000000000000000", lifetimePaidBaseUnits: "0" },
  power: { nftPower: "7000", sqkPower: "30" },
  stake: { principalBaseUnits: "10000000000000000000000", freshBaseUnits: "0" },
  tokenCounts: { staking: "1", wallet: "2" },
  tokens: [
    { tokenId: "1", custody: "wallet", level: 1, basePower: "1000", mergeState: "ready" },
    { tokenId: "7", custody: "staking", level: 3, basePower: "4840", mergeState: "cooldown" },
  ],
  nextCursor: null,
  ...over,
});

test("parseAccount extracts squeeks, counts, power, stake and claimable rewards", () => {
  const a = parseAccount(sample());
  assert.equal(a.available, true);
  assert.deepEqual(a.counts, { wallet: 2, staking: 1 });
  assert.deepEqual(a.power, { nft: "7000", sqk: "30" });
  assert.equal(a.stakePrincipal, 10000000000000000000000n);
  assert.equal(a.claimable, 2500000000000000000n);
  assert.deepEqual(a.tokens[1], { tokenId: "7", custody: "staking", level: 3, basePower: "4840", mergeState: "cooldown" });
  assert.equal(a.hasMore, false);
});

test("parseAccount handles a wallet with no Squeeks", () => {
  const a = parseAccount(sample({ tokens: [], tokenCounts: { staking: "0", wallet: "0" }, rewards: { claimableBaseUnits: "0" } }));
  assert.equal(a.tokens.length, 0);
  assert.deepEqual(a.counts, { wallet: 0, staking: 0 });
  assert.equal(a.claimable, 0n);
});

test("parseAccount flags more pages when the API returns a cursor", () => {
  assert.equal(parseAccount(sample({ nextCursor: "abc" })).hasMore, true);
});

test("parseAccount reports unavailable when the API says so", () => {
  const a = parseAccount({ status: "unavailable", reason: "indexer catching up" });
  assert.equal(a.available, false);
  assert.match(a.reason, /indexer catching up/);
});

test("fetchAccount returns the parsed account on success", async () => {
  const f = async (url) => { assert.match(String(url), /\/v1\/accounts\/0x598958abf7d8db8dd468cb53dd6ba705581bff54/i); return { ok: true, json: async () => sample() }; };
  const a = await fetchAccount("0x598958abf7d8db8dd468cb53dd6ba705581bff54", f);
  assert.equal(a.available, true);
  assert.equal(a.tokens.length, 2);
});

test("fetchAccount never throws: a failing API becomes available:false with a reason", async () => {
  assert.equal((await fetchAccount("0x598958abf7d8db8dd468cb53dd6ba705581bff54", async () => { throw new Error("offline"); })).available, false);
  const r = await fetchAccount("0x598958abf7d8db8dd468cb53dd6ba705581bff54", async () => ({ ok: false, status: 404 }));
  assert.equal(r.available, false);
  assert.match(r.reason, /404/);
});
