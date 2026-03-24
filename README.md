# Fan Donation on NEAR Testnet

This repo is now structured as a NEAR testnet migration of the fan donation app:

- `near-contract/`: Rust smart contract using `near-sdk`
- `src/`: Next.js frontend using MyNearWallet via Wallet Selector
- Default contract account: `konigsegg123.testnet`
- Local CLI version used during migration: `near-cli-rs 0.24.0`

## What Changed From Aptos

- Move modules were replaced with a Rust contract for NEAR.
- Hex addresses were replaced with named NEAR accounts like `creator.testnet`.
- Petra / Aptos wallet flows were replaced with MyNearWallet on NEAR testnet.
- NFT-centric creator objects were replaced with creator profiles plus native NEAR donation receipts.
- Native NEAR uses yoctoNEAR under the hood, so the frontend converts between human-readable NEAR and on-chain amounts.

## Smart Contract

Full contract code lives in:

- `near-contract/src/lib.rs`

Implemented methods:

- `set_profile(display_name, bio, image_url)`
- `donate(creator_id, message)`
- `get_donations(creator_id)`
- `get_donations_paginated(creator_id, from_index, limit)`
- `get_total_donations(creator_id)`
- `get_withdrawable_balance(creator_id)`
- `get_creator(creator_id)`
- `list_creators(from_index, limit)`
- `withdraw()`

Storage model:

- `creator_id => profile + donation vector + total donations + withdrawable balance`
- each donation stores `donor_id`, `amount`, `timestamp_ms`, and an optional message

## Frontend Integration

Important files:

- `src/lib/near.ts`
- `src/app/providers.tsx`
- `src/app/page.tsx`
- `src/app/creator/page.tsx`
- `src/components/CreatorCard.tsx`

Wallet integration:

- `@near-wallet-selector/react-hook`
- `@near-wallet-selector/my-near-wallet`
- `near-api-js` for NEAR amount conversion helpers

Core flow:

1. Connect MyNearWallet on testnet.
2. Creators register/update a profile.
3. Fans send native NEAR through the contract.
4. The contract stores the donation receipt on-chain.
5. Creators withdraw their accumulated balance with `withdraw()`.

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_NEAR_CONTRACT_ID=konigsegg123.testnet
```

Or copy:

```bash
Copy-Item .env.example .env.local
```

## Install

```bash
npm install
```

## Frontend Dev

```bash
npm run dev
```

## Contract Build

Install the wasm target once:

```bash
rustup target add wasm32-unknown-unknown
```

Build:

```bash
npm run build:contract
```

Expected wasm output:

```text
near-contract/target/wasm32-unknown-unknown/release/fandonation_near.wasm
```

## Local Validation

Frontend build:

```bash
npm run build
```

Contract tests:

```bash
npm run test:contract
```

Note for this Windows machine:

- frontend production build succeeds
- Rust contract build/test is currently blocked by missing Microsoft C++ linker tooling (`link.exe`)
- install **Visual Studio Build Tools** with the **Desktop development with C++** workload, then rerun:

```bash
npm run test:contract
npm run build:contract
```

## NEAR Testnet Account Setup

You already have:

- wallet account: `konigsegg123.testnet`
- faucet funding received: `10 NEAR` on testnet

If you need to recreate a testnet account:

```bash
near account create-account sponsor-by-faucet-service yourname.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
```

Import/login with the browser wallet:

```bash
near account import-account using-web-wallet network-config testnet
```

Check account state:

```bash
near state konigsegg123.testnet --networkId testnet
near account view-account-summary konigsegg123.testnet network-config testnet now
near tokens konigsegg123.testnet view-near-balance network-config testnet now
```

## Deploy To NEAR Testnet

Assuming you deploy directly to `konigsegg123.testnet`:

```bash
npm run build:contract
```

```bash
near contract deploy konigsegg123.testnet use-file .\near-contract\target\wasm32-unknown-unknown\release\fandonation_near.wasm with-init-call new json-args '{}' prepaid-gas 30Tgas attached-deposit 0NEAR network-config testnet sign-with-keychain send
```

Verify deployed methods/storage:

```bash
near contract inspect konigsegg123.testnet network-config testnet
near account view-account-summary konigsegg123.testnet network-config testnet now
```

Production note:

- for a cleaner separation, deploy the contract to a subaccount such as `fandonation.konigsegg123.testnet`
- keep `konigsegg123.testnet` as the signing wallet account

## Function Call Examples

Create or update the creator profile:

```bash
near contract call-function as-transaction konigsegg123.testnet set_profile json-args '{"display_name":"Konigsegg Creator","bio":"Fan-powered builder on NEAR testnet","image_url":"https://example.com/avatar.png"}' prepaid-gas 30Tgas attached-deposit 0.05NEAR sign-as konigsegg123.testnet network-config testnet sign-with-keychain send
```

Donate 1 NEAR to a creator:

```bash
near contract call-function as-transaction konigsegg123.testnet donate json-args '{"creator_id":"konigsegg123.testnet","message":"Thanks for building this."}' prepaid-gas 30Tgas attached-deposit 1NEAR sign-as konigsegg123.testnet network-config testnet sign-with-keychain send
```

View donations:

```bash
near contract call-function as-read-only konigsegg123.testnet get_donations json-args '{"creator_id":"konigsegg123.testnet"}' network-config testnet
```

View total donations:

```bash
near contract call-function as-read-only konigsegg123.testnet get_total_donations json-args '{"creator_id":"konigsegg123.testnet"}' network-config testnet
```

Withdraw creator funds:

```bash
near contract call-function as-transaction konigsegg123.testnet withdraw json-args {} prepaid-gas 30Tgas attached-deposit 1yoctoNEAR sign-as konigsegg123.testnet network-config testnet sign-with-keychain send
```

## Example Frontend Calls

Donation:

```ts
await callFunction({
  contractId: nearContractId,
  method: "donate",
  args: {
    creator_id: "konigsegg123.testnet",
    message: "Thanks for building this.",
  },
  gas: nearGas,
  deposit: nearToYocto("1"),
});
```

View creators:

```ts
const creators = await viewFunction({
  contractId: nearContractId,
  method: "list_creators",
  args: { from_index: 0, limit: 50 },
});
```

Withdraw:

```ts
await callFunction({
  contractId: nearContractId,
  method: "withdraw",
  args: {},
  gas: nearGas,
  deposit: "1",
});
```

## Developer Notes

- `donate` is payable and accepts native NEAR.
- `withdraw` requires `1yoctoNEAR` as a standard NEAR security guard.
- creator profiles are optional until the creator registers with `set_profile`.
- donation history is on-chain, so each receipt increases contract storage.
- the frontend polls contract views to refresh totals and recent donations.
