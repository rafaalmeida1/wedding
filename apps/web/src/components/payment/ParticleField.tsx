'use client';

import { useEffect, useRef } from 'react';

export type ParticleMode = 'ambient' | 'orbit' | 'burst';

interface ParticleFieldProps {
  mode: ParticleMode;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  alpha: number;
}

export function ParticleField({ mode, className }: ParticleFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const cx = () => canvas.clientWidth / 2;
    const cy = () => canvas.clientHeight / 2;

    const count = mode === 'burst' ? 80 : 32;
    const particles: Particle[] = Array.from({ length: count }).map(() => ({
      x: cx(),
      y: cy(),
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
      r: 1 + Math.random() * 2,
      hue: 320 + Math.random() * 30,
      alpha: 0.5 + Math.random() * 0.5,
    }));

    if (mode === 'burst') {
      for (const p of particles) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
      }
    }

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (const p of particles) {
        if (mode === 'orbit') {
          const dx = p.x - cx();
          const dy = p.y - cy();
          const r = Math.hypot(dx, dy) || 1;
          const ang = Math.atan2(dy, dx) + 0.018;
          const targetR = 90 + Math.sin(Date.now() / 800 + r) * 10;
          p.x = cx() + Math.cos(ang) * targetR;
          p.y = cy() + Math.sin(ang) * targetR;
        } else {
          p.x += p.vx;
          p.y += p.vy;
          if (mode === 'ambient') {
            if (p.x < 0 || p.x > canvas.clientWidth) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.clientHeight) p.vy *= -1;
          } else {
            p.vx *= 0.985;
            p.vy *= 0.985;
            p.alpha *= 0.985;
          }
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => cancelAnimationFrame(raf);
  }, [mode]);

  return <canvas ref={ref} className={className} />;
}
