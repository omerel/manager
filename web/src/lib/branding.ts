import { prisma } from "@/lib/prisma";

const LOGO_KEY = "logoPath";
const NAME_KEY = "systemName";
export const DEFAULT_SYSTEM_NAME = "Manager";

/** The configured system name, or the default ("Manager"). */
export async function getSystemName(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: NAME_KEY } });
  return row?.value?.trim() || DEFAULT_SYSTEM_NAME;
}

/** Empty/whitespace value reverts to the default (row removed). */
export async function setSystemName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    await prisma.appSetting.deleteMany({ where: { key: NAME_KEY } });
  } else {
    await prisma.appSetting.upsert({
      where: { key: NAME_KEY },
      create: { key: NAME_KEY, value: trimmed },
      update: { value: trimmed },
    });
  }
}

/** Relative uploads-path of the custom logo, or null when using the default mark. */
export async function getLogoPath(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: LOGO_KEY } });
  return row?.value ?? null;
}

export async function setLogoPath(path: string | null): Promise<void> {
  if (path === null) {
    await prisma.appSetting.deleteMany({ where: { key: LOGO_KEY } });
  } else {
    await prisma.appSetting.upsert({
      where: { key: LOGO_KEY },
      create: { key: LOGO_KEY, value: path },
      update: { value: path },
    });
  }
}
