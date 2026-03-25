const configuredNetworkId = process.env.NEXT_PUBLIC_NEAR_NETWORK_ID;

export const nearNetworkId =
  configuredNetworkId === "mainnet" ? ("mainnet" as const) : ("testnet" as const);
export const nearNetworkLabel =
  nearNetworkId === "mainnet" ? "NEAR Mainnet" : "NEAR Testnet";
export const nearContractId =
  process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID || "toyota123.testnet";
export const nearExplorerBaseUrl =
  process.env.NEXT_PUBLIC_NEAR_EXPLORER_BASE_URL ||
  (nearNetworkId === "mainnet"
    ? "https://explorer.near.org"
    : "https://explorer.testnet.near.org");
