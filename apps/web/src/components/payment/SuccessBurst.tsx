'use client';

import { motion } from 'framer-motion';

export function SuccessBurst({ size = 180 }: { size?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full bg-emerald-200/70 blur-3xl"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 2.4, 1.4], opacity: [0, 0.7, 0.2] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      <motion.div
        className="grid h-24 w-24 place-items-center rounded-full bg-emerald-500 shadow-bloom"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <motion.svg
          viewBox="0 0 32 32"
          width="44"
          height="44"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M7 16l6 6 12-13"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.35, duration: 0.55, ease: 'easeOut' }}
          />
        </motion.svg>
      </motion.div>
    </div>
  );
}
