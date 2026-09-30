'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, PenSquare } from 'lucide-react';

/** Render the EmptyState component. */
export default function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/80 p-12 text-center"
    >
      <div className="relative">
        <Mail className="h-16 w-16 text-muted-foreground/30" />
      </div>
      <h3 className="heading-font mt-6 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Link
        href="/app/compose"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#7b1b5a] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#7b1b5a]/30 transition-all hover:shadow-xl hover:shadow-[#7b1b5a]/40"
      >
        <PenSquare className="h-4 w-4" />
        Compose Email
      </Link>
    </motion.div>
  );
}
