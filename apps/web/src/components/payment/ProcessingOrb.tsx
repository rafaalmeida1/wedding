'use client';

import { motion } from 'framer-motion';

export function ProcessingOrb({ size = 180 }: { size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full bg-rose-gold-gradient opacity-25 blur-2xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />

      <motion.div
        className="relative flex aspect-[1.6/1] w-32 flex-col justify-between rounded-2xl bg-gradient-to-br from-rose-700 to-rose-500 p-3 text-[10px] text-rose-50 shadow-bloom"
        initial={{ rotateX: 0, rotateY: 0 }}
        animate={{ rotateX: [0, 6, 0, -6, 0], rotateY: [0, -8, 0, 8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-serif text-[11px] tracking-wider">PRESENTE</span>
          <span className="rounded-sm bg-rose-200/40 px-1 py-0.5 text-[8px]">VISA</span>
        </div>
        <div className="flex h-6 w-9 items-center justify-center rounded-md bg-rose-300/60">
          <span className="block h-3 w-7 rounded-sm bg-rose-200/80" />
        </div>
        <div className="space-y-1">
          <div className="h-1 w-3/5 rounded-full bg-rose-100/70" />
          <div className="flex justify-between">
            <span>•••• 1234</span>
            <span>12/29</span>
          </div>
        </div>
      </motion.div>

      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        stroke="currentColor"
      >
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth="3"
          stroke="#C2185B"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: [circumference, circumference * 0.25, circumference],
            rotate: 360,
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '50% 50%' }}
        />
      </svg>
    </div>
  );
}
