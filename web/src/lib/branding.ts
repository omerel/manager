import { prisma } from "@/lib/prisma";

const LOGO_KEY = "logoPath";

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
