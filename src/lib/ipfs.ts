export interface NftUploadResult {
  mediaUri: string;
  mediaGatewayUrl: string;
  metadataUri: string;
  metadataGatewayUrl: string;
}

export function normalizeIpfsUrl(url?: string | null): string | null {
  if (!url) return null;

  if (url.startsWith("ipfs://")) {
    const cidPath = url.replace("ipfs://", "").replace(/^ipfs\//, "");
    return `https://gateway.pinata.cloud/ipfs/${cidPath}`;
  }

  return url;
}

export async function uploadNftToIPFS(
  file: File,
  name: string,
  description: string
): Promise<NftUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("description", description);

  const response = await fetch("/api/ipfs/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to upload NFT media");
  }

  return response.json();
}
