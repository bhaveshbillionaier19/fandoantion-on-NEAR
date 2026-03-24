"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Layers, TrendingUp, Award, ArrowRight, Wallet } from "lucide-react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import Hero from "@/components/Hero";
import StatsCard from "@/components/StatsCard";
import CreatorCard from "@/components/CreatorCard";
import { useToast } from "@/components/ui/use-toast";
import {
  type CreatorView,
  nearContractId,
  nearGas,
  nearToYocto,
  shortenAccountId,
  timestampLabel,
  yoctoToNear,
} from "@/lib/near";

type FeedItem = {
  creatorId: string;
  creatorName: string;
  donorId: string;
  amount: string;
  timestampMs: number;
  message?: string | null;
};

export default function Home() {
  const {
    signedAccountId,
    signIn,
    viewFunction,
    callFunction,
    getBalance,
  } = useWalletSelector();
  const { toast } = useToast();

  const [creators, setCreators] = useState<CreatorView[]>([]);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCreators = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const result = (await viewFunction({
          contractId: nearContractId,
          method: "list_creators",
          args: {
            from_index: 0,
            limit: 50,
          },
        })) as CreatorView[];

        setCreators(result || []);
      } catch (error) {
        toast({
          title: "Failed to load creators",
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [toast, viewFunction]
  );

  useEffect(() => {
    loadCreators(true);
    const interval = setInterval(() => loadCreators(false), 15000);
    return () => clearInterval(interval);
  }, [loadCreators]);

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

  async function handleDonate(creatorId: string, amountNear: string, message?: string) {
    if (!signedAccountId) {
      signIn();
      return;
    }

    const attachedDeposit = nearToYocto(amountNear);
    if (!attachedDeposit) {
      throw new Error("Enter a valid NEAR amount.");
    }

    await callFunction({
      contractId: nearContractId,
      method: "donate",
      args: {
        creator_id: creatorId,
        message,
      },
      gas: nearGas,
      deposit: attachedDeposit,
    });

    await loadCreators(false);
  }

  const totalDonationsYocto = useMemo(
    () =>
      creators.reduce(
        (sum, creator) => sum + BigInt(creator.total_donations || "0"),
        0n
      ),
    [creators]
  );

  const topSupportedNames = useMemo(() => {
    if (creators.length === 0) {
      return "No creators registered";
    }

    return [...creators]
      .sort((left, right) =>
        BigInt(right.total_donations) > BigInt(left.total_donations) ? 1 : -1
      )
      .slice(0, 3)
      .map((creator) => creator.display_name)
      .join(", ");
  }, [creators]);

  const activityFeed = useMemo<FeedItem[]>(
    () =>
      creators
        .flatMap((creator) =>
          creator.recent_donations.map((donation) => ({
            creatorId: creator.creator_id,
            creatorName: creator.display_name,
            donorId: donation.donor_id,
            amount: donation.amount,
            timestampMs: donation.timestamp_ms,
            message: donation.message,
          }))
        )
        .sort((left, right) => right.timestampMs - left.timestampMs)
        .slice(0, 10),
    [creators]
  );

  return (
    <main className="relative z-10">
      <Hero />

      <section className="container mx-auto px-4 -mt-8 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            icon={Layers}
            label="Registered Creators"
            value={String(creators.length)}
            numericValue={creators.length}
          />
          <StatsCard
            icon={TrendingUp}
            label="Total Donations"
            value={yoctoToNear(totalDonationsYocto)}
            suffix="NEAR"
            numericValue={Number(yoctoToNear(totalDonationsYocto))}
          />
          <StatsCard icon={Award} label="Top Supported" value={topSupportedNames} />
        </div>
      </section>

      <section className="container mx-auto px-4 mb-12">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-card glow-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Wallet status</h2>
                <p className="text-xs text-muted-foreground">
                  Using MyNearWallet on NEAR testnet
                </p>
              </div>
            </div>

            {signedAccountId ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Connected account
                  </p>
                  <p className="text-sm font-mono break-all">{signedAccountId}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Native balance
                  </p>
                  <p className="text-lg font-bold">
                    {walletBalance === null ? "Loading..." : `${yoctoToNear(walletBalance)} NEAR`}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Active contract
                  </p>
                  <p className="text-sm font-mono break-all">{nearContractId}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your NEAR testnet wallet to donate or create a profile. This app uses
                  named accounts like <span className="font-mono text-foreground">user.testnet</span>{" "}
                  instead of Aptos-style `0x...` addresses.
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

          <div className="glass-card glow-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Heart className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Recent support</h2>
                <p className="text-xs text-muted-foreground">
                  Fresh on-chain donation receipts
                </p>
              </div>
            </div>

            {activityFeed.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {activityFeed.map((item, index) => (
                  <motion.div
                    key={`${item.creatorId}-${item.donorId}-${item.timestampMs}-${index}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl bg-white/[0.03] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {item.creatorName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {shortenAccountId(item.donorId)}
                        </p>
                      </div>
                      <p className="text-sm font-bold gradient-text whitespace-nowrap">
                        {yoctoToNear(item.amount)} NEAR
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {timestampLabel(item.timestampMs)}
                    </p>
                    {item.message && (
                      <p className="text-xs text-muted-foreground mt-2">{item.message}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 py-6">
                No donation receipts yet. Register a creator profile and send the first NEAR
                testnet donation.
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="creators" className="container mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h2 className="text-2xl font-bold">Creator directory</h2>
            <p className="text-sm text-muted-foreground">
              Browse creator profiles and send NEAR testnet donations
            </p>
          </div>
          <Link
            href="/creator"
            className="gradient-btn-outline text-foreground text-sm font-medium px-4 py-2 rounded-full inline-flex items-center gap-2 hover:bg-white/5 transition-colors"
          >
            Manage profile
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>

        {isRefreshing && (
          <p className="text-xs text-muted-foreground mb-4">
            Refreshing on-chain data from {nearContractId}...
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl h-[420px] shimmer border border-white/[0.06]"
              />
            ))
          ) : creators.length > 0 ? (
            creators.map((creator) => (
              <CreatorCard
                key={creator.creator_id}
                creator={creator}
                currentAccountId={signedAccountId}
                onDonate={handleDonate}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <div className="glass-card glow-border rounded-2xl p-10 max-w-md mx-auto">
                <Layers className="w-12 h-12 text-purple-400/60 mx-auto mb-4" />
                <p className="mb-2 text-lg font-semibold">No creators found yet</p>
                <p className="mb-6 text-sm text-muted-foreground">
                  Create the first NEAR creator profile and start collecting donations on testnet.
                </p>
                <Link
                  href="/creator"
                  className="gradient-btn text-white font-semibold px-6 py-2.5 rounded-full text-sm inline-flex items-center gap-2"
                >
                  Create profile
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
