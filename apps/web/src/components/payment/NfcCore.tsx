'use client';

import { motion } from 'framer-motion';

interface NfcCoreProps {
  active?: boolean;
  size?: number;
}

export function NfcCore({ active = false, size = 140 }: NfcCoreProps) {
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border-2 border-rose-400"
          style={{ width: size, height: size }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={
            active
              ? { scale: [0.6, 1.2, 1.6], opacity: [0, 0.55, 0] }
              : { scale: [0.6, 0.85, 1], opacity: [0, 0.4, 0] }
          }
          transition={{
            duration: active ? 1.6 : 2.4,
            repeat: Infinity,
            delay: i * (active ? 0.4 : 0.7),
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        className="relative grid h-16 w-16 place-items-center rounded-full bg-rose-600 text-white shadow-bloom"
        animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M5 12c0-3.866 3.134-7 7-7" strokeLinecap="round" />
          <path d="M9 12c0-1.657 1.343-3 3-3" strokeLinecap="round" />
          <path d="M12 12h.01" strokeLinecap="round" />
          <path d="M15 12c0-1.657-1.343-3-3-3" strokeLinecap="round" />
          <path d="M19 12c0-3.866-3.134-7-7-7" strokeLinecap="round" />
        </svg>
      </motion.div>
    </div>
  );
}
