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
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (!jwt) {
    throw new Error("Pinata JWT is not configured");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("pinataMetadata", JSON.stringify({ name: file.name }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const fileRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!fileRes.ok) {
    throw new Error(await fileRes.text());
  }

  const fileJson = await fileRes.json();
  const mediaUri = `ipfs://${fileJson.IpfsHash}`;
  const mediaGatewayUrl = normalizeIpfsUrl(mediaUri) || mediaUri;

  const metadata = {
    name,
    description,
    image: mediaUri,
  };

  const metadataRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${name}-metadata` },
    }),
  });

  if (!metadataRes.ok) {
    throw new Error(await metadataRes.text());
  }

  const metadataJson = await metadataRes.json();
  const metadataUri = `ipfs://${metadataJson.IpfsHash}`;
  const metadataGatewayUrl = normalizeIpfsUrl(metadataUri) || metadataUri;

  return {
    mediaUri,
    mediaGatewayUrl,
    metadataUri,
    metadataGatewayUrl,
  };
}
