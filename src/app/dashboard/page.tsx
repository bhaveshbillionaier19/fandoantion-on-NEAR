"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ImagePlus, Loader2, Wallet } from "lucide-react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import NftCard from "@/components/NftCard";
import StatsCard from "@/components/StatsCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { uploadNftToIPFS } from "@/lib/ipfs";
import {
  type CreatorView,
  type NftView,
  mintStorageDeposit,
  nearContractId,
  nearGas,
  nearToYocto,
  yoctoToNear,
} from "@/lib/near";

export default function DashboardPage() {
  const { signedAccountId, signIn, viewFunction, callFunction, getBalance } = useWalletSelector();
  const { toast } = useToast();

  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [creator, setCreator] = useState<CreatorView | null>(null);
  const [mintedNfts, setMintedNfts] = useState<NftView[]>([]);
  const [ownedNfts, setOwnedNfts] = useState<NftView[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  useEffect(() => {
    if (!signedAccountId) {
      setWalletBalance(null);
      setCreator(null);
      setMintedNfts([]);
      setOwnedNfts([]);
      return;
    }

    const accountId = signedAccountId;
    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      try {
        const [balance, creatorResponse, creatorNftsResponse, ownerNftsResponse] =
          await Promise.all([
            getBalance(accountId),
            viewFunction({
              contractId: nearContractId,
              method: "get_creator",
              args: { creator_id: accountId },
            }),
            viewFunction({
              contractId: nearContractId,
              method: "get_nfts_by_creator",
              args: { creator_id: accountId, from_index: 0, limit: 20 },
            }),
            viewFunction({
              contractId: nearContractId,
              method: "get_nfts_by_owner",
              args: { owner_id: accountId, from_index: 0, limit: 20 },
            }),
          ]);

        if (cancelled) {
          return;
        }

        setWalletBalance(balance);
        setCreator((creatorResponse as CreatorView | null) || null);
        setMintedNfts(((creatorNftsResponse as NftView[]) || []).slice().reverse());
        setOwnedNfts(((ownerNftsResponse as NftView[]) || []).slice().reverse());
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Failed to load dashboard",
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [callFunction, getBalance, signedAccountId, toast, viewFunction]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function refreshDashboard() {
    if (!signedAccountId) {
      return;
    }

    const accountId = signedAccountId;

    const [creatorResponse, creatorNftsResponse, ownerNftsResponse, balance] =
      await Promise.all([
        viewFunction({
          contractId: nearContractId,
          method: "get_creator",
          args: { creator_id: accountId },
        }),
        viewFunction({
          contractId: nearContractId,
          method: "get_nfts_by_creator",
          args: { creator_id: accountId, from_index: 0, limit: 20 },
        }),
        viewFunction({
          contractId: nearContractId,
          method: "get_nfts_by_owner",
          args: { owner_id: accountId, from_index: 0, limit: 20 },
        }),
        getBalance(accountId),
      ]);

    setCreator((creatorResponse as CreatorView | null) || null);
    setMintedNfts(((creatorNftsResponse as NftView[]) || []).slice().reverse());
    setOwnedNfts(((ownerNftsResponse as NftView[]) || []).slice().reverse());
    setWalletBalance(balance);
  }

  async function handleMint() {
    if (!signedAccountId) {
      signIn();
      return;
    }

    if (!title.trim() || !description.trim() || !selectedFile) {
      toast({
        title: "Mint details missing",
        description: "Add a title, description, and media file before minting.",
        variant: "destructive",
      });
      return;
    }

    setIsMinting(true);
    try {
      const upload = await uploadNftToIPFS(selectedFile, title.trim(), description.trim());
      await callFunction({
        contractId: nearContractId,
        method: "mint_nft",
        args: {
          title: title.trim(),
          description: description.trim(),
          media: upload.mediaUri,
          reference: upload.metadataUri,
        },
        gas: nearGas,
        deposit: nearToYocto(mintStorageDeposit),
      });

      toast({
        title: "Mint transaction sent",
        description: "Approve the NEAR wallet prompt to finish minting your NFT.",
      });

      setTitle("");
      setDescription("");
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      await refreshDashboard();
    } catch (error) {
      toast({
        title: "Mint failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsMinting(false);
    }
  }

  if (!signedAccountId) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="glass-card glow-border rounded-3xl max-w-2xl mx-auto p-10 text-center">
          <ImagePlus className="w-12 h-12 mx-auto text-cyan-400 mb-4" />
          <h1 className="text-3xl font-bold mb-3">MintNFT</h1>
          <p className="text-muted-foreground mb-8">
            Connect your NEAR wallet to mint NFTs with Pinata IPFS media and manage your creator collectibles.
          </p>
          <button
            onClick={signIn}
            className="gradient-btn text-white font-semibold px-6 py-3 rounded-full inline-flex items-center gap-2"
          >
            Connect NEAR Wallet
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-10 pb-24 relative z-10">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="glass-card glow-border rounded-3xl p-8 mb-8"
      >
        <div>
          <p className="text-sm text-cyan-300 font-medium mb-2">MintNFT Balance</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {walletBalance === null ? "0" : yoctoToNear(walletBalance)} NEAR
          </h1>
          <p className="text-sm text-muted-foreground">
            Available balance in your connected testnet wallet.
          </p>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatsCard
          icon={Wallet}
          label="Wallet Balance"
          value={walletBalance === null ? "0" : yoctoToNear(walletBalance)}
          suffix="NEAR"
          numericValue={walletBalance === null ? 0 : Number(yoctoToNear(walletBalance) || 0)}
        />
        <StatsCard icon={ImagePlus} label="Minted NFTs" value={String(mintedNfts.length)} numericValue={mintedNfts.length} />
        <StatsCard icon={ArrowRight} label="Owned NFTs" value={String(ownedNfts.length)} numericValue={ownedNfts.length} />
        <StatsCard
          icon={Wallet}
          label="Total Amount Donated"
          value={yoctoToNear(creator?.total_donations || "0")}
          suffix="NEAR"
          numericValue={Number(yoctoToNear(creator?.total_donations || "0") || 0)}
        />
      </section>

      <section className="mb-8">
        <div className="glass-card glow-border rounded-3xl p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Mint a creator NFT</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload media to Pinata IPFS, then mint the NFT on NEAR testnet under your wallet account.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">Title</label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Behind the scenes drop"
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Description</label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell fans what this collectible unlocks or represents."
                className="bg-white/5 border-white/10 min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="media" className="text-sm font-medium">Media file</label>
              <Input id="media" type="file" accept="image/*" onChange={handleFileChange} className="bg-white/5 border-white/10" />
            </div>

            {previewUrl && (
              <div className="rounded-2xl overflow-hidden border border-white/[0.08] max-w-sm">
                <img src={previewUrl} alt="NFT preview" className="w-full aspect-square object-cover" />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="gradient-btn text-white font-semibold px-5 py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading and minting
                  </>
                ) : (
                  "Mint NFT"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-10">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">NFTs minted by you</h2>
              <p className="text-sm text-muted-foreground">Creator inventory linked to your account.</p>
            </div>
          </div>

          {mintedNfts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {mintedNfts.map((token) => (
                <NftCard key={token.token_id} token={token} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.03] px-4 py-8 text-sm text-muted-foreground">
              Your creator account has not minted any NFTs yet.
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">NFTs owned by you</h2>
              <p className="text-sm text-muted-foreground">Everything currently held by your wallet.</p>
            </div>
          </div>

          {ownedNfts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {ownedNfts.map((token) => (
                <NftCard key={`${token.token_id}-owned`} token={token} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.03] px-4 py-8 text-sm text-muted-foreground">
              Your wallet does not own any NFTs from this contract yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
