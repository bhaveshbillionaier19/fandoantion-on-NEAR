"use client";

import Link from "next/link";
import { Home, PlusCircle, LogOut, Copy, Check, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useToast } from "@/components/ui/use-toast";
import {
  explorerAccountUrl,
  nearContractId,
  nearNetworkLabel,
  shortenAccountId,
} from "@/lib/near";

const navLinks = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/creator", icon: PlusCircle, label: "Creator" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const { signedAccountId, signIn, signOut } = useWalletSelector();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowWalletPopup(false);
      }
    }

    if (showWalletPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWalletPopup]);

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const connected = mounted && Boolean(signedAccountId);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="hidden md:flex sticky top-0 z-40 glass-nav"
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 text-white text-sm font-bold shadow-lg shadow-purple-500/20 transition-transform group-hover:scale-110">
              FD
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold leading-tight gradient-text">
                Fan Donation
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Support creators on NEAR
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 hover:text-foreground ${
                  pathname === href
                    ? "text-foreground bg-white/[0.08]"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {pathname === href && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 rounded-full bg-white/[0.06] border border-white/[0.08]"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 rounded-full glass-card px-3 py-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            {nearNetworkLabel}
          </div>

          <div className="relative" ref={popupRef}>
            <button
              onClick={connected ? () => setShowWalletPopup(!showWalletPopup) : signIn}
              className="gradient-btn text-white text-sm font-semibold px-5 py-2 rounded-full inline-flex items-center gap-2"
            >
              {connected && signedAccountId ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  {shortenAccountId(signedAccountId, 8, 6)}
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>

            <AnimatePresence>
              {connected && signedAccountId && showWalletPopup && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-2xl glass-card border border-white/[0.08] p-4 shadow-2xl shadow-black/40 z-50"
                >
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.08]">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-medium text-green-400">Connected</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {nearNetworkLabel}
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Wallet Account
                    </p>
                    <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                      <span className="text-sm font-mono text-foreground truncate flex-1">
                        {signedAccountId}
                      </span>
                      <button
                        onClick={() => copyAddress(signedAccountId)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Contract
                    </p>
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm font-mono break-all">
                      {nearContractId}
                    </div>
                  </div>

                  <a
                    href={explorerAccountUrl(signedAccountId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on Explorer
                  </a>

                  <button
                    onClick={async () => {
                      await signOut();
                      setShowWalletPopup(false);
                      toast({
                        title: "Wallet disconnected",
                        description: "The NEAR wallet session has been cleared from the app.",
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 py-2.5 text-sm font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect Wallet
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
