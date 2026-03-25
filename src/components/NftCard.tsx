"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  type NftView,
  explorerAccountUrl,
  issuedAtLabel,
  nearContractId,
  nearGas,
  nearToYocto,
  nftMediaUrl,
} from "@/lib/near";

interface NftCardProps {
  token: NftView;
  compact?: boolean;
  showDonateControls?: boolean;
}

export default function NftCard({ token, compact = false, showDonateControls = false }: NftCardProps) {
  const mediaUrl = nftMediaUrl(token);
  const { signedAccountId, signIn, callFunction } = useWalletSelector();
  const { toast } = useToast();
  const [donationAmount, setDonationAmount] = useState("");
  const [isDonating, setIsDonating] = useState(false);

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
        args: { creator_id: token.creator_id },
        gas: nearGas,
        deposit: nearToYocto(donationAmount),
      });

      toast({
        title: "Donation transaction sent",
        description: "Approve the NEAR wallet prompt to complete the donation.",
      });
      setDonationAmount("");
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-card glow-border-hover rounded-2xl overflow-hidden border border-white/[0.06]"
    >
      <div className={`${compact ? "aspect-[4/3]" : "aspect-square"} bg-white/[0.04]`}>
        {mediaUrl ? (
          <img src={mediaUrl} alt={token.title || token.token_id} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
            No media
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-base line-clamp-1">{token.title || "Untitled NFT"}</h3>
          <p className="text-xs text-muted-foreground font-mono line-clamp-1 mt-1">{token.token_id}</p>
        </div>

        {token.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{token.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Minted {issuedAtLabel(token.issued_at)}</span>
          <a
            href={explorerAccountUrl(token.owner_id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Explorer
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {showDonateControls && (
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Input
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

            <button
              onClick={handleDonate}
              disabled={isDonating || signedAccountId === token.creator_id}
              className="w-full gradient-btn text-white font-semibold py-2.5 rounded-xl disabled:opacity-60"
            >
              {isDonating ? "Waiting for wallet" : signedAccountId === token.creator_id ? "This is your NFT" : "Donate"}
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}
