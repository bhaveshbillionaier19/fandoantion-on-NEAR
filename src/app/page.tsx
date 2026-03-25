"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Layers, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import Hero from "@/components/Hero";
import StatsCard from "@/components/StatsCard";
import CreatorCard from "@/components/CreatorCard";
import NftCard from "@/components/NftCard";
import { useToast } from "@/components/ui/use-toast";
import {
  type CreatorView,
  type NftView,
  nearContractId,
  toNftView,
  yoctoToNear,
} from "@/lib/near";

function compareYoctoDesc(left: string, right: string) {
  const leftAmount = BigInt(left || "0");
  const rightAmount = BigInt(right || "0");

  if (rightAmount > leftAmount) {
    return 1;
  }

  if (rightAmount < leftAmount) {
    return -1;
  }

  return 0;
}

export default function Home() {
  const { signedAccountId, signIn, viewFunction, getBalance } = useWalletSelector();
  const { toast } = useToast();

  const [creators, setCreators] = useState<CreatorView[]>([]);
  const [allNfts, setAllNfts] = useState<NftView[]>([]);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadHome(showSkeleton = false) {
    if (showSkeleton) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [creatorsResponse, nftResponse] = await Promise.all([
        viewFunction({
          contractId: nearContractId,
          method: "list_creators",
          args: {
            from_index: 0,
            limit: 50,
          },
        }),
        viewFunction({
          contractId: nearContractId,
          method: "nft_tokens",
          args: {
            from_index: "0",
            limit: 100,
          },
        }),
      ]);

      setCreators((creatorsResponse as CreatorView[]) || []);
      setAllNfts((((nftResponse as any[]) || []).map(toNftView)).slice().reverse());
    } catch (error) {
      toast({
        title: "Failed to load home data",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadHome(true);
    const interval = setInterval(() => loadHome(false), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!signedAccountId) {
      setWalletBalance(null);
      return;
    }

    const accountId = signedAccountId;
    let cancelled = false;

    async function loadBalance() {
      try {
        const balance = await getBalance(accountId);
        if (!cancelled) {
          setWalletBalance(balance);
        }
      } catch {
        if (!cancelled) {
          setWalletBalance(null);
        }
      }
    }

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [getBalance, signedAccountId]);

  const totalDonationsYocto = useMemo(
    () => creators.reduce((sum, creator) => sum + BigInt(creator.total_donations || "0"), 0n),
    [creators]
  );

  const topCreator = useMemo(() => {
    if (creators.length === 0) {
      return null;
    }

    return [...creators].sort((left, right) => compareYoctoDesc(left.total_donations, right.total_donations))[0]?.creator_id || null;
  }, [creators]);

  return (
    <main className="relative z-10">
      <Hero />

      <section className="container mx-auto px-4 -mt-8 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard icon={Layers} label="Creators" value={String(creators.length)} numericValue={creators.length} />
          <StatsCard icon={ImagePlus} label="Minted NFTs" value={String(allNfts.length)} numericValue={allNfts.length} />
          <StatsCard
            icon={TrendingUp}
            label="Donations"
            value={yoctoToNear(totalDonationsYocto)}
            suffix="NEAR"
            numericValue={Number(yoctoToNear(totalDonationsYocto) || 0)}
          />
        </div>
      </section>

      <section className="container mx-auto px-4 mb-12">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-card glow-border rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Wallet status</h2>
                <p className="text-xs text-muted-foreground">MyNearWallet on NEAR testnet</p>
              </div>
            </div>

            {signedAccountId ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Connected account</p>
                  <p className="text-sm font-mono break-all">{signedAccountId}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Native balance</p>
                  <p className="text-lg font-bold">
                    {walletBalance === null ? "Loading..." : `${yoctoToNear(walletBalance)} NEAR`}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Active contract</p>
                  <p className="text-sm font-mono break-all">{nearContractId}</p>
                </div>
                <Link
                  href="/dashboard"
                  className="gradient-btn text-white font-semibold px-5 py-3 rounded-xl inline-flex items-center gap-2"
                >
                  Go to dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Connect a named testnet account like <span className="font-mono text-foreground">konigsegg123.testnet</span>{" "}
                  to mint NFTs, donate NEAR, and manage your creator dashboard.
                </p>
                <button
                  onClick={signIn}
                  className="gradient-btn text-white font-semibold px-5 py-2 rounded-full inline-flex items-center gap-2"
                >
                  Connect wallet
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="glass-card glow-border rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold">All minted NFTs</h2>
                <p className="text-xs text-muted-foreground">Contract-wide NFT gallery from {nearContractId}</p>
              </div>
              {topCreator && (
                <Link href={`/creator/${topCreator}`} className="text-xs text-muted-foreground hover:text-foreground">
                  Top supported creator
                </Link>
              )}
            </div>

            {allNfts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[760px] overflow-y-auto pr-1">
                {allNfts.map((token) => (
                  <NftCard key={token.token_id} token={token} compact />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-10 text-center text-sm text-muted-foreground">
                No NFTs minted yet. Open the dashboard and mint the first collectible.
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="creators" className="container mx-auto px-4 pb-24">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Creator directory</h2>
            <p className="text-sm text-muted-foreground">Browse creator collections and support them with NEAR donations</p>
          </div>
          <Link
            href="/dashboard"
            className="gradient-btn-outline text-foreground text-sm font-medium px-4 py-2 rounded-full inline-flex items-center gap-2 hover:bg-white/5 transition-colors"
          >
            Mint your NFT
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isRefreshing && (
          <p className="text-xs text-muted-foreground mb-4">Refreshing on-chain data from {nearContractId}...</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl h-[420px] shimmer border border-white/[0.06]" />
            ))
          ) : creators.length > 0 ? (
            creators.map((creator) => (
              <CreatorCard key={creator.creator_id} creator={creator} currentAccountId={signedAccountId} />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <div className="glass-card glow-border rounded-2xl p-10 max-w-md mx-auto">
                <ImagePlus className="w-12 h-12 text-purple-400/60 mx-auto mb-4" />
                <p className="mb-2 text-lg font-semibold">No creators found yet</p>
                <p className="mb-6 text-sm text-muted-foreground">
                  Mint the first NFT on NEAR testnet and your creator profile will appear here.
                </p>
                <Link
                  href="/dashboard"
                  className="gradient-btn text-white font-semibold px-6 py-2.5 rounded-full text-sm inline-flex items-center gap-2"
                >
                  Open dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
