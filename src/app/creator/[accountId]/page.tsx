"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Heart, Loader2, Wallet } from "lucide-react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import NftCard from "@/components/NftCard";
import StatsCard from "@/components/StatsCard";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  type CreatorView,
  type DonationView,
  type DonorTotalView,
  type NftView,
  explorerAccountUrl,
  nearContractId,
  nearGas,
  nearToYocto,
  shortenAccountId,
  timestampLabel,
  yoctoToNear,
} from "@/lib/near";

export default function CreatorProfilePage() {
  const params = useParams<{ accountId: string }>();
  const creatorId = decodeURIComponent(params.accountId);
  const { signedAccountId, signIn, viewFunction, callFunction } = useWalletSelector();
  const { toast } = useToast();

  const [creator, setCreator] = useState<CreatorView | null>(null);
  const [nfts, setNfts] = useState<NftView[]>([]);
  const [donations, setDonations] = useState<DonationView[]>([]);
  const [topDonors, setTopDonors] = useState<DonorTotalView[]>([]);
  const [donationAmount, setDonationAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDonating, setIsDonating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCreatorProfile() {
      setIsLoading(true);
      try {
        const [creatorResponse, nftResponse, donationsResponse, donorsResponse] = await Promise.all([
          viewFunction({
            contractId: nearContractId,
            method: "get_creator",
            args: { creator_id: creatorId },
          }),
          viewFunction({
            contractId: nearContractId,
            method: "get_nfts_by_creator",
            args: { creator_id: creatorId, from_index: 0, limit: 30 },
          }),
          viewFunction({
            contractId: nearContractId,
            method: "get_donations",
            args: { creator_id: creatorId, from_index: 0, limit: 20 },
          }),
          viewFunction({
            contractId: nearContractId,
            method: "get_top_donors",
            args: { creator_id: creatorId, limit: 5 },
          }),
        ]);

        if (cancelled) {
          return;
        }

        setCreator((creatorResponse as CreatorView | null) || null);
        setNfts(((nftResponse as NftView[]) || []).slice().reverse());
        setDonations(((donationsResponse as DonationView[]) || []).slice().reverse());
        setTopDonors((donorsResponse as DonorTotalView[]) || []);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Failed to load creator profile",
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

    loadCreatorProfile();
    return () => {
      cancelled = true;
    };
  }, [creatorId, toast, viewFunction]);

  async function refreshProfile() {
    const [creatorResponse, nftResponse, donationsResponse, donorsResponse] = await Promise.all([
      viewFunction({
        contractId: nearContractId,
        method: "get_creator",
        args: { creator_id: creatorId },
      }),
      viewFunction({
        contractId: nearContractId,
        method: "get_nfts_by_creator",
        args: { creator_id: creatorId, from_index: 0, limit: 30 },
      }),
      viewFunction({
        contractId: nearContractId,
        method: "get_donations",
        args: { creator_id: creatorId, from_index: 0, limit: 20 },
      }),
      viewFunction({
        contractId: nearContractId,
        method: "get_top_donors",
        args: { creator_id: creatorId, limit: 5 },
      }),
    ]);

    setCreator((creatorResponse as CreatorView | null) || null);
    setNfts(((nftResponse as NftView[]) || []).slice().reverse());
    setDonations(((donationsResponse as DonationView[]) || []).slice().reverse());
    setTopDonors((donorsResponse as DonorTotalView[]) || []);
  }

  async function handleDonate() {
    if (!signedAccountId) {
      signIn();
      return;
    }

    if (!donationAmount.trim() || Number(donationAmount) <= 0) {
      toast({
        title: "Invalid donation amount",
        description: "Enter a positive NEAR amount before donating.",
        variant: "destructive",
      });
      return;
    }

    setIsDonating(true);
    try {
      await callFunction({
        contractId: nearContractId,
        method: "donate",
        args: { creator_id: creatorId },
        gas: nearGas,
        deposit: nearToYocto(donationAmount),
      });

      toast({
        title: "Donation transaction sent",
        description: "Approve the NEAR wallet prompt to record the donation on-chain.",
      });

      setDonationAmount("");
      await refreshProfile();
    } catch (error) {
      toast({
        title: "Donation failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsDonating(false);
    }
  }

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="rounded-3xl h-[320px] shimmer border border-white/[0.06]" />
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="glass-card glow-border rounded-3xl max-w-2xl mx-auto p-10 text-center">
          <h1 className="text-3xl font-bold mb-3">Creator not found</h1>
          <p className="text-muted-foreground mb-8">
            This account has not minted any NFTs on the contract yet.
          </p>
          <Link
            href="/dashboard"
            className="gradient-btn text-white font-semibold px-6 py-3 rounded-full inline-flex items-center gap-2"
          >
            Mint first NFT
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = signedAccountId === creatorId;

  return (
    <main className="container mx-auto px-4 py-10 pb-24 relative z-10">
      <section className="glass-card glow-border rounded-3xl p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-sm text-cyan-300 font-medium mb-2">Creator profile</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">{shortenAccountId(creatorId, 24, 12)}</h1>
            <p className="text-muted-foreground max-w-2xl mb-3">
              Minted NFTs and support receipts published through <span className="font-mono text-foreground">{nearContractId}</span>.
            </p>
            <a
              href={explorerAccountUrl(creatorId)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View account on NEAR Explorer
            </a>
          </div>
          <div className="rounded-2xl bg-white/[0.04] px-5 py-4 text-sm max-w-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Donation note</p>
            <p className="text-sm text-muted-foreground">
              A small part of each attached deposit may be used for on-chain receipt storage before the remainder is credited to the creator.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatsCard icon={Wallet} label="Minted NFTs" value={String(creator.nft_count)} numericValue={creator.nft_count} />
        <StatsCard
          icon={Heart}
          label="Total donations"
          value={yoctoToNear(creator.total_donations)}
          suffix="NEAR"
          numericValue={Number(yoctoToNear(creator.total_donations) || 0)}
        />
        <StatsCard icon={ArrowRight} label="Receipt count" value={String(creator.donation_count)} numericValue={creator.donation_count} />
        <StatsCard
          icon={Wallet}
          label="Withdrawable"
          value={yoctoToNear(creator.withdrawable_balance)}
          suffix="NEAR"
          numericValue={Number(yoctoToNear(creator.withdrawable_balance) || 0)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] mb-10">
        <div className="glass-card glow-border rounded-3xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold">Support this creator</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Send NEAR on testnet and let the contract record the donation on-chain.
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Creator account</p>
            <p className="text-sm font-mono break-all">{creatorId}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="donation-amount" className="text-sm font-medium">Donation amount</label>
            <div className="relative">
              <Input
                id="donation-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="1"
                value={donationAmount}
                onChange={(event) => setDonationAmount(event.target.value)}
                className="pr-16 bg-white/5 border-white/10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">NEAR</span>
            </div>
          </div>

          <button
            onClick={handleDonate}
            disabled={isDonating || isOwner}
            className="w-full gradient-btn text-white font-semibold py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isDonating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for wallet
              </>
            ) : isOwner ? (
              "This is your creator account"
            ) : (
              "Donate NEAR"
            )}
          </button>

          <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
            <p className="text-sm font-semibold mb-3">Top donors</p>
            {topDonors.length > 0 ? (
              <div className="space-y-3">
                {topDonors.map((donor) => (
                  <div key={donor.donor_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono truncate">{shortenAccountId(donor.donor_id, 10, 6)}</span>
                    <span className="font-semibold">{yoctoToNear(donor.total_amount)} NEAR</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No donor leaderboard yet.</p>
            )}
          </div>
        </div>

        <div className="glass-card glow-border rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Donation history</h2>
              <p className="text-sm text-muted-foreground">Recent support receipts for this creator.</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {donations.length > 0 ? (
              donations.map((donation, index) => (
                <div key={`${donation.donor_id}-${donation.timestamp_ms}-${index}`} className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold font-mono truncate">{donation.donor_id}</p>
                      <p className="text-xs text-muted-foreground">{timestampLabel(donation.timestamp_ms)}</p>
                    </div>
                    <p className="text-sm font-bold gradient-text">{yoctoToNear(donation.amount)} NEAR</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-sm text-muted-foreground">
                No donations recorded yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Minted NFTs</h2>
            <p className="text-sm text-muted-foreground">Collectibles published by this creator account.</p>
          </div>
          {isOwner && (
            <Link href="/dashboard" className="gradient-btn-outline text-foreground text-sm font-medium px-4 py-2 rounded-full inline-flex items-center gap-2">
              Mint another NFT
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {nfts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {nfts.map((token) => (
              <NftCard key={token.token_id} token={token} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] px-4 py-8 text-sm text-muted-foreground">
            This creator has not minted an NFT yet.
          </div>
        )}
      </section>
    </main>
  );
}
