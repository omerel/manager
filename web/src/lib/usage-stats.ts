import { prisma } from "@/lib/prisma";

/**
 * How the system is being used — one aggregation, three renderings (the page,
 * the PDF, the spreadsheet). It counts only what is already recorded: sign-ins
 * and the write trail. Reading leaves no trace anywhere in this system, so a
 * quiet row means "changed little", never "was not here" — the page says so.
 */

/** The clock the days are counted on. A 00:30 action belongs to ITS day. */
const TZ = "Asia/Jerusalem";

/** Retention, read the same way `activity-log` reads it; 0 = keep everything. */
export function retentionDays(): number {
  const raw = Number(process.env.ACTIVITY_LOG_DAYS ?? 30);
  return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : 30;
}

/**
 * The windows the page may offer. Bounded by retention, deliberately: a window
 * reaching past what is kept would draw a deletion as a decline.
 */
export function availableWindows(): number[] {
  const keep = retentionDays();
  const all = [7, 30, 90];
  return keep === 0 ? all : all.filter((d) => d <= keep);
}

export function defaultWindow(): number {
  const w = availableWindows();
  return w.includes(30) ? 30 : (w[w.length - 1] ?? 7);
}

export type UsageRow = {
  userId: string;
  name: string;
  role: string;
  logins: number;
  actions: number;
  lastActivity: Date | null;
  lastLoginAt: Date | null;
  /** one count per day of the window, oldest first — the sparkline's series */
  series: number[];
};

export type UsageStats = {
  days: number;
  from: Date;
  /** the retention in force, so the page can state what bounds it; 0 = unlimited */
  retention: number;
  activeUsers: number;
  totalUsers: number;
  logins: number;
  actions: number;
  dormant: number;
  /** one bucket per day of the window, oldest first */
  daily: { day: string; logins: number; actions: number }[];
  /** by the family in the action's own name: `person.create` → `person` */
  families: { family: string; label: string; count: number }[];
  users: UsageRow[];
  /** the single user this describes, when narrowed */
  focus: { id: string; name: string } | null;
};

/** A sign-in is an action too, but it is counted on its own line, never twice. */
const LOGIN_ACTION = "auth.login";

const FAMILY_LABEL: Record<string, string> = {
  auth: "כניסות",
  person: "אנשים",
  people: "אנשים — ייצוא",
  org: "מסגרות",
  plan: "תכניות",
  progress: "התקדמות",
  eval: "חוות דעת",
  user: "משתמשים",
  grant: "הרשאות",
  hr: "משא״ן",
  intake: "קליטה",
  query: "שאילתות",
  rule: "חוקים",
  branding: "מיתוג",
  schema: "שדות כרטיס",
  dev: "כלי פיתוח",
};
const familyOf = (action: string) => action.split(".")[0] ?? "אחר";

/** `yyyy-mm-dd` in Israel time — the key both the SQL and the filling agree on. */
function israeliDayKey(d: Date): string {
  // en-CA renders as yyyy-mm-dd, which sorts correctly as a string
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Every day of the window, oldest first, so a quiet day is a zero and not a gap. */
function dayKeys(from: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(israeliDayKey(new Date(from.getTime() + i * 86400_000)));
  }
  return out;
}

export async function usageStats({ days, userId }: { days: number; userId?: string | null }): Promise<UsageStats> {
  const from = new Date(Date.now() - (days - 1) * 86400_000);
  from.setUTCHours(0, 0, 0, 0);
  const where = { createdAt: { gte: from }, ...(userId ? { actorId: userId } : {}) };

  const [users, entries] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, role: true, lastLoginAt: true },
      orderBy: { name: "asc" },
    }),
    // the window's entries, with only the columns the aggregation needs. The
    // (actorId, createdAt) index carries this; the bucketing is done here so
    // that ONE read answers the timeline, the families and every user's row.
    prisma.activityLog.findMany({
      where,
      select: { actorId: true, action: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const keys = dayKeys(from, days);
  const keyIndex = new Map(keys.map((k, i) => [k, i]));

  const daily = keys.map((day) => ({ day, logins: 0, actions: 0 }));
  const familyCount = new Map<string, number>();
  const perUser = new Map<string, { logins: number; actions: number; last: Date | null; series: number[] }>();
  const seen = new Set<string>();

  for (const e of entries) {
    const idx = keyIndex.get(israeliDayKey(e.createdAt));
    const isLogin = e.action === LOGIN_ACTION;
    if (idx !== undefined) {
      if (isLogin) daily[idx].logins++;
      else daily[idx].actions++;
    }
    const fam = familyOf(e.action);
    familyCount.set(fam, (familyCount.get(fam) ?? 0) + 1);

    const row = perUser.get(e.actorId) ?? { logins: 0, actions: 0, last: null, series: keys.map(() => 0) };
    if (isLogin) row.logins++;
    else row.actions++;
    if (idx !== undefined) row.series[idx]++;
    if (!row.last || e.createdAt > row.last) row.last = e.createdAt;
    perUser.set(e.actorId, row);
    seen.add(e.actorId);
  }

  const dormantCutoff = new Date(Date.now() - 30 * 86400_000);
  const scoped = userId ? users.filter((u) => u.id === userId) : users;

  const rows: UsageRow[] = scoped.map((u) => {
    const r = perUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      logins: r?.logins ?? 0,
      actions: r?.actions ?? 0,
      lastActivity: r?.last ?? null,
      lastLoginAt: u.lastLoginAt,
      series: r?.series ?? keys.map(() => 0),
    };
  });
  // busiest first: the table answers "who is using this", so it should not open
  // on whoever happens to sort first alphabetically
  rows.sort((a, b) => b.logins + b.actions - (a.logins + a.actions) || a.name.localeCompare(b.name, "he"));

  const focusUser = userId ? users.find((u) => u.id === userId) ?? null : null;

  return {
    days,
    from,
    retention: retentionDays(),
    activeUsers: scoped.filter((u) => seen.has(u.id)).length,
    totalUsers: scoped.length,
    logins: daily.reduce((s, d) => s + d.logins, 0),
    actions: daily.reduce((s, d) => s + d.actions, 0),
    // dormancy is about the PERSON, not the window — hence lastLoginAt, and a
    // user who has never signed in counts as dormant
    dormant: scoped.filter((u) => !u.lastLoginAt || u.lastLoginAt < dormantCutoff).length,
    daily,
    families: [...familyCount.entries()]
      .map(([family, count]) => ({ family, label: FAMILY_LABEL[family] ?? family, count }))
      .sort((a, b) => b.count - a.count),
    users: rows,
    focus: focusUser ? { id: focusUser.id, name: focusUser.name } : null,
  };
}
