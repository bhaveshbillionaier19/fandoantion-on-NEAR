# Fan Donation on NEAR Testnet

A modular NEAR Protocol testnet app where creators mint NFTs and fans donate native NEAR to support them.

Default testnet account in this repo:
- wallet / deploy account: `konigsegg123.testnet`
- faucet funding observed: `10 NEAR` on testnet

## Stack

- `near-contract/`: Rust smart contract with `near-sdk` and `near-contract-standards`
- `src/`: Next.js frontend
- Wallet: `@near-wallet-selector/react-hook` + `@near-wallet-selector/my-near-wallet`
- Interaction: `near-api-js`
- Media / metadata storage: Pinata IPFS

## Folder Structure

```text
near-contract/
  Cargo.toml
  src/lib.rs
src/
  app/
    page.tsx
    dashboard/page.tsx
    creator/[accountId]/page.tsx
  components/
    CreatorCard.tsx
    NftCard.tsx
    Navbar.tsx
  lib/
    near.ts
    ipfs.ts
```

## Smart Contract

Main contract file:
- `near-contract/src/lib.rs`

Implemented features:
- NEP-171 NFT minting through `mint_nft`
- Creator donation tracking through `donate`
- Donation history, totals, and withdrawable balances
- Creator inventory indexing
- Owner inventory lookup
- Donation event logs and NFT mint event logs
- Withdrawal callback recovery if transfer fails

Key methods:
- `mint_nft(title, description, media, reference)`
- `donate(creator_id)`
- `get_nfts_by_creator(creator_id, from_index, limit)`
- `get_nfts_by_owner(owner_id, from_index, limit)`
- `get_donations(creator_id, from_index, limit)`
- `get_total_donations(creator_id)`
- `get_withdrawable_balance(creator_id)`
- `get_creator(creator_id)`
- `get_top_donors(creator_id, limit)`
- `list_creators(from_index, limit)`
- `withdraw()`

## Frontend Pages

- `/`: home page with creator directory, featured NFTs, wallet status
- `/creator/[accountId]`: creator profile with NFTs, donation form, leaderboard, history
- `/dashboard`: mint form, owned NFTs, minted NFTs, donation receipts, withdraw

## Environment

Copy the example file:

```bash
cp .env.example .env.local
```

Required values:

```bash
NEXT_PUBLIC_NEAR_NETWORK_ID=testnet
NEXT_PUBLIC_NEAR_CONTRACT_ID=konigsegg123.testnet
NEXT_PUBLIC_NEAR_EXPLORER_BASE_URL=https://explorer.testnet.near.org
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
```

## Install

```bash
npm install --ignore-scripts
```

Why `--ignore-scripts` on this Windows machine:
- the `cargo-near` npm package tries to download a native binary during install
- that download has been unreliable here
- the frontend itself works without that install script

## Frontend Dev

```bash
npm run dev
```

## Frontend Validation

```bash
npm run build
```

Current status:
- frontend production build passes

## Contract Build

Recommended environment:
- Linux or WSL2 Ubuntu

Why:
- this Windows machine is missing the MSVC linker for normal Rust builds
- the GNU Windows toolchain also has `dlltool` issues for some dependencies

Recommended Linux / WSL commands:

```bash
rustup toolchain install 1.86.0
rustup target add wasm32-unknown-unknown --toolchain 1.86.0
npm install
npm run build:contract
```

Expected output:

```text
near-contract/target/near/fandonation_near.wasm
```

## Deploy To NEAR Testnet

Deploy directly to `konigsegg123.testnet`:

```bash
near contract deploy konigsegg123.testnet use-file ./near-contract/target/near/fandonation_near.wasm with-init-call new json-args '{}' prepaid-gas 30Tgas attached-deposit 0NEAR network-config testnet sign-with-keychain send
```

Recommended production layout instead:
- keep `konigsegg123.testnet` as the wallet
- deploy the contract to a subaccount such as `fandonation.konigsegg123.testnet`

## Example NEAR CLI Calls

Mint an NFT:

```bash
near contract call-function as-transaction konigsegg123.testnet mint_nft json-args '{"title":"Genesis Drop","description":"Exclusive creator access","media":"ipfs://<image-cid>","reference":"ipfs://<metadata-cid>"}' prepaid-gas 50Tgas attached-deposit 0.1NEAR sign-as konigsegg123.testnet network-config testnet sign-with-keychain send
```

Donate 1 NEAR to a creator:

```bash
near contract call-function as-transaction konigsegg123.testnet donate json-args '{"creator_id":"konigsegg123.testnet"}' prepaid-gas 30Tgas attached-deposit 1NEAR sign-as konigsegg123.testnet network-config testnet sign-with-keychain send
```

View NFTs by creator:

```bash
near contract call-function as-read-only konigsegg123.testnet get_nfts_by_creator json-args '{"creator_id":"konigsegg123.testnet","from_index":0,"limit":10}' network-config testnet
```

View NFTs by owner:

```bash
near contract call-function as-read-only konigsegg123.testnet get_nfts_by_owner json-args '{"owner_id":"konigsegg123.testnet","from_index":0,"limit":10}' network-config testnet
```

View creator donations:

```bash
near contract call-function as-read-only konigsegg123.testnet get_donations json-args '{"creator_id":"konigsegg123.testnet","from_index":0,"limit":10}' network-config testnet
```

View total donations:

```bash
near contract call-function as-read-only konigsegg123.testnet get_total_donations json-args '{"creator_id":"konigsegg123.testnet"}' network-config testnet
```

Withdraw creator funds:

```bash
near contract call-function as-transaction konigsegg123.testnet withdraw json-args '{}' prepaid-gas 30Tgas attached-deposit 1yoctoNEAR sign-as konigsegg123.testnet network-config testnet sign-with-keychain send
```

## Example Frontend Calls

Mint:

```ts
const upload = await uploadNftToIPFS(file, title, description);

await callFunction({
  contractId: nearContractId,
  method: "mint_nft",
  args: {
    title,
    description,
    media: upload.mediaUri,
    reference: upload.metadataUri,
  },
  gas: nearGas,
  deposit: nearToYocto("0.1"),
});
```

Donate:

```ts
await callFunction({
  contractId: nearContractId,
  method: "donate",
  args: { creator_id: "konigsegg123.testnet" },
  gas: nearGas,
  deposit: nearToYocto("1"),
});
```

View creator NFTs:

```ts
const nfts = await viewFunction({
  contractId: nearContractId,
  method: "get_nfts_by_creator",
  args: { creator_id: "konigsegg123.testnet", from_index: 0, limit: 20 },
});
```

## Aptos To NEAR Differences

- Aptos `0x...` addresses become named NEAR accounts like `creator.testnet`
- Move resources / tables are replaced by `LookupMap`, `Vector`, and NEP-171 collections
- MetaMask-style extension flows are replaced by Wallet Selector + web wallet redirects
- NEAR payments use attached deposits in yoctoNEAR
- NFT media is usually stored off-chain on IPFS and referenced from on-chain metadata

## Notes

- Donation receipts increase on-chain storage over time
- `withdraw()` requires `1 yoctoNEAR` as a security guard
- the contract refunds unused mint storage deposit automatically
- Pinata JWT is required for media and metadata upload
