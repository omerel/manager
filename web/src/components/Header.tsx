import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
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
  const [current, users] = await Promise.all([
    getSessionUser(),
    prisma.user.findMany({ orderBy: { role: "asc" } }),
  ]);
  const links = current.role === "ADMIN" ? [...navLinks, { href: "/hierarchy", label: "היררכיה והתמחויות" }] : navLinks;

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
        <UserSwitcher
          currentId={current.id}
          users={users.map((u) => ({ id: u.id, label: `${u.name} · ${roleLabel(u.role)}` }))}
        />
      </div>
    </header>
  );
}
