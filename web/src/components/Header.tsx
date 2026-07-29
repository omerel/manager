import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { devSwitchEnabled } from "@/lib/auth";
import { UserSwitcher } from "@/components/UserSwitcher";

const navLinks = [
  { href: "/", label: "דשבורד" },
  { href: "/people", label: "אנשים" },
  { href: "/plans", label: "תכניות קריירה" },
  { href: "/chat", label: "דף שאלות" },
  { href: "/rules", label: "דף חוקים" },
  { href: "/access", label: "משתמשים והרשאות" },
];

function roleLabel(role: string): string {
  return role === "ADMIN" ? "אדמין" : "מנהל";
}

export async function Header() {
  const current = await getSessionUserOrNull();

  // signed out (e.g. on /login): brand only
  if (!current) {
    return (
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <span className="text-lg font-bold">ניהול קריירה</span>
        </div>
      </header>
    );
  }

  const links = current.role === "ADMIN" ? [...navLinks, { href: "/hierarchy", label: "היררכיה והתמחויות" }] : navLinks;
  const showSwitcher = devSwitchEnabled();
  const users = showSwitcher ? await prisma.user.findMany({ orderBy: { role: "asc" } }) : [];

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">ניהול קריירה</span>
          <nav className="flex items-center gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-muted hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {showSwitcher && (
            <UserSwitcher
              currentId={current.id}
              users={users.map((u) => ({ id: u.id, label: `${u.name} · ${roleLabel(u.role)}` }))}
            />
          )}
          <Link href="/account" className="text-sm text-muted hover:text-foreground" title="החשבון שלי">
            {current.name}
          </Link>
          <form action={logout}>
            <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-slate-50">התנתק</button>
          </form>
        </div>
      </div>
    </header>
  );
}
