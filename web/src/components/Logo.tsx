/* eslint-disable @next/next/no-img-element */

/**
 * Default logomark: "growth steps" — three ascending stems with leaves,
 * drawn in brand greens. Crisp at any size; the revert target for custom logos.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#ecfdf5" />
      {/* ascending bars */}
      <rect x="10" y="28" width="7" height="10" rx="2.5" fill="#34d399" />
      <rect x="20.5" y="21" width="7" height="17" rx="2.5" fill="#10b981" />
      <rect x="31" y="13" width="7" height="25" rx="2.5" fill="#047857" />
      {/* sprouting leaf on the tallest bar */}
      <path
        d="M34.5 13C34.5 8.5 38 6 41.5 5.5C41.5 10 39 12.5 34.5 13Z"
        fill="#065f46"
      />
    </svg>
  );
}

/** The system logo: custom upload when configured, otherwise the default mark. */
export function AppLogo({ customLogo, size = 32 }: { customLogo: boolean; size?: number }) {
  if (customLogo) {
    return (
      <img
        src="/logo"
        alt="לוגו"
        style={{ height: size, width: "auto", maxWidth: size * 3 }}
        className="rounded-md object-contain"
      />
    );
  }
  return <LogoMark size={size} />;
}
