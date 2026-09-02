"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, Network, Settings, Shield, SlidersHorizontal } from "lucide-react";

/** Compact dropdown for admin-only pages (+ optional dev user-switcher slot). */
export function AdminMenu({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-brand-100/90 hover:bg-white/10 hover:text-white"
        title="ניהול מערכת"
      >
        <Settings className="h-4 w-4" aria-hidden />
        ניהול
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-border/70 bg-card p-1.5 text-foreground shadow-lg">
          <MenuLink href="/access" onPick={() => setOpen(false)}>
            <Shield className="h-4 w-4 text-brand-600" aria-hidden /> משתמשים והרשאות
          </MenuLink>
          <MenuLink href="/hierarchy" onPick={() => setOpen(false)}>
            <Network className="h-4 w-4 text-brand-600" aria-hidden /> היררכיה והתמחויות
          </MenuLink>
          <MenuLink href="/system" onPick={() => setOpen(false)}>
            <SlidersHorizontal className="h-4 w-4 text-brand-600" aria-hidden /> הגדרות מערכת
          </MenuLink>
          <MenuLink href="/system/usage" onPick={() => setOpen(false)}>
            <Activity className="h-4 w-4 text-brand-600" aria-hidden /> דשבורד פעילות
          </MenuLink>
          {children && <div className="mt-1 border-t border-border/70 px-2.5 py-2">{children}</div>}
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onPick, children }: { href: string; onPick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-brand-50"
    >
      {children}
    </Link>
  );
}
