// Shared by the client component and the server engine — so it must not
// import prisma (a client bundle that pulls pg fails the build on `dns`).

export const WIPE_CATEGORIES = [
  { key: "people", label: "אנשים", hint: "כרטיסי עובדים, טיוטות, תנועות, צילומי ייבוא ועותקי תכנית אישיים" },
  { key: "career", label: "קריירה", hint: "תבניות ותכניות אישיות, על אירועיהן, מדדיהן ושיבוציהן" },
  { key: "chat", label: "שאלות", hint: "שיחות עם הסוכן בעמוד הצ׳אט" },
  { key: "rules", label: "חוקים", hint: "חוקי הסוכן והריצות שלהם" },
  { key: "queries", label: "שאילתות", hint: "שאילתות מפקדים על יעדיהן ותשובותיהן" },
] as const;

export type WipeCategory = (typeof WIPE_CATEGORIES)[number]["key"];
