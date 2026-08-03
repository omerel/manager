import type { PersonFieldDef } from "@/generated/prisma/client";
import { DateField } from "@/components/DateField";
import { ageFromBirthDate } from "@/lib/person-name";

type CoreDefaults = {
  firstName?: string;
  lastName?: string;
  birthDate?: Date | null;
  recruitmentDate?: Date | null;
  placementDate?: Date | null;
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
      <Labeled label="שם פרטי">
        <input name="firstName" required defaultValue={core?.firstName ?? ""} className={inputCls} />
      </Labeled>
      <Labeled label="שם משפחה">
        <input name="lastName" required defaultValue={core?.lastName ?? ""} className={inputCls} />
      </Labeled>
      <Labeled label="תאריך לידה">
        <DateField name="birthDate" defaultDate={core?.birthDate} required className={inputCls} />
      </Labeled>
      <Labeled label="גיל (מחושב מתאריך הלידה)">
        <input
          value={ageFromBirthDate(core?.birthDate)}
          readOnly
          disabled
          className={`${inputCls} bg-stone-100 text-muted`}
        />
      </Labeled>
      <Labeled label="תאריך גיוס">
        <DateField name="recruitmentDate" defaultDate={core?.recruitmentDate} required className={inputCls} />
      </Labeled>
      <Labeled label="תאריך הצבה ביחידה (עוגן התכנית)">
        <DateField name="placementDate" defaultDate={core?.placementDate} required className={inputCls} />
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
      <Labeled label="תאריך סיום שירות (תת״ש) — אופציונלי">
        <DateField name="endOfServiceDate" defaultDate={core?.endOfServiceDate} className={inputCls} />
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
            ) : def.type === "DATE" ? (
              // a custom date is a date: same control, same rules as the core ones
              <DateField name={name} defaultDate={val} required={def.required} className={inputCls} />
            ) : (
              <input
                name={name}
                type={def.type === "NUMBER" ? "number" : "text"}
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
