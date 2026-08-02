"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { stageUpload, materializeDocument, extractionFields } from "@/lib/doc-extract";
import { runExtraction } from "@/lib/agent";
import { composeFullName } from "@/lib/person-name";
import { proposeFieldUpdates } from "@/lib/proposals";

/**
 * Bulk intake: many documents, each representing one person.
 *
 * Every file is its own job — its own AgentRun row (kind INTAKE, so the single
 * flow's one-live-EXTRACT guard is never tripped), its own failure, its own
 * result. All files are staged before the response returns (the upload dies
 * with the request), all run rows are created up front so the queue shows the
 * whole batch immediately, and a single deferred worker processes them at most
 * INTAKE_CONCURRENCY at a time — each job may spawn an agent CLI process, and
 * a 20-file drop must not mean 20 concurrent processes.
 *
 * Routing: an extracted name matching exactly ONE person becomes field
 * proposals on that person; zero or MANY matches become a new-person draft. An
 * ambiguous name is never resolved by guessing — a misdirected update to
 * someone's record is worse than a duplicate draft the reviewer can discard.
 *
 * The run's output records the destination: "person:<id>" or "draft:<id>".
 */
const INTAKE_CONCURRENCY = 3;

export async function startIntake(formData: FormData) {
  const me = await requireAdmin();
  const files = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("לא נבחרו מסמכים.");

  const fields = await extractionFields();

  // stage everything now; create every run row now — the queue shows the batch
  // in full even while later files wait for a worker slot
  const jobs: { runId: string; dir: string; staged: { abs: string; filename: string } }[] = [];
  for (const file of files) {
    const dir = await mkdtemp(path.join(tmpdir(), "intake-"));
    const staged = await stageUpload(dir, file);
    const run = await prisma.agentRun.create({
      data: { userId: me.id, kind: "INTAKE", prompt: file.name, status: "RUNNING" },
    });
    jobs.push({ runId: run.id, dir, staged });
  }

  after(async () => {
    const queue = [...jobs];
    const workers = Array.from({ length: Math.min(INTAKE_CONCURRENCY, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        await processOne(me.id, job, fields).catch(() => {});
      }
    });
    await Promise.all(workers);
  });

  redirect("/people");
}

/**
 * Drop one intake result without acting on it: discard whatever it produced
 * (an unapproved draft, or the pending field proposals) and remove the run, so
 * the row leaves the queue.
 *
 * The approved path needs no equivalent — approving consumes the artifact
 * (createPerson deletes the draft, resolving the last field deletes the
 * proposal), and the queue only lists rows whose artifact is still live. One
 * rule, both outcomes: a row is shown while it still wants attention.
 */
export async function dismissIntakeRun(formData: FormData) {
  const me = await requireAdmin();
  const runId = String(formData.get("runId") ?? "").trim();
  // scoped to this user's own INTAKE runs: a run id is not a capability
  const run = await prisma.agentRun.findFirst({ where: { id: runId, userId: me.id, kind: "INTAKE" } });
  if (!run) return;

  if (run.output?.startsWith("draft:")) {
    await prisma.personDraft.deleteMany({ where: { id: run.output.slice(6) } });
  } else if (run.output?.startsWith("person:")) {
    await prisma.extractionProposal.deleteMany({ where: { personId: run.output.slice(7) } });
  }
  await prisma.agentRun.deleteMany({ where: { id: run.id } });
  revalidatePath("/people");
}

async function processOne(
  userId: string,
  job: { runId: string; dir: string; staged: { abs: string; filename: string } },
  fields: Awaited<ReturnType<typeof extractionFields>>,
) {
  try {
    const doc = await materializeDocument(job.dir, job.staged);
    if (!doc) throw new Error("לא ניתן לחלץ טקסט מהמסמך (גם לא באמצעות OCR).");
    const raw = await runExtraction(job.dir, doc.name, fields);
    if (raw.length === 0) throw new Error("הסוכן לא מצא במסמך ערכים מתאימים.");
    const values = Object.fromEntries(raw.map((r) => [r.key, r.proposed]));

    const fullName = composeFullName(values["firstName"] ?? "", values["lastName"] ?? "").trim();
    const matches = fullName
      ? await prisma.person.findMany({ where: { fullName }, select: { id: true } })
      : [];

    let output: string;
    if (matches.length === 1) {
      await proposeFieldUpdates(userId, matches[0].id, raw, fields);
      output = `person:${matches[0].id}`;
    } else {
      const draft = await prisma.personDraft.create({ data: { createdBy: userId, values } });
      output = `draft:${draft.id}`;
    }
    await prisma.agentRun.update({ where: { id: job.runId }, data: { status: "SUCCEEDED", output } });
  } catch (e) {
    await prisma.agentRun.update({
      where: { id: job.runId },
      data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 2000) : String(e) },
    });
  } finally {
    await rm(job.dir, { recursive: true, force: true });
  }
}

