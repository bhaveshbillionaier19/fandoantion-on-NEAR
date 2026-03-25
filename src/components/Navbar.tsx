"use client";

import Link from "next/link";
import { Home, LayoutDashboard, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useToast } from "@/components/ui/use-toast";
import {
  nearNetworkLabel,
  yoctoToNear,
} from "@/lib/near";

const navLinks = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: LayoutDashboard, label: "MintNFT" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { signedAccountId, signIn, signOut, getBalance } = useWalletSelector();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
              <span className="text-sm font-bold leading-tight gradient-text">Fan Donation</span>
              <span className="text-[10px] text-muted-foreground leading-tight">NFT creators on NEAR</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 hover:text-foreground ${
                    isActive ? "text-foreground bg-white/[0.08]" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 rounded-full bg-white/[0.06] border border-white/[0.08]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
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
              className="gradient-btn text-white text-sm font-semibold px-4 py-2 rounded-full inline-flex items-center gap-3"
            >
              {connected && signedAccountId ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="max-w-[180px] truncate text-sm">{signedAccountId}</span>
                    <span className="text-xs text-white/80">
                      {walletBalance === null ? "Loading..." : `${yoctoToNear(walletBalance)} NEAR`}
                    </span>
                  </span>
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
                    <span className="ml-auto text-xs text-muted-foreground">{nearNetworkLabel}</span>
                  </div>

                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Wallet</p>
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                      <p className="text-sm font-mono text-foreground truncate">{signedAccountId}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {walletBalance === null ? "Loading balance..." : `${yoctoToNear(walletBalance)} NEAR`}
                      </p>
                    </div>
                  </div>

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
