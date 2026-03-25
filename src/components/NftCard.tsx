"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import {
  type NftView,
  explorerAccountUrl,
  issuedAtLabel,
  nftMediaUrl,
} from "@/lib/near";

interface NftCardProps {
  token: NftView;
  compact?: boolean;
}

export default function NftCard({ token, compact = false }: NftCardProps) {
  const mediaUrl = nftMediaUrl(token);

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
      </div>
    </motion.article>
  );
}
