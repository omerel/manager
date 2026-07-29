import type { PersonFieldDef } from "@/generated/prisma/client";
import { toDateInput } from "@/lib/dates";

type CoreDefaults = {
  fullName?: string;
  recruitmentDate?: Date | null;
  status?: string;
  endOfServiceDate?: Date | null;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ACTIVE", label: "פעיל" },
  { value: "PLANNED_END", label: "סיום מתוכנן" },
  { value: "DEPARTED", label: "עזב" },
];

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export function PersonFormFields({
  defs,
  valueByDef,
  core,
}: {
  defs: PersonFieldDef[];
  valueByDef?: Record<string, string>;
  core?: CoreDefaults;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Labeled label="שם מלא">
        <input name="fullName" required defaultValue={core?.fullName ?? ""} className={inputCls} />
      </Labeled>
      <Labeled label="תאריך גיוס (עוגן התכנית)">
        <input type="date" name="recruitmentDate" required defaultValue={toDateInput(core?.recruitmentDate)} className={inputCls} />
      </Labeled>
      <Labeled label="סטטוס העסקה">
        <select name="status" defaultValue={core?.status ?? "ACTIVE"} className={inputCls}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="תאריך סיום שירות (אופציונלי)">
        <input type="date" name="endOfServiceDate" defaultValue={toDateInput(core?.endOfServiceDate)} className={inputCls} />
      </Labeled>

      {defs.map((def) => {
        const name = `field_${def.id}`;
        const val = valueByDef?.[def.id] ?? "";
        return (
          <Labeled key={def.id} label={def.label + (def.required ? " *" : "")}>
            {def.type === "ENUM" ? (
              <select name={name} defaultValue={val} className={inputCls}>
                <option value="">—</option>
                {def.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={name}
                type={def.type === "DATE" ? "date" : def.type === "NUMBER" ? "number" : "text"}
                step={def.type === "NUMBER" ? "any" : undefined}
                required={def.required}
                defaultValue={val}
                className={inputCls}
              />
            )}
          </Labeled>
        );
      })}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-sm text-muted">{label}</label>
      {children}
    </div>
  );
}
