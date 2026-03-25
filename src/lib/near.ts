import {
  nearToYocto as convertNearToYocto,
  yoctoToNear as convertYoctoToNear,
} from "near-api-js";
import {
  nearContractId,
  nearExplorerBaseUrl,
  nearNetworkId,
  nearNetworkLabel,
} from "@/constants";
import { normalizeIpfsUrl } from "@/lib/ipfs";

export interface DonationView {
  donor_id: string;
  amount: string;
  timestamp_ms: number;
}

export interface NftView {
  token_id: string;
  owner_id: string;
  creator_id: string;
  title?: string | null;
  description?: string | null;
  media?: string | null;
  reference?: string | null;
  issued_at?: string | null;
}

export interface CreatorView {
  creator_id: string;
  total_donations: string;
  withdrawable_balance: string;
  donation_count: number;
  nft_count: number;
  recent_nfts: NftView[];
}

export interface DonorTotalView {
  donor_id: string;
  total_amount: string;
  donation_count: number;
}

export const nearGas = "100000000000000";
export const mintStorageDeposit = "0.1";

export function yoctoToNear(amount: string | bigint, fractionDigits = 4) {
  const formatted = convertYoctoToNear(BigInt(amount.toString()), fractionDigits);
  return formatted.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
}

export function nearToYocto(amount: string) {
  return convertNearToYocto(amount.trim() as `${number}`);
}

export function shortenAccountId(accountId: string, head = 10, tail = 8) {
  if (accountId.length <= head + tail + 3) {
    return accountId;
  }

  return `${accountId.slice(0, head)}...${accountId.slice(-tail)}`;
}

export function explorerAccountUrl(accountId: string) {
  return `${nearExplorerBaseUrl}/accounts/${accountId}`;
}

export function timestampLabel(timestampMs: number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

export function issuedAtLabel(issuedAt?: string | null) {
  if (!issuedAt) {
    return "Unknown";
  }

  const numeric = Number(issuedAt);
  if (Number.isNaN(numeric)) {
    return issuedAt;
  }

  return timestampLabel(numeric);
}

export function nftMediaUrl(token: NftView) {
  return normalizeIpfsUrl(token.media) || normalizeIpfsUrl(token.reference) || token.media || token.reference || null;
}

export function toNftView(rawToken: any): NftView {
  const metadata = rawToken?.metadata || {};
  const tokenId = String(rawToken?.token_id || "");
  const creatorId = String(rawToken?.creator_id || tokenId.split(":")[0] || rawToken?.owner_id || "");

  return {
    token_id: tokenId,
    owner_id: String(rawToken?.owner_id || ""),
    creator_id: creatorId,
    title: rawToken?.title ?? metadata.title ?? null,
    description: rawToken?.description ?? metadata.description ?? null,
    media: rawToken?.media ?? metadata.media ?? null,
    reference: rawToken?.reference ?? metadata.reference ?? null,
    issued_at: rawToken?.issued_at ?? metadata.issued_at ?? null,
  };
}

export { nearContractId, nearExplorerBaseUrl, nearNetworkId, nearNetworkLabel };
