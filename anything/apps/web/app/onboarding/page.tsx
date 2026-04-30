'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Heart,
  Code,
  ShoppingBag,
  Globe,
  MessageSquare,
} from "lucide-react";

const OPTIONS = [
  { id: "solo", label: "Solo Founder", icon: Briefcase, color: "bg-blue-500" },
  {
    id: "freelance",
    label: "Freelancer",
    icon: Globe,
    color: "bg-emerald-500",
  },
  {
    id: "consultant",
    label: "Consultant",
    icon: MessageSquare,
    color: "bg-purple-500",
  },
  {
    id: "retail",
    label: "E-commerce",
    icon: ShoppingBag,
    color: "bg-rose-500",
  },
  {
    id: "creative",
    label: "Creative Professional",
    icon: Heart,
    color: "bg-amber-500",
  },
  { id: "dev", label: "Software Engineer", icon: Code, color: "bg-zinc-500" },
];

export default function Onboarding() {
  const [loading, setLoading] = useState(false);

  const handleSelect = async (option: string) => {
    setLoading(true);
    try {
      // Seed initial widgets based on industry
      await fetch("/api/widgets/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: option }),
      });
      window.location.href = "/"; // Use standard navigation
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-8 text-white font-sans">
      <div className="max-w-3xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-black tracking-tighter mb-4 italic">
            FIRST QUESTION.
          </h1>
          <p className="text-zinc-500 text-xl font-medium">
            What best describes your daily work?
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => handleSelect(opt.id)}
              disabled={loading}
              className="flex items-center gap-6 rounded-[32px] border border-zinc-800 bg-zinc-900 p-8 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <div
                className={`h-16 w-16 rounded-3xl ${opt.color} flex items-center justify-center text-white shadow-2xl shadow-${opt.color.split("-")[1]}-500/20`}
              >
                <opt.icon size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">
                  {opt.label}
                </h3>
                <p className="text-zinc-500 font-medium">
                  Auto-configure your canvas
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xl z-50 flex flex-col items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent mb-4" />
            <p className="text-xl font-black uppercase tracking-widest italic animate-pulse">
              Personalizing Codex...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
