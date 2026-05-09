export function FloralBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-rose-gold-gradient opacity-15" />
      <svg
        aria-hidden
        className="absolute -top-24 -left-24 h-96 w-96 text-rose-300/30"
        viewBox="0 0 200 200"
        fill="none"
      >
        <Petals />
      </svg>
      <svg
        aria-hidden
        className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rotate-180 text-rose-200/40"
        viewBox="0 0 200 200"
        fill="none"
      >
        <Petals />
      </svg>
    </div>
  );
}

function Petals() {
  return (
    <g stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.4">
      <circle cx="100" cy="100" r="6" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 100 + Math.cos(a) * 14;
        const y1 = 100 + Math.sin(a) * 14;
        const x2 = 100 + Math.cos(a) * 60;
        const y2 = 100 + Math.sin(a) * 60;
        return (
          <ellipse
            key={i}
            cx={(x1 + x2) / 2}
            cy={(y1 + y2) / 2}
            rx="22"
            ry="8"
            transform={`rotate(${(i * 360) / 8} 100 100)`}
            fill="currentColor"
            fillOpacity="0.18"
          />
        );
      })}
    </g>
  );
}
