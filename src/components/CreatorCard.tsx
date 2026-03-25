"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Layers } from "lucide-react";
import {
  type CreatorView,
  nftMediaUrl,
  yoctoToNear,
} from "@/lib/near";

interface CreatorCardProps {
  creator: CreatorView;
  currentAccountId: string | null;
}

export default function CreatorCard({ creator, currentAccountId }: CreatorCardProps) {
  const isCurrentCreator = currentAccountId === creator.creator_id;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card glow-border-hover rounded-3xl overflow-hidden border border-white/[0.06]"
    >
      <div className="grid grid-cols-3 gap-3 p-6 border-b border-white/[0.06]">
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Minted</p>
          <p className="text-lg font-bold">{creator.nft_count}</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Donations</p>
          <p className="text-lg font-bold">{yoctoToNear(creator.total_donations)} NEAR</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Receipts</p>
          <p className="text-lg font-bold">{creator.donation_count}</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-300" />
            <p className="text-sm font-semibold">Latest minted NFTs</p>
          </div>
        </div>

        {creator.recent_nfts.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {creator.recent_nfts.map((token) => {
              const preview = nftMediaUrl(token);
              return (
                <Link
                  href={`/creator/${creator.creator_id}`}
                  key={token.token_id}
                  className="rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.03] hover:border-cyan-400/40 transition-colors"
                >
                  <div className="aspect-square bg-white/[0.04]">
                    {preview ? (
                      <img src={preview} alt={token.title || token.token_id} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[11px] text-muted-foreground">
                        No media
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium line-clamp-1">{token.title || "Untitled"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] px-4 py-6 text-sm text-muted-foreground">
            This creator has not minted an NFT yet.
          </div>
        )}

        <div className="pt-1">
          <Link
            href={`/creator/${creator.creator_id}`}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-opacity ${
              isCurrentCreator
                ? "gradient-btn-outline text-foreground opacity-60 pointer-events-none"
                : "gradient-btn text-white"
            }`}
          >
            <Heart className="w-4 h-4" />
            {isCurrentCreator ? "This is your creator account" : "Donate"}
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
