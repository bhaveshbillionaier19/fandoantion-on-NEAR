"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  Loader2,
  ExternalLink,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  type CreatorView,
  explorerAccountUrl,
  shortenAccountId,
  timestampLabel,
  yoctoToNear,
} from "@/lib/near";

interface CreatorCardProps {
  creator: CreatorView;
  currentAccountId: string | null;
  onDonate: (creatorId: string, amountNear: string, message?: string) => Promise<void>;
}

export default function CreatorCard({
  creator,
  currentAccountId,
  onDonate,
}: CreatorCardProps) {
  const [donationAmount, setDonationAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isCreator = currentAccountId === creator.creator_id;
  const initials = creator.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleDonate() {
    if (!donationAmount || Number(donationAmount) <= 0) {
      toast({
        title: "Invalid donation",
        description: "Enter a positive NEAR amount to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onDonate(creator.creator_id, donationAmount, message);
      setDonationAmount("");
      setMessage("");
      toast({
        title: "Donation submitted",
        description:
          "The wallet has been asked to sign the donation transaction on NEAR testnet.",
      });
    } catch (error) {
      toast({
        title: "Donation failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="glass-card glow-border-hover rounded-2xl border border-white/[0.06] overflow-hidden"
    >
      <div className="relative p-5 border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="relative flex items-start gap-4">
          {creator.image_url ? (
            <img
              src={creator.image_url}
              alt={creator.display_name}
              className="h-16 w-16 rounded-2xl object-cover border border-white/[0.08]"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg font-bold">
              {initials || "FD"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold">{creator.display_name}</h3>
              {isCreator && (
                <span className="rounded-full bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold uppercase tracking-wider px-2 py-1">
                  Your profile
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
              {creator.creator_id}
            </p>
            {creator.bio && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {creator.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 border-b border-white/[0.06]">
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Total received
          </p>
          <p className="text-lg font-bold">{yoctoToNear(creator.total_donations)} NEAR</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Withdrawable
          </p>
          <p className="text-lg font-bold">
            {yoctoToNear(creator.withdrawable_balance)} NEAR
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Donation history
            </p>
            <p className="text-sm font-semibold">
              {creator.donation_count} on-chain receipt
              {creator.donation_count === 1 ? "" : "s"}
            </p>
          </div>
          <a
            href={explorerAccountUrl(creator.creator_id)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            Explorer
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="space-y-2">
          {creator.recent_donations.length > 0 ? (
            creator.recent_donations.map((donation, index) => (
              <div
                key={`${creator.creator_id}-${donation.timestamp_ms}-${index}`}
                className="rounded-2xl bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono truncate">
                      {shortenAccountId(donation.donor_id)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {timestampLabel(donation.timestamp_ms)}
                    </p>
                  </div>
                  <p className="text-sm font-bold gradient-text whitespace-nowrap">
                    {yoctoToNear(donation.amount)} NEAR
                  </p>
                </div>
                {donation.message && (
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {donation.message}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground/70 py-2">
              No donations yet. The first supporter will create the first on-chain receipt.
            </p>
          )}
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button className="w-full gradient-btn text-white font-semibold py-3 rounded-xl inline-flex items-center justify-center gap-2">
              <Heart className="w-4 h-4" />
              Donate NEAR
            </button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Support {creator.display_name}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Send native NEAR on testnet. The contract stores the donation receipt on-chain
                and the creator can later withdraw their balance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-white/[0.04] p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5" />
                  Creator account
                </div>
                <p className="font-mono mt-2 break-all text-foreground">{creator.creator_id}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor={`amount-${creator.creator_id}`} className="text-sm font-medium">
                  Amount
                </label>
                <div className="relative">
                  <Input
                    id={`amount-${creator.creator_id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1"
                    value={donationAmount}
                    onChange={(event) => setDonationAmount(event.target.value)}
                    className="pr-16 bg-white/5 border-white/10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    NEAR
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor={`message-${creator.creator_id}`} className="text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id={`message-${creator.creator_id}`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Thanks for creating."
                  className="bg-white/5 border-white/10 min-h-[90px]"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Your attached NEAR is sent through the contract. On-chain receipt storage is
                accounted for in the transaction, so the wallet may show the exact yoctoNEAR
                amount being signed.
              </p>

              <button
                onClick={handleDonate}
                disabled={isSubmitting}
                className="w-full gradient-btn text-white font-semibold py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for wallet
                  </>
                ) : (
                  <>
                    Confirm donation
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.article>
  );
}
