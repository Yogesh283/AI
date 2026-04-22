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
  const solid = `neo-gradient-fill inline-flex items-center justify-center rounded-2xl px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-55 ${className}`;
  const outline = `inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-medium text-slate-800 shadow-[4px_4px_14px_rgba(15,23,42,0.06)] backdrop-blur-sm transition hover:bg-slate-50 active:scale-[0.98] ${className}`;
  const cls = variant === "solid" ? solid : outline;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
