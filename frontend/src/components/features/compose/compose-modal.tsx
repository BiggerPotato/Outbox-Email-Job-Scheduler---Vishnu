'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import CampaignForm from '@/components/features/compose/campaign-form';
import { PenSquare } from 'lucide-react';

/** Render the ComposeModal component. */
export default function ComposeModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative inline-flex items-center gap-2 rounded-lg bg-[#7b1b5a] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7b1b5a]/30 transition-all hover:shadow-xl hover:shadow-[#7b1b5a]/40"
        >
          <PenSquare className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
          Compose New Email
          <span className="pointer-events-none absolute inset-0 rounded-lg bg-white/15 opacity-0 transition-opacity group-hover:opacity-100" />
        </motion.button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <DialogHeader>
            <DialogTitle>Compose New Email</DialogTitle>
            <DialogDescription>
              Upload recipients, craft the message, and schedule a precise send time.
            </DialogDescription>
          </DialogHeader>
          <CampaignForm onSuccess={() => setOpen(false)} />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
