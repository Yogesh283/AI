"use client";

import { motion } from "framer-motion";
import { useSiteBrand } from "@/components/SiteBrandProvider";

export function NeoRing({ className = "" }: { className?: string }) {
  const { brandName } = useSiteBrand();

  return (    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
    >
      <div
        className="absolute h-52 w-52 rounded-full opacity-90 blur-3xl"
        style={{
          background: "conic-gradient(from 0deg, #00D4FF, #6A5CFF, #C85CFF, #00D4FF)",
        }}
      />
      <div className="absolute h-44 w-44 rounded-full border border-white/10 opacity-80" />
      <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 border-white/25 bg-[#0a1020]/95 shadow-[0_0_80px_rgba(0,212,255,0.45),inset_0_0_40px_rgba(189,0,255,0.08)] backdrop-blur-md">
        <span className="neo-gradient-text max-w-[11rem] truncate text-center text-2xl font-bold tracking-tight sm:text-3xl sm:tracking-wide">
          {brandName}
        </span>      </div>
    </motion.div>
  );
}
