# squeek-viewer

A small read-only tool that looks up a wallet on [Squeekchain](https://docs.squeekchain.com),
the hamster-powered proof-of-work toychain. Give it an address and it shows:

- how many Squeeks (NFTs) the wallet owns, and how many exist in total
- the wallet's SQK token balance
- how many Squeeks are in the wallet versus staked, plus the wallet's NFT power, staked SQK and claimable SQK rewards
- each Squeek's level, base power, custody (wallet or staking) and merge state

It runs against the **Sepolia testnet** deployment. It only reads public data: it never asks for a
private key and never signs or sends a transaction.

## How it uses Squeekchain

- Reads the `SqueekNFT` and `SqueekToken` contracts on Sepolia directly over RPC (`balanceOf`, `totalSupply`).
- Gets the contract addresses **live** from Squeekchain's public API (`/v1/economy/state` -> `identities`), because the
  project has redeployed before. If the API cannot be reached it uses a built-in record of the current deployment and says so.
- Checks `SqueekNFT.mining()` against that deployment on the chain itself before trusting anything, and stops on a mismatch.
- Uses Squeekchain's public API (`/v1/accounts/{address}`) for per-Squeek level and power, staking and claimable rewards
  (display only: the on-chain reads are the source of truth).

## Run it

```
npm install
node src/index.js 0xYourAddress
```

Optional environment variables: `RPC_URL` (a Sepolia RPC), `API_BASE_URL`.

There is also a static web page in `site/` (open `site/index.html` through any static server).

Run the tests with `npm test`.

## Notes

- Squeekchain currently runs on the Sepolia testnet only, so SQK here has no real value.
- If the public API is unavailable, the tool still prints the on-chain Squeek count and SQK balance
  and reports that per-Squeek details could not be loaded.
