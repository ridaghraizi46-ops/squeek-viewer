// squeek-viewer: read-only lookup of a wallet's Squeeks and SQK on Squeekchain (Sepolia testnet).
// Usage: node src/index.js 0xYourAddress
// Nothing is signed or sent, and no private key is ever needed.
import { createPublicClient, http, parseAbi, formatUnits, getAddress, isAddress } from "viem";

// Deployment record from https://docs.squeekchain.com (release squeeks-sepolia-core3-mining6-001).
const CHAIN_ID = 11155111;
const NFT = "0x0eAF3E0d40A0a8E5a6Ac030b2459E9FB0B7905c6";
const SQK = "0x6872bfa5ccc3e9e440c6c16e5ffdabb8dba4cc76";
const MINING = "0x3beE588fC20dE788Bac17d33b41Da7346cb27EC4";

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

// Sanity check: the NFT contract must point at the mining contract from the deployment record.
const miningOnChain = await client.readContract({ address: NFT, abi: nftAbi, functionName: "mining" });
if (miningOnChain.toLowerCase() !== MINING.toLowerCase()) {
  throw new Error("Deployment mismatch: NFT.mining() differs from the published record. Stopping.");
}

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

// Per-Squeek power and claimable rewards come from Squeekchain's public API.
// The API is for display only: the on-chain reads above are the source of truth.
if (squeeks > 0n) {
  const res = await fetch(new URL(`/v1/owners/${owner}/squeeks?limit=100`, API_BASE_URL), {
    headers: { accept: "application/json" },
  });
  const page = res.ok ? await res.json() : { status: "unavailable", reason: `HTTP ${res.status}` };
  if (page.status !== "available") {
    console.log(`Per-Squeek details unavailable: ${page.reason}`);
  } else {
    for (const p of page.positions ?? []) {
      console.log(
        `  Squeek #${p.tokenId}  level ${p.level}  power ${p.activeWeight}  claimable ${formatUnits(BigInt(p.claimableBaseUnits), decimals)} ${symbol}`,
      );
    }
  }
}
