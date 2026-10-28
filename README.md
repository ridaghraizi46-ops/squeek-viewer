# squeek-viewer

A small read-only tool that looks up a wallet on [Squeekchain](https://docs.squeekchain.com),
the hamster-powered proof-of-work toychain. Give it an address and it shows:

- how many Squeeks (NFTs) the wallet owns, and how many exist in total
- the wallet's SQK token balance
- each Squeek's level, power and claimable SQK rewards

It runs against the **Sepolia testnet** deployment. It only reads public data: it never asks for a
private key and never signs or sends a transaction.

## How it uses Squeekchain

- Reads the `SqueekNFT` and `SqueekToken` contracts on Sepolia directly over RPC (`balanceOf`, `totalSupply`).
- Checks `SqueekNFT.mining()` against the published deployment record before trusting anything, and stops on a mismatch.
- Uses Squeekchain's public API (`/v1/owners/{address}/squeeks`) for per-Squeek power and claimable rewards (display only).

Contract addresses come from the deployment record in the Squeekchain docs.

## Run it

```
npm install
node src/index.js 0xYourAddress
```

Optional environment variables: `RPC_URL` (a Sepolia RPC), `API_BASE_URL`.

## Notes

- Squeekchain currently runs on the Sepolia testnet only, so SQK here has no real value.
- If the public API is unavailable, the tool still prints the on-chain Squeek count and SQK balance
  and reports that per-Squeek details could not be loaded.
