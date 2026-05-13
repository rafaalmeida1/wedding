'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export type GeneratingMethodVariant = 'pix' | 'boleto' | 'debit_caixa';

function Glow({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid place-items-center" aria-hidden>
      <motion.div
        className="absolute inset-[-20%] rounded-full bg-rose-gold-gradient opacity-20 blur-2xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {children}
    </div>
  );
}

/** Cantoneiras estilo QR + grade — identidade visual própria do PIX. */
function PixVisual({ size = 180 }: { size?: number }) {
  const s = size * 0.42;
  const corner = 'rounded-md border-[3px] border-rose-600 bg-rose-50/90';
  const dot = 'rounded-[1px] bg-rose-500/80';
  return (
    <Glow>
      <motion.div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-[12%] grid grid-cols-6 grid-rows-6 gap-0.5 opacity-50">
          {Array.from({ length: 36 }, (_, i) => (
            <motion.span
              key={i}
              className={dot}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.15, 0.55, 0.15] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: (i % 7) * 0.08,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <motion.div
          className={`absolute left-[10%] top-[10%] ${corner}`}
          style={{ width: s * 0.38, height: s * 0.38 }}
          animate={{ rotate: [0, 2, 0, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <span className="absolute inset-[18%] rounded-sm bg-rose-400/90" />
        </motion.div>
        <motion.div
          className={`absolute right-[10%] top-[10%] ${corner}`}
          style={{ width: s * 0.38, height: s * 0.38 }}
          animate={{ rotate: [0, -2, 0, 2, 0] }}
          transition={{ duration: 3.2, repeat: Infinity }}
        >
          <span className="absolute inset-[18%] rounded-sm bg-rose-400/90" />
        </motion.div>
        <motion.div
          className={`absolute bottom-[10%] left-[10%] ${corner}`}
          style={{ width: s * 0.38, height: s * 0.38 }}
          animate={{ rotate: [0, 1.5, 0, -1.5, 0] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        >
          <span className="absolute inset-[18%] rounded-sm bg-rose-400/90" />
        </motion.div>
        <div
          className="relative rounded-2xl border-2 border-dashed border-rose-300/80 bg-white/70 px-4 py-3 shadow-sm"
          style={{ width: s, height: s * 0.72 }}
        >
          <p className="text-center font-mono text-[10px] font-semibold tracking-widest text-rose-700">
            PIX
          </p>
          <motion.div
            className="mx-auto mt-2 h-1 w-12 rounded-full bg-rose-400"
            animate={{ scaleX: [0.6, 1, 0.6], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </Glow>
  );
}

/** Listras horizontais lembrando código de barras. */
function BoletoVisual({ size = 180 }: { size?: number }) {
  const bars = 14;
  return (
    <Glow>
      <div className="grid place-items-center" style={{ width: size, height: size }} aria-hidden>
        <motion.div
          className="flex h-24 w-40 items-stretch justify-center gap-0.5 overflow-hidden rounded-xl border border-rose-200 bg-white px-3 py-4 shadow-sm"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {Array.from({ length: bars }, (_, i) => (
            <motion.span
              key={i}
              className="rounded-[1px] bg-ink"
              style={{ width: 2 + (i % 4) * 1.5 }}
              animate={{ scaleY: [0.85, 1, 0.85] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.06,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
        <motion.p
          className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          34191 — boleto
        </motion.p>
      </div>
    </Glow>
  );
}

/** Celular + ondas — débito no app. */
function CaixaVisual({ size = 180 }: { size?: number }) {
  return (
    <Glow>
      <div className="relative grid place-items-center" style={{ width: size, height: size }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border-2 border-rose-400/50"
            style={{ width: size * 0.35 + i * 28, height: size * 0.35 + i * 28 }}
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{ opacity: [0.45, 0], scale: [0.92, 1.35] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: i * 0.45,
              ease: 'easeOut',
            }}
          />
        ))}
        <motion.div
          className="relative z-10 flex h-36 w-[4.5rem] flex-col items-center justify-between rounded-2xl border-2 border-rose-300 bg-gradient-to-b from-rose-50 to-white px-2 py-3 shadow-md"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="h-1 w-8 rounded-full bg-rose-200" />
          <span className="rounded-lg bg-rose-600 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-white">
            Caixa
          </span>
          <motion.span
            className="mb-1 h-8 w-8 rounded-full bg-rose-100"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </Glow>
  );
}

export function GeneratingMethodVisual({
  variant,
  size = 180,
}: {
  variant: GeneratingMethodVariant;
  size?: number;
}) {
  if (variant === 'pix') return <PixVisual size={size} />;
  if (variant === 'boleto') return <BoletoVisual size={size} />;
  return <CaixaVisual size={size} />;
}
