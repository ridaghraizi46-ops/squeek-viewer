// squeek-viewer (web): read-only lookup of a wallet's Squeeks and SQK on Squeekchain (Sepolia testnet).
// Runs in the browser. It only reads public data over RPC: no wallet connection, no signing, no keys.

import { loadDeployment } from "./deployment.js";
import { fetchAccount } from "./account.js";

export const CHAIN_ID = 11155111;
export const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const SEL = {
  balanceOf: "0x70a08231",
  totalSupply: "0x18160ddd",
  mining: "0x662fac39",
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
};

export const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
const word = (addr) => addr.slice(2).toLowerCase().padStart(64, "0");
const toBig = (hex) => BigInt(hex);

function decodeString(hex) {
  const bytes = hex.slice(2);
  const len = Number(BigInt("0x" + bytes.slice(64, 128)));
  const data = bytes.slice(128, 128 + len * 2);
  return decodeURIComponent(data.replace(/../g, "%$&"));
}

export function formatUnits(value, decimals) {
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export async function lookup(owner) {
  if ((await rpc("eth_chainId", [])) !== "0x" + CHAIN_ID.toString(16)) throw new Error("RPC is not Sepolia");

  // Which contracts to read: Squeekchain's live deployment (it has redeployed before), with a built-in fallback.
  const deployment = await loadDeployment();
  const { nft: NFT, token: SQK, mining: MINING } = deployment;

  // Sanity check against the chain itself: the NFT contract must point at the mining contract of that deployment.
  const mining = "0x" + (await call(NFT, SEL.mining)).slice(-40);
  if (mining.toLowerCase() !== MINING.toLowerCase()) {
    throw new Error("Deployment mismatch: SqueekNFT.mining() differs from the deployment record. Stopping.");
  }

  const [squeeks, supply, sqk, decimals, symbol] = await Promise.all([
    call(NFT, SEL.balanceOf + word(owner)),
    call(NFT, SEL.totalSupply),
    call(SQK, SEL.balanceOf + word(owner)),
    call(SQK, SEL.decimals),
    call(SQK, SEL.symbol),
  ]);
  const dec = Number(toBig(decimals));
  const account = await fetchAccount(owner); // display-only details; never throws
  return {
    account: account.available
      ? {
          staked: `${account.counts.staking} staked, ${account.counts.wallet} in wallet`,
          power: `NFT ${account.power.nft} + SQK ${account.power.sqk}`,
          claimable: formatUnits(account.claimable, dec),
          tokens: account.tokens,
          hasMore: account.hasMore,
        }
      : { unavailable: account.reason },
    owner,
    squeeks: toBig(squeeks),
    supply: toBig(supply),
    sqk: formatUnits(toBig(sqk), dec),
    symbol: decodeString(symbol),
    deployment: deployment.source === "api" ? `live from Squeekchain (${deployment.release})` : "built-in record (API unreachable)",
  };
}

if (typeof document !== "undefined") {
  const form = document.getElementById("form");
  const input = document.getElementById("address");
  const out = document.getElementById("result");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const addr = input.value.trim();
    out.className = "";
    if (!isAddress(addr)) {
      out.textContent = "That does not look like a wallet address (0x followed by 40 characters).";
      out.className = "error";
      return;
    }
    out.textContent = "Looking up…";
    try {
      const r = await lookup(addr);
      out.textContent = "";
      const rows = [
        ["Wallet", r.owner],
        ["Squeeks owned", `${r.squeeks} (of ${r.supply} in existence)`],
        [`${r.symbol} balance`, r.sqk],
        ["Contracts", r.deployment],
      ];
      if (r.account.unavailable) {
        rows.push(["Details", `unavailable (${r.account.unavailable})`]);
      } else {
        rows.push(["Squeeks", r.account.staked], ["Power", r.account.power], [`Claimable ${r.symbol}`, r.account.claimable]);
        for (const t of r.account.tokens) rows.push([`Squeek #${t.tokenId}`, `level ${t.level}, base power ${t.basePower} (${t.custody})`]);
        if (r.account.hasMore) rows.push(["More", "more Squeeks exist than shown"]);
      }
      const dl = document.createElement("dl");
      for (const [k, v] of rows) {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = k;
        dd.textContent = v;
        dl.append(dt, dd);
      }
      out.append(dl);
    } catch (err) {
      out.textContent = `Lookup failed: ${err.message}`;
      out.className = "error";
    }
  });
}
