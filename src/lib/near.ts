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

export interface DonationView {
  donor_id: string;
  amount: string;
  timestamp_ms: number;
  message?: string | null;
}

export interface CreatorView {
  creator_id: string;
  display_name: string;
  bio?: string | null;
  image_url?: string | null;
  total_donations: string;
  withdrawable_balance: string;
  donation_count: number;
  recent_donations: DonationView[];
}

export const nearGas = "30000000000000";
export const profileStorageDeposit = "0.05";

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

export { nearContractId, nearExplorerBaseUrl, nearNetworkId, nearNetworkLabel };
