"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Map,
  MessageCircleQuestion,
  ScrollText,
  Send,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  people: Users,
  plans: Map,
  chat: MessageCircleQuestion,
  rules: ScrollText,
  queries: Send,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; badgeTitle?: string };

/** Nav items with an active-state pill (path-prefix matching). */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
              active ? "bg-white/15 font-medium text-white" : "text-brand-100/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
            {!!item.badge && (
              <span
                className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-amber-950"
                title={item.badgeTitle || `${item.badge} פריטים ממתינים`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
