'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Heart,
  Megaphone,
  ShoppingBag,
  Store,
  LayoutGrid,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Spec §6 work types — each maps to a starter-canvas preset in convex/blocks.ts.
const OPTIONS = [
  { id: "consultant_freelancer", label: "Consultant / Freelancer", icon: Briefcase, chip: "bg-violet-500/15 text-violet-400" },
  { id: "small_business", label: "Small Business Owner", icon: Store, chip: "bg-blue-500/15 text-blue-400" },
  { id: "creative", label: "Creative Professional", icon: Heart, chip: "bg-amber-500/15 text-amber-400" },
  { id: "marketing_agency", label: "Marketing / Content Agency", icon: Megaphone, chip: "bg-pink-500/15 text-pink-400" },
  { id: "online_seller", label: "Online Seller / E-commerce", icon: ShoppingBag, chip: "bg-rose-500/15 text-rose-400" },
  { id: "other", label: "Other", icon: LayoutGrid, chip: "bg-zinc-500/15 text-zinc-400" },
];

export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const seedStarter = useMutation(api.blocks.seedStarter);

  const handleSelect = async (option: string) => {
    setLoading(true);
    try {
      await seedStarter({ workType: option });
      window.location.href = "/"; // Use standard navigation
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-8 text-zinc-100 font-sans">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Welcome to Codex
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-100">
            What best describes your daily work?
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            We&rsquo;ll seed your canvas with the widgets that fit.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => handleSelect(opt.id)}
              disabled={loading}
              className="flex items-center gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/80 disabled:opacity-50 cursor-pointer"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${opt.chip}`}
              >
                <opt.icon size={18} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-zinc-100">
                  {opt.label}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Auto-configure your canvas
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {loading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent mb-4" />
            <p className="text-sm font-medium text-zinc-300">
              Personalizing Codex…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
