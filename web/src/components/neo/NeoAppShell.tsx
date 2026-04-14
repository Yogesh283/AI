/**
 * Constrains main app routes to a phone-like column — matches APK-style layout on web.
 * Use `wide` for full-width layouts (e.g. desktop chat).
 */
export function NeoAppShell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`relative z-[1] mx-auto w-full ${wide ? "max-w-none" : "max-w-lg"}`}
    >
      {children}
    </div>
  );
}
