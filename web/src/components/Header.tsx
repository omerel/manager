import Link from "next/link";
import { LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { devSwitchEnabled } from "@/lib/auth";
import { getLogoPath } from "@/lib/branding";
import { AppLogo } from "@/components/Logo";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { AdminMenu } from "@/components/AdminMenu";
import { UserSwitcher } from "@/components/UserSwitcher";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "דשבורד", icon: "dashboard" },
  { href: "/people", label: "אנשים", icon: "people" },
  { href: "/plans", label: "תכניות קריירה", icon: "plans" },
  { href: "/chat", label: "דף שאלות", icon: "chat" },
  { href: "/rules", label: "דף חוקים", icon: "rules" },
];

function roleLabel(role: string): string {
  return role === "ADMIN" ? "אדמין" : "מנהל";
}

export async function Header() {
  const [current, customLogo] = await Promise.all([getSessionUserOrNull(), getLogoPath()]);

  // signed out (e.g. on /login): brand strip only
  if (!current) {
    return (
      <header className="bg-brand-900">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <AppLogo customLogo={!!customLogo} size={30} />
          <span className="text-lg font-bold text-white">ניהול קריירה</span>
        </div>
      </header>
    );
  }

  const showSwitcher = devSwitchEnabled();
  const users = showSwitcher ? await prisma.user.findMany({ orderBy: { role: "asc" } }) : [];

  return (
    <header className="bg-brand-900 shadow-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo customLogo={!!customLogo} size={32} />
            <span className="text-lg font-bold text-white">ניהול קריירה</span>
          </Link>
          <NavLinks items={NAV_ITEMS} />
        </div>

        <div className="flex items-center gap-2">
          {current.role === "ADMIN" && (
            <AdminMenu>
              {showSwitcher && (
                <div className="space-y-1">
                  <div className="text-xs text-muted">מתג פיתוח — משתמש פעיל</div>
                  <UserSwitcher
                    currentId={current.id}
                    users={users.map((u) => ({ id: u.id, label: `${u.name} · ${roleLabel(u.role)}` }))}
                  />
                </div>
              )}
            </AdminMenu>
          )}
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-full bg-white/10 py-1 pe-3 ps-1 text-sm text-white hover:bg-white/15"
            title="החשבון שלי"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-900">
              {current.name.slice(0, 1)}
            </span>
            {current.name}
          </Link>
          <form action={logout}>
            <button
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-brand-100/90 hover:bg-white/10 hover:text-white"
              title="התנתק"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
