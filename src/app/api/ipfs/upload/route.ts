import { NextResponse } from "next/server";
import { normalizeIpfsUrl, type NftUploadResult } from "@/lib/ipfs";

export async function POST(request: Request) {
  try {
    const jwt = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT;

    if (!jwt) {
      return new Response("Pinata JWT is not configured", { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    const description = formData.get("description");

    if (!(file instanceof File)) {
      return new Response("A media file is required", { status: 400 });
    }

    if (typeof name !== "string" || typeof description !== "string") {
      return new Response("Name and description are required", { status: 400 });
    }

    const pinataFileData = new FormData();
    pinataFileData.append("file", file);
    pinataFileData.append("pinataMetadata", JSON.stringify({ name: file.name }));
    pinataFileData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const fileRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: pinataFileData,
    });

    if (!fileRes.ok) {
      return new Response(await fileRes.text(), { status: fileRes.status });
    }

    const fileJson = await fileRes.json();
    const mediaUri = `ipfs://${fileJson.IpfsHash}`;
    const mediaGatewayUrl = normalizeIpfsUrl(mediaUri) || mediaUri;

    const metadataRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: {
          name,
          description,
          image: mediaUri,
        },
        pinataMetadata: { name: `${name}-metadata` },
      }),
    });

    if (!metadataRes.ok) {
      return new Response(await metadataRes.text(), { status: metadataRes.status });
    }

    const metadataJson = await metadataRes.json();
    const metadataUri = `ipfs://${metadataJson.IpfsHash}`;
    const metadataGatewayUrl = normalizeIpfsUrl(metadataUri) || metadataUri;

    const result: NftUploadResult = {
      mediaUri,
      mediaGatewayUrl,
      metadataUri,
      metadataGatewayUrl,
    };

    return NextResponse.json(result);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Upload failed", {
      status: 500,
    });
  }
}
