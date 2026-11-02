// Which Squeekchain contracts to read. Works in the browser and in Node.
//
// Squeekchain has redeployed before, so the addresses are NOT trusted from this file alone: they are read live from
// Squeekchain's public API (/v1/economy/state -> identities) and checked against the chain by the caller
// (SqueekNFT.mining() must equal the mining proxy). FALLBACK is only used if the API cannot be reached.

export const API_BASE_URL = "https://api.squeekchain.com";

// Current live deployment (Sepolia), used only if the API is unreachable.
export const FALLBACK = {
  nft: "0xcb98349c134ab983da5bfd80527dfe2552bdb70f",
  token: "0x5501e1fa81be1c3f49225fa7668da0245d07db60",
  mining: "0xcd46990f8349057335289ef282c276204b6cdc62",
  release: "built-in record",
};

const isAddr = (s) => typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s);

// Pure: turns the API's economy state into { nft, token, mining, release }. Throws if anything is missing or malformed.
export function parseDeployment(state) {
  const id = state?.identities;
  if (!id || typeof id !== "object") throw new Error("API answer has no identities block");
  if (!isAddr(id.token)) throw new Error("identities.token is not an address");
  if (!isAddr(id.genesis)) throw new Error("identities.genesis (the Squeek NFT) is not an address");
  if (!isAddr(id.mining?.proxy)) throw new Error("identities.mining.proxy is not an address");
  return { nft: id.genesis, token: id.token, mining: id.mining.proxy, release: state?.release?.id ?? "unknown" };
}

// Reads the live deployment from the API. Never throws: on any problem it returns the built-in record, flagged as such.
export async function loadDeployment(fetchImpl = globalThis.fetch, base = API_BASE_URL) {
  try {
    const res = await fetchImpl(`${base}/v1/economy/state`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ...parseDeployment(await res.json()), source: "api" };
  } catch (err) {
    return { ...FALLBACK, source: "fallback", reason: err.message };
  }
}
