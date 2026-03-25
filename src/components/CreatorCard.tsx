"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, Heart, Layers } from "lucide-react";
import {
  type CreatorView,
  explorerAccountUrl,
  nftMediaUrl,
  shortenAccountId,
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
      <div className="p-6 border-b border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="text-xl font-bold">{shortenAccountId(creator.creator_id, 16, 10)}</h3>
              {isCurrentCreator && (
                <span className="rounded-full bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold uppercase tracking-wider px-2 py-1">
                  You
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono break-all">{creator.creator_id}</p>
          </div>
          <a
            href={explorerAccountUrl(creator.creator_id)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Explorer
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

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
          <Link
            href={`/creator/${creator.creator_id}`}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View profile
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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

        <div className="flex gap-3 pt-1">
          <Link
            href={`/creator/${creator.creator_id}`}
            className="flex-1 gradient-btn text-white font-semibold py-3 rounded-xl inline-flex items-center justify-center gap-2"
          >
            <Heart className="w-4 h-4" />
            Open creator profile
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
