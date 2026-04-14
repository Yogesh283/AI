"use client";

export function NeoBackground({ stars = 48 }: { stars?: number }) {
  return (
    <>
      <div className="neo-starfield" aria-hidden>
        {Array.from({ length: stars }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 10) * 0.4}s`,
            }}
          />
        ))}
      </div>
      <div className="neo-bottom-wave" aria-hidden />
    </>
  );
}
