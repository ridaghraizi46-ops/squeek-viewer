import test from "node:test";
import assert from "node:assert/strict";
import { parseDeployment, loadDeployment, FALLBACK } from "../site/deployment.js";

const NFT = "0xcb98349c134ab983da5bfd80527dfe2552bdb70f";
const TOKEN = "0x5501e1fa81be1c3f49225fa7668da0245d07db60";
const MINING = "0xcd46990f8349057335289ef282c276204b6cdc62";
const state = (over = {}) => ({
  status: "available",
  release: { id: "stream-game-sepolia-test-20261026-01" },
  identities: { token: TOKEN, genesis: NFT, mining: { proxy: MINING } },
  ...over,
});
const okFetch = (body) => async () => ({ ok: true, json: async () => body });

test("parseDeployment maps the API's identities to nft, token and mining", () => {
  assert.deepEqual(parseDeployment(state()), { nft: NFT, token: TOKEN, mining: MINING, release: "stream-game-sepolia-test-20261026-01" });
});

test("parseDeployment rejects a missing or malformed identities block", () => {
  assert.throws(() => parseDeployment({}), /identities/);
  assert.throws(() => parseDeployment(state({ identities: { token: "0x123", genesis: NFT, mining: { proxy: MINING } } })), /token/);
  assert.throws(() => parseDeployment(state({ identities: { token: TOKEN, genesis: NFT, mining: {} } })), /mining/);
});

test("loadDeployment uses the live API when it answers", async () => {
  const r = await loadDeployment(okFetch(state()));
  assert.equal(r.source, "api");
  assert.equal(r.nft, NFT);
});

test("loadDeployment falls back to the built-in record when the API fails", async () => {
  const failing = async () => { throw new Error("network down"); };
  const r = await loadDeployment(failing);
  assert.equal(r.source, "fallback");
  assert.equal(r.nft, FALLBACK.nft);
  assert.equal(r.mining, FALLBACK.mining);
});

test("loadDeployment falls back on a non-OK answer and on a malformed body", async () => {
  assert.equal((await loadDeployment(async () => ({ ok: false, status: 503 }))).source, "fallback");
  assert.equal((await loadDeployment(okFetch({ hello: "world" }))).source, "fallback");
});

test("the built-in fallback holds the current live addresses", () => {
  assert.equal(FALLBACK.nft, NFT);
  assert.equal(FALLBACK.token, TOKEN);
  assert.equal(FALLBACK.mining, MINING);
});
