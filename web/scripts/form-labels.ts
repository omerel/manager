import { readFile } from "fs/promises";

/**
 * The fields `PersonFormFields` actually renders, read from its SOURCE.
 *
 * Reading the source rather than importing `CORE_FIELDS` is the point: a check
 * that imports the same constant the form imports can only ever agree with
 * itself, and would pass while the form rendered something else entirely.
 *
 * Extraction lives here because two suites need it — `verify-delete-authz`
 * (does the card-schema page name every rendered field?) and
 * `verify-agent-snapshot` (does every rendered field reach the agent?). Each
 * had its own copy of the regex, and adding a `hint` attribute to one
 * `<Labeled>` broke one copy while the other kept passing. Normalisation stays
 * with each caller, because what counts as the field's "name" differs by
 * question; only the fragile part is shared.
 */
export type LabeledField = { label: string; hint?: string };

const LABELED = /<Labeled\s+([^>]*?)>/g;
const ATTR = (name: string) => new RegExp(`\\b${name}="([^"]+)"`);

export async function readLabeledFields(): Promise<LabeledField[]> {
  const src = await readFile(new URL("../src/components/PersonFormFields.tsx", import.meta.url), "utf8");
  const out: LabeledField[] = [];
  for (const m of src.matchAll(LABELED)) {
    const attrs = m[1];
    const label = ATTR("label").exec(attrs)?.[1];
    if (!label) continue; // a <Labeled> without a literal label is not readable here
    const hint = ATTR("hint").exec(attrs)?.[1];
    out.push(hint ? { label, hint } : { label });
  }
  return out;
}
