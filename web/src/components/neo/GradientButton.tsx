import Link from "next/link";

type Props = {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "solid" | "outline";
  type?: "button" | "submit";
  disabled?: boolean;
};

export function GradientButton({
  href,
  children,
  onClick,
  className = "",
  variant = "solid",
  type = "button",
  disabled = false,
}: Props) {
  const solid = `neo-gradient-fill inline-flex items-center justify-center rounded-2xl px-8 py-3.5 text-sm font-semibold text-[#050912] shadow-[0_0_36px_rgba(0,212,255,0.32),0_0_48px_rgba(106,92,255,0.18)] transition hover:brightness-110 active:scale-[0.98] ${className}`;
  const outline = `inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-medium text-white/85 backdrop-blur-sm transition hover:border-[#00D4FF]/50 hover:bg-white/10 active:scale-[0.98] ${className}`;
  const cls = variant === "solid" ? solid : outline;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cls}
    >
      {children}
    </button>
  );
}
