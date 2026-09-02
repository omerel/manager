import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { isAdmin } from "@/lib/authz";
import { availableWindows, defaultWindow, usageStats } from "@/lib/usage-stats";

/**
 * The usage dashboard, taken away: a visual report or the figures behind it.
 *
 * Both describe exactly the window and selection asked for, and both are the
 * Admin's alone — the page is, so a link to its data must be too.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("not found", { status: 404 });

  const p = req.nextUrl.searchParams;
  const windows = availableWindows();
  const asked = Number(p.get("days"));
  const days = windows.includes(asked) ? asked : defaultWindow();
  const userId = p.get("user") || null;
  const stats = await usageStats({ days, userId });

  const stamp = new Date().toISOString().slice(0, 10);
  const scope = stats.focus ? `-${stats.focus.name}` : "";
  const base = `פעילות-${days}-ימים${scope}-${stamp}`.replace(/[/\\:*?"<>|]/g, "_");

  if (p.get("format") === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["משתמש", "תפקיד", "כניסות", "פעולות", "פעילות אחרונה", "כניסה אחרונה"],
        ...stats.users.map((u) => [
          u.name,
          ROLE[u.role] ?? u.role,
          u.logins,
          u.actions,
          u.lastActivity ? isoDay(u.lastActivity) : "",
          u.lastLoginAt ? isoDay(u.lastLoginAt) : "",
        ]),
      ]),
      "לפי משתמש",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["יום", "כניסות", "פעולות"], ...stats.daily.map((d) => [d.day, d.logins, d.actions])]),
      "לפי יום",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["סוג פעולה", "כמות"], ...stats.families.map((f) => [f.label, f.count])]),
      "לפי סוג",
    );
    const body: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.xlsx`)}`,
      },
    });
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(reportHtml(stats), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.pdf`)}`,
      },
    });
  } finally {
    await browser.close();
  }
}

const ROLE: Record<string, string> = { ADMIN: "אדמין", MANAGER: "מפקד", HR: "משא״ן" };
const isoDay = (d: Date) => new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem" }).format(d);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The same figures the page shows, laid out for paper. */
function reportHtml(s: Awaited<ReturnType<typeof usageStats>>): string {
  const max = Math.max(1, ...s.daily.map((d) => d.logins + d.actions));
  const bars = s.daily
    .map(
      (d) =>
        `<div class="bar" title="${d.day}">
           <i style="height:${(d.actions / max) * 100}%;background:#10b981"></i>
           <i style="height:${(d.logins / max) * 100}%;background:#064e3b"></i>
         </div>`,
    )
    .join("");
  const famMax = s.families[0]?.count ?? 1;
  const fams = s.families
    .map(
      (f) =>
        `<tr><td>${esc(f.label)}</td><td class="num">${f.count}</td>
         <td class="barcell"><span style="width:${Math.max((f.count / famMax) * 100, 3)}%"></span></td></tr>`,
    )
    .join("");
  const rows = s.users
    .map(
      (u) =>
        `<tr><td>${esc(u.name)}</td><td>${ROLE[u.role] ?? u.role}</td>
         <td class="num">${u.logins}</td><td class="num">${u.actions}</td>
         <td>${u.lastActivity ? isoDay(u.lastActivity) : "—"}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
    body { font-family: Rubik, 'Noto Sans Hebrew', sans-serif; margin: 0; color: #1c1917; }
    h1 { font-size: 20px; margin: 0 0 2mm; color: #064e3b; }
    p.sub { margin: 0 0 5mm; font-size: 11px; color: #78716c; }
    .tiles { display: flex; gap: 4mm; margin-bottom: 6mm; }
    .tile { flex: 1; border: 1px solid #e7e5e4; border-radius: 8px; padding: 3mm; text-align: center; }
    .tile b { display: block; font-size: 20px; }
    .tile span { font-size: 10px; color: #78716c; }
    h2 { font-size: 13px; margin: 0 0 2mm; color: #064e3b; }
    .chart { display: flex; align-items: flex-end; gap: 1px; height: 30mm; border-bottom: 1px solid #e7e5e4; margin-bottom: 5mm; }
    .bar { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; }
    .bar i { display: block; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { text-align: start; padding: 1.4mm 2mm; border-bottom: 1px solid #f5f5f4; }
    th { background: #fafaf9; color: #78716c; font-weight: 600; }
    td.num { text-align: center; }
    .barcell { width: 40%; }
    .barcell span { display: block; height: 6px; border-radius: 3px; background: #10b981; }
    .section { margin-bottom: 6mm; }
  </style></head><body>
    <h1>דשבורד פעילות${s.focus ? ` — ${esc(s.focus.name)}` : ""}</h1>
    <p class="sub">
      ${s.days} הימים האחרונים · הופק ${isoDay(new Date())} ·
      נספרות כניסות ופעולות שנרשמו; צפייה אינה נרשמת במערכת
    </p>
    <div class="tiles">
      <div class="tile"><b>${s.activeUsers}/${s.totalUsers}</b><span>משתמשים פעילים</span></div>
      <div class="tile"><b>${s.logins}</b><span>כניסות</span></div>
      <div class="tile"><b>${s.actions}</b><span>פעולות</span></div>
      <div class="tile"><b>${s.dormant}</b><span>רדומים</span></div>
    </div>
    <div class="section"><h2>פעילות לאורך זמן</h2><div class="chart">${bars}</div></div>
    <div class="section"><h2>פילוח לפי סוג פעולה</h2><table>${fams || '<tr><td colspan="3">אין פעילות</td></tr>'}</table></div>
    <div class="section"><h2>לפי משתמש</h2>
      <table><thead><tr><th>משתמש</th><th>תפקיד</th><th>כניסות</th><th>פעולות</th><th>פעילות אחרונה</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
  </body></html>`;
}
