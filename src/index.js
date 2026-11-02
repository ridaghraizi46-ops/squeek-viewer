// squeek-viewer: read-only lookup of a wallet's Squeeks and SQK on Squeekchain (Sepolia testnet).
// Usage: node src/index.js 0xYourAddress
// Nothing is signed or sent, and no private key is ever needed.
import { createPublicClient, http, parseAbi, formatUnits, getAddress, isAddress } from "viem";

import { loadDeployment } from "../site/deployment.js";
import { fetchAccount } from "../site/account.js";

const CHAIN_ID = 11155111;

const RPC_URL = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.squeekchain.com";

const nftAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function mining() view returns (address)",
  "function totalSupply() view returns (uint256)",
]);
const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

const input = process.argv[2];
if (!input || !isAddress(input)) {
  console.error("Usage: node src/index.js 0xYourAddress");
  process.exit(1);
}
const owner = getAddress(input);

const client = createPublicClient({ transport: http(RPC_URL) });
if ((await client.getChainId()) !== CHAIN_ID) throw new Error("RPC is not Sepolia");

// Which contracts to read: Squeekchain's live deployment (it has redeployed before), with a built-in fallback.
const deployment = await loadDeployment(globalThis.fetch, API_BASE_URL);
const { nft: NFT, token: SQK, mining: MINING } = deployment;

// Sanity check: the NFT contract must point at the mining contract of that deployment. This is checked against the
// chain itself, so a wrong or stale record can never be trusted silently.
const miningOnChain = await client.readContract({ address: NFT, abi: nftAbi, functionName: "mining" });
if (miningOnChain.toLowerCase() !== MINING.toLowerCase()) {
  throw new Error("Deployment mismatch: NFT.mining() differs from the deployment record. Stopping.");
}
console.log(
  deployment.source === "api"
    ? `Deployment:    live from Squeekchain (${deployment.release})`
    : `Deployment:    built-in record (Squeekchain API unreachable: ${deployment.reason})`,
);

const [squeeks, supply, sqkRaw, decimals, symbol] = await Promise.all([
  client.readContract({ address: NFT, abi: nftAbi, functionName: "balanceOf", args: [owner] }),
  client.readContract({ address: NFT, abi: nftAbi, functionName: "totalSupply" }),
  client.readContract({ address: SQK, abi: tokenAbi, functionName: "balanceOf", args: [owner] }),
  client.readContract({ address: SQK, abi: tokenAbi, functionName: "decimals" }),
  client.readContract({ address: SQK, abi: tokenAbi, functionName: "symbol" }),
]);

console.log(`Wallet:        ${owner}`);
console.log(`Squeeks owned: ${squeeks} (of ${supply} in existence)`);
console.log(`${symbol} balance:   ${formatUnits(sqkRaw, decimals)}`);

// Per-Squeek level and power, staking and claimable rewards come from Squeekchain's public API (/v1/accounts/<address>).
// The API is for display only: the on-chain reads above are the source of truth.
const account = await fetchAccount(owner, globalThis.fetch, API_BASE_URL);
if (!account.available) {
  console.log(`Per-Squeek details unavailable: ${account.reason}`);
} else {
  console.log(`Squeeks:       ${account.counts.wallet} in wallet, ${account.counts.staking} staked`);
  console.log(`Power:         NFT ${account.power.nft} + SQK ${account.power.sqk}`);
  console.log(`Staked SQK:    ${formatUnits(account.stakePrincipal, decimals)} ${symbol}`);
  console.log(`Claimable:     ${formatUnits(account.claimable, decimals)} ${symbol}`);
  for (const t of account.tokens) {
    console.log(`  Squeek #${t.tokenId}  level ${t.level}  base power ${t.basePower}  (${t.custody}, merge ${t.mergeState})`);
  }
  if (account.hasMore) console.log("  ... more Squeeks exist than shown (the API returned a next page).");
}
