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

const LOGIN_LINK_TEXT_KEY = "loginLinkText";
const LOGIN_LINK_URL_KEY = "loginLinkUrl";
const LOGIN_LINK_ENABLED_KEY = "loginLinkEnabled";
export const DEFAULT_LOGIN_LINK_TEXT = "לאתר הפיתוח";

export type LoginLink = { text: string; url: string | null; enabled: boolean };

/** The login page's environment-link card. Hidden by default on a fresh install. */
export async function getLoginLink(): Promise<LoginLink> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [LOGIN_LINK_TEXT_KEY, LOGIN_LINK_URL_KEY, LOGIN_LINK_ENABLED_KEY] } },
  });
  const of = (key: string) => rows.find((r) => r.key === key)?.value;
  return {
    text: of(LOGIN_LINK_TEXT_KEY)?.trim() || DEFAULT_LOGIN_LINK_TEXT,
    url: of(LOGIN_LINK_URL_KEY) ?? null,
    enabled: of(LOGIN_LINK_ENABLED_KEY) === "1",
  };
}

/** Empty text/url delete their rows — text then reads as the default, url as unset. */
export async function setLoginLink(input: { text: string; url: string; enabled: boolean }): Promise<void> {
  const put = async (key: string, value: string) => {
    if (!value) await prisma.appSetting.deleteMany({ where: { key } });
    else await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  };
  await put(LOGIN_LINK_TEXT_KEY, input.text.trim());
  await put(LOGIN_LINK_URL_KEY, input.url.trim());
  await put(LOGIN_LINK_ENABLED_KEY, input.enabled ? "1" : "");
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
