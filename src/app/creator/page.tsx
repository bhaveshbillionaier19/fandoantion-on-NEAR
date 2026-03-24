"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Loader2, Wallet, ArrowRight } from "lucide-react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import StatsCard from "@/components/StatsCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  type CreatorView,
  type DonationView,
  nearContractId,
  nearGas,
  nearToYocto,
  profileStorageDeposit,
  timestampLabel,
  yoctoToNear,
} from "@/lib/near";

export default function CreatorPage() {
  const { signedAccountId, signIn, viewFunction, callFunction } = useWalletSelector();
  const { toast } = useToast();

  const [creator, setCreator] = useState<CreatorView | null>(null);
  const [donations, setDonations] = useState<DonationView[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (!signedAccountId) {
      setCreator(null);
      setDonations([]);
      setDisplayName("");
      setBio("");
      setImageUrl("");
      return;
    }

    let cancelled = false;

    async function loadCreator() {
      setIsLoading(true);
      try {
        const [creatorResponse, donationsResponse] = await Promise.all([
          viewFunction({
            contractId: nearContractId,
            method: "get_creator",
            args: { creator_id: signedAccountId },
          }),
          viewFunction({
            contractId: nearContractId,
            method: "get_donations_paginated",
            args: {
              creator_id: signedAccountId,
              from_index: 0,
              limit: 20,
            },
          }),
        ]);

        if (cancelled) {
          return;
        }

        const nextCreator = (creatorResponse as CreatorView | null) || null;
        setCreator(nextCreator);
        setDonations((donationsResponse as DonationView[]) || []);
        setDisplayName(nextCreator?.display_name || "");
        setBio(nextCreator?.bio || "");
        setImageUrl(nextCreator?.image_url || "");
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

    loadCreator();
    return () => {
      cancelled = true;
    };
  }, [signedAccountId, toast, viewFunction]);

  async function refreshCreator() {
    if (!signedAccountId) {
      return;
    }

    const [creatorResponse, donationsResponse] = await Promise.all([
      viewFunction({
        contractId: nearContractId,
        method: "get_creator",
        args: { creator_id: signedAccountId },
      }),
      viewFunction({
        contractId: nearContractId,
        method: "get_donations_paginated",
        args: {
          creator_id: signedAccountId,
          from_index: 0,
          limit: 20,
        },
      }),
    ]);

    const nextCreator = (creatorResponse as CreatorView | null) || null;
    setCreator(nextCreator);
    setDonations((donationsResponse as DonationView[]) || []);
    setDisplayName(nextCreator?.display_name || "");
    setBio(nextCreator?.bio || "");
    setImageUrl(nextCreator?.image_url || "");
  }

  async function handleSaveProfile() {
    if (!signedAccountId) {
      signIn();
      return;
    }

    if (!displayName.trim()) {
      toast({
        title: "Display name required",
        description: "Set a display name before saving your creator profile.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await callFunction({
        contractId: nearContractId,
        method: "set_profile",
        args: {
          display_name: displayName,
          bio,
          image_url: imageUrl,
        },
        gas: nearGas,
        deposit: nearToYocto(profileStorageDeposit),
      });

      toast({
        title: "Profile transaction sent",
        description:
          "MyNearWallet has been asked to sign the profile update. Any unused storage deposit is refunded automatically.",
      });

      await refreshCreator();
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleWithdraw() {
    if (!signedAccountId) {
      signIn();
      return;
    }

    setIsWithdrawing(true);
    try {
      await callFunction({
        contractId: nearContractId,
        method: "withdraw",
        args: {},
        gas: nearGas,
        deposit: "1",
      });

      toast({
        title: "Withdraw transaction sent",
        description: "Approve the 1 yoctoNEAR security check in your wallet.",
      });

      await refreshCreator();
    } catch (error) {
      toast({
        title: "Withdraw failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  }

  if (!signedAccountId) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="glass-card glow-border rounded-3xl max-w-2xl mx-auto p-10 text-center">
          <HeartHandshake className="w-12 h-12 mx-auto text-cyan-400 mb-4" />
          <h1 className="text-3xl font-bold mb-3">Creator dashboard</h1>
          <p className="text-muted-foreground mb-8">
            Connect your NEAR testnet wallet to register your creator profile, review incoming
            donations, and withdraw the funds collected on-chain.
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
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-sm text-cyan-300 font-medium mb-2">Creator dashboard</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Manage {signedAccountId}</h1>
            <p className="text-muted-foreground max-w-2xl">
              This page writes your creator metadata to the NEAR testnet contract at{" "}
              <span className="font-mono text-foreground">{nearContractId}</span> and lets you
              withdraw the balance accumulated from fan donations.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] px-5 py-4 text-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Refundable storage deposit
            </p>
            <p className="font-bold">{profileStorageDeposit} NEAR</p>
            <p className="text-xs text-muted-foreground mt-2">
              Only the exact storage used for your profile is kept by the contract.
            </p>
          </div>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatsCard
          icon={Wallet}
          label="Withdrawable"
          value={yoctoToNear(creator?.withdrawable_balance || "0")}
          suffix="NEAR"
          numericValue={Number(yoctoToNear(creator?.withdrawable_balance || "0"))}
        />
        <StatsCard
          icon={HeartHandshake}
          label="Total Donations"
          value={yoctoToNear(creator?.total_donations || "0")}
          suffix="NEAR"
          numericValue={Number(yoctoToNear(creator?.total_donations || "0"))}
        />
        <StatsCard
          icon={ArrowRight}
          label="Receipt Count"
          value={String(creator?.donation_count || 0)}
          numericValue={creator?.donation_count || 0}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card glow-border rounded-3xl p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Creator profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Profiles are keyed by NEAR account IDs. Donors send native NEAR to your profile
              through the contract and every donation is recorded on-chain.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="display-name" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Konigsegg Creator Studio"
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell fans what you build and why they should support it."
                className="bg-white/5 border-white/10 min-h-[110px]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="image-url" className="text-sm font-medium">
                Image URL
              </label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="gradient-btn text-white font-semibold px-5 py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for wallet
                  </>
                ) : creator ? (
                  "Update profile"
                ) : (
                  "Create profile"
                )}
              </button>

              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !creator || creator.withdrawable_balance === "0"}
                className="gradient-btn-outline text-foreground font-semibold px-5 py-3 rounded-xl disabled:opacity-60"
              >
                {isWithdrawing ? "Withdrawing..." : "Withdraw balance"}
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card glow-border rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Recent donations</h2>
              <p className="text-sm text-muted-foreground">
                Latest receipts for your creator account.
              </p>
            </div>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {donations.length > 0 ? (
              donations
                .slice()
                .reverse()
                .map((donation, index) => (
                  <div
                    key={`${donation.donor_id}-${donation.timestamp_ms}-${index}`}
                    className="rounded-2xl bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold font-mono truncate">
                          {donation.donor_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timestampLabel(donation.timestamp_ms)}
                        </p>
                      </div>
                      <p className="text-sm font-bold gradient-text">
                        {yoctoToNear(donation.amount)} NEAR
                      </p>
                    </div>
                    {donation.message && (
                      <p className="mt-2 text-xs text-muted-foreground">{donation.message}</p>
                    )}
                  </div>
                ))
            ) : (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center">
                <p className="text-sm font-semibold mb-2">No donations yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your profile and share it. Donations will appear here as soon as fans
                  start supporting you on testnet.
                </p>
                <Link
                  href="/"
                  className="gradient-btn-outline text-foreground font-semibold px-4 py-2 rounded-full inline-flex items-center gap-2"
                >
                  Go to creator list
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
