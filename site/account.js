// Per-wallet details from Squeekchain's public API: GET /v1/accounts/<address>.
// Works in the browser and in Node. The API is for DISPLAY only: ownership and balances on the chain are the source
// of truth, and this module never throws (a failing API simply means "details unavailable").
import { API_BASE_URL } from "./deployment.js";

const big = (v) => { try { return BigInt(v ?? 0); } catch { return 0n; } };
const int = (v) => Number.parseInt(v ?? "0", 10) || 0;

// Pure: turns the API answer into a small, safe object.
export function parseAccount(json) {
  if (!json || json.status !== "available") {
    return { available: false, reason: json?.reason ?? json?.status ?? "no answer" };
  }
  return {
    available: true,
    counts: { wallet: int(json.tokenCounts?.wallet), staking: int(json.tokenCounts?.staking) },
    power: { nft: String(json.power?.nftPower ?? "0"), sqk: String(json.power?.sqkPower ?? "0") },
    stakePrincipal: big(json.stake?.principalBaseUnits),
    claimable: big(json.rewards?.claimableBaseUnits),
    tokens: (json.tokens ?? []).map((t) => ({
      tokenId: String(t.tokenId),
      custody: t.custody,
      level: t.level,
      basePower: String(t.basePower),
      mergeState: t.mergeState,
    })),
    hasMore: json.nextCursor != null,
  };
}

export async function fetchAccount(owner, fetchImpl = globalThis.fetch, base = API_BASE_URL) {
  try {
    const res = await fetchImpl(`${base}/v1/accounts/${owner}?limit=100`, { headers: { accept: "application/json" } });
    if (!res.ok) return { available: false, reason: `HTTP ${res.status}` };
    return parseAccount(await res.json());
  } catch (err) {
    return { available: false, reason: err.message };
  }
}
