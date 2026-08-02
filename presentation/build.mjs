import PptxGenJS from "pptxgenjs";

/**
 * Helm — pilot deck, as an editable .pptx.
 *
 * Everything is a native PowerPoint object: text boxes, tables, shapes. No
 * images, so every word and number stays editable in PowerPoint.
 *
 * Typeface is Arial deliberately: it carries Hebrew everywhere including macOS,
 * and the design leans on scale, weight and space rather than on a face that
 * might silently fall back on someone else's machine.
 */

const C = {
  ground: "022C22",
  ground2: "06342A",
  paper: "FAF9F7",
  ink: "1C1917",
  muted: "78716C",
  line: "E3E0DC",
  accent: "047857",
  accentLit: "34D399",
  mist: "ECFDF5",
  critical: "B91C1C",
  warn: "B45309",
  onDark: "EEF6F2",
  onDarkMuted: "B9CDC5",
};

const F = "Arial";
const W = 13.333;
const H = 7.5;
const M = 0.85; // page margin

const pptx = new PptxGenJS();
// The slide size is DERIVED from the design canvas above, never named
// separately. Every coordinate in this file is written against W × H; the deck
// originally shipped with the built-in "LAYOUT_16x9" (10 × 5.625in), which has
// the same aspect ratio but is smaller — so nothing looked distorted and
// everything past 10in was simply cut off the right edge, on all 18 slides.
pptx.defineLayout({ name: "HELM", width: W, height: H });
pptx.layout = "HELM";
pptx.author = "Helm";
pptx.title = "Helm — הצעה לפיילוט";

const rtl = { fontFace: F, rtlMode: true, align: "right" };
const slides = [];

/** Compass strip: one tick per slide, the current one lit, running right→left. */
function strip(slide, index, total, dark) {
  const x0 = M;
  const wTotal = W - M * 2;
  const gap = 0.045;
  const tw = (wTotal - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    const here = i === index;
    // right→left: slide 0 sits at the right edge
    const x = x0 + wTotal - tw - i * (tw + gap);
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: here ? 0.36 : 0.44,
      w: tw,
      h: here ? 0.14 : 0.06,
      fill: { color: here ? (dark ? C.accentLit : C.accent) : dark ? "1B4A3E" : C.line },
      line: { type: "none" },
    });
  }
}

function slide({ dark = false } = {}) {
  const s = pptx.addSlide();
  s.background = { color: dark ? C.ground : C.paper };
  slides.push({ s, dark });
  return s;
}

const eyebrow = (s, text, dark) => ({
  text,
  options: { ...rtl, fontSize: 11, bold: true, color: dark ? C.accentLit : C.accent, charSpacing: 2.2 },
});

function heading(s, { eyebrowText, title, dark = false, y = 1.05, titleSize = 30 }) {
  if (eyebrowText) {
    s.addText(eyebrowText, {
      ...rtl, x: M, y, w: W - M * 2, h: 0.3,
      fontSize: 11, bold: true, color: dark ? C.accentLit : C.accent, charSpacing: 2.2,
    });
  }
  s.addText(title, {
    ...rtl, x: M, y: y + 0.34, w: W - M * 2, h: 0.85,
    fontSize: titleSize, bold: true, color: dark ? "FFFFFF" : C.ink,
  });
}

const body = (s, text, o = {}) =>
  s.addText(text, {
    ...rtl, fontSize: 14, color: o.dark ? C.onDarkMuted : C.muted, lineSpacingMultiple: 1.35,
    x: M, w: W - M * 2, h: 1, ...o,
  });

/** A bordered card with a title and a paragraph — used for the 2×2 grids. */
function card(s, { x, y, w, h, title, text, dark, titleColor }) {
  s.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: dark ? C.ground2 : C.paper },
    line: { color: dark ? "1B4A3E" : C.line, width: 1 },
  });
  s.addText(title, {
    ...rtl, x: x + 0.22, y: y + 0.18, w: w - 0.44, h: 0.36,
    fontSize: 15, bold: true, color: titleColor ?? (dark ? "FFFFFF" : C.ink),
  });
  s.addText(text, {
    ...rtl, x: x + 0.22, y: y + 0.6, w: w - 0.44, h: h - 0.78,
    fontSize: 12, color: dark ? C.onDarkMuted : C.muted, lineSpacingMultiple: 1.3, valign: "top",
  });
}

/** Two-column comparison table, right column emphasised. */
function table(s, { x, y, w, head, rows, colW }) {
  const th = (t) => ({
    text: t,
    options: { ...rtl, fontSize: 10.5, bold: true, color: C.muted, charSpacing: 1.4, fill: { color: C.paper } },
  });
  const td = (t, strong) => ({
    text: t,
    options: { ...rtl, fontSize: 12.5, bold: !!strong, color: strong ? C.ink : C.muted, valign: "top" },
  });
  s.addTable(
    [head.map(th), ...rows.map((r) => r.map((cell, i) => td(cell, i === r.length - 1)))],
    {
      x, y, w, colW,
      border: { type: "solid", pt: 0.75, color: C.line },
      fill: { color: C.paper },
      margin: [6, 10, 6, 10],
      autoPage: false,
    },
  );
}

const rule = (s, { x, y, h, color = C.accent }) =>
  s.addShape(pptx.ShapeType.rect, { x, y, w: 0.045, h, fill: { color }, line: { type: "none" } });

/* ════════════════ 1 · title ════════════════ */
{
  const s = slide({ dark: true });
  s.addText("מערכת לניהול תכניות קריירה", {
    ...rtl, x: M, y: 2.1, w: W - M * 2, h: 0.35, fontSize: 12, bold: true, color: C.accentLit, charSpacing: 2.4,
  });
  s.addText("Helm", {
    ...rtl, x: M, y: 2.5, w: W - M * 2, h: 1.5, fontSize: 72, bold: true, color: "FFFFFF",
  });
  s.addText(
    "ההנהלה הבכירה מגדירה את החוזה. המפקד מקבל את ההגה —\nואת הידיעה האם הוא עומד בו, לכל פקוד, בכל רגע.",
    { ...rtl, x: M, y: 4.05, w: 7.4, h: 1, fontSize: 18, color: C.onDarkMuted, lineSpacingMultiple: 1.35 },
  );
  s.addText("הצעה לפיילוט · תחום אחד · במשותף עם HR", {
    ...rtl, x: M, y: 5.5, w: W - M * 2, h: 0.3, fontSize: 12, color: "7FA79A",
  });
}

/* ════════════════ 2 · chapter ════════════════ */
{
  const s = slide({ dark: true });
  s.addText("חלק ראשון", { ...rtl, x: M, y: 0.95, w: 3, h: 0.3, fontSize: 11, color: "7FA79A", charSpacing: 2.2 });
  s.addText("המצב היום", { ...rtl, x: M, y: 2.7, w: W - M * 2, h: 0.4, fontSize: 12, bold: true, color: C.accentLit, charSpacing: 2.4 });
  s.addText("כל מפקד מנהל בשיטה שלו", { ...rtl, x: M, y: 3.15, w: W - M * 2, h: 1.1, fontSize: 46, bold: true, color: "FFFFFF" });
}

/* ════════════════ 3 · four facts ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "ארבע עובדות", title: "מה שקורה בפועל" });
  const cw = (W - M * 2 - 0.3) / 2;
  const ch = 1.55;
  const y0 = 2.5;
  card(s, { x: M, y: y0, w: cw, h: ch, title: "מעקב אישי, לא ארגוני",
    text: "לכל מפקד שיטה משלו. אין דרך יעילה לעקוב אחרי האנשים, ואין דרך לדעת מה קורה אצל השכן." });
  card(s, { x: M + cw + 0.3, y: y0, w: cw, h: ch, title: "תכניות שנכתבו ודעכו",
    text: "היו ניסיונות חוזרים להגדיר תכנית קבועה. הן לא נאכפו לאורך זמן — לא בגלל התוכן, אלא בגלל שלא היה מי שיישא אותן." });
  card(s, { x: M, y: y0 + ch + 0.3, w: cw, h: ch, title: "HR קטן ובירוקרטי",
    text: "הצוות נותן מענה מנהלתי. מעטפת עשירה למפקדים דורשת מעקב שאין לו זמן אליו." });
  card(s, { x: M + cw + 0.3, y: y0 + ch + 0.3, w: cw, h: ch, title: "תסכול למטה",
    text: "אין שקיפות להמשך הדרך, אין עקביות, ואין מעטפת קבועה שמאפשרת לאדם לדעת איך הוא צומח כאן." });
}

/* ════════════════ 4 · the proof ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "ההוכחה כבר אצלכם", title: "דבר אחד כן קורה כמו שצריך" });
  rule(s, { x: W - M - 0.045, y: 2.55, h: 1.15 });
  s.addText("חוות הדעת השנתיות מתבצעות במלואן —\nכי יש להן אכיפה מערכתית.", {
    ...rtl, x: M, y: 2.55, w: 7.3, h: 1.15, fontSize: 25, bold: true, color: C.ink, lineSpacingMultiple: 1.15,
  });
  body(s, "זה לא צירוף מקרים, וזו לא שאלה של מוטיבציה. מה שיש לו נשא מערכתי — קורה. מה שאין לו — לא קורה, שוב ושוב.",
    { y: 3.95, w: 7.3, fontSize: 15 });
  // 1.35, not 1.1: both body lines wrap to two lines in this column width, and
  // at h=1.1 the card's text box is 0.32in — one line's worth — so the second
  // line spilled past the card's bottom edge.
  card(s, { x: 8.6, y: 2.5, w: W - M - 8.6, h: 1.35, title: "✓  חוות דעת שנתית", titleColor: C.accent,
    text: "מחזור מוגדר · מישהו נשאל · יש מחיר לאי-ביצוע" });
  card(s, { x: 8.6, y: 4.0, w: W - M - 8.6, h: 1.35, title: "✕  תכנית קריירה", titleColor: C.critical,
    text: "מסמך · אף אחד לא נשאל · אין מחיר להתעלמות" });
  s.addText("ההבדל אינו בחשיבות. הוא בנשא.", {
    ...rtl, x: 8.6, y: 5.55, w: W - M - 8.6, h: 0.3, fontSize: 11.5, color: C.muted, italic: true,
  });
}

/* ════════════════ 5 · chapter ════════════════ */
{
  const s = slide({ dark: true });
  s.addText("חלק שני", { ...rtl, x: M, y: 0.95, w: 3, h: 0.3, fontSize: 11, color: "7FA79A", charSpacing: 2.2 });
  s.addText("הרעיון", { ...rtl, x: M, y: 2.7, w: W - M * 2, h: 0.4, fontSize: 12, bold: true, color: C.accentLit, charSpacing: 2.4 });
  s.addText("תכנית קריירה היא חוזה", { ...rtl, x: M, y: 3.15, w: W - M * 2, h: 1.1, fontSize: 46, bold: true, color: "FFFFFF" });
}

/* ════════════════ 6 · the contract ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "שני צדדים", title: "לחוזה יש מי שמבטיח ומי שאחראי לספק", titleSize: 27 });
  const cw = (W - M * 2 - 0.4) / 2;
  rule(s, { x: M + cw - 0.045, y: 2.45, h: 1.35 });
  s.addText("הארגון מבטיח", { ...rtl, x: M, y: 2.45, w: cw - 0.2, h: 0.32, fontSize: 15, bold: true, color: C.ink });
  s.addText("מסלול מוגדר, זהה לכל מי שנמצא בו: אבני דרך, יעדים מצטברים, ומופעים תקופתיים — הכול ביחס לתאריך הגיוס של האדם. מי שכותב את החוזה: ההנהלה הבכירה.",
    { ...rtl, x: M, y: 2.82, w: cw - 0.2, h: 1, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.3 });
  rule(s, { x: W - M - 0.045, y: 2.45, h: 1.35 });
  s.addText("המפקד אחראי לספק", { ...rtl, x: M + cw + 0.4, y: 2.45, w: cw - 0.2, h: 0.32, fontSize: 15, bold: true, color: C.ink });
  s.addText("לוודא שכל פקוד עומד ביעדים שלו, לתעד את מה שקרה, ולהיות מסוגל לומר בכל רגע איפה הוא עומד. היום זה נשען על זיכרון. Helm הופך את זה לנמדד.",
    { ...rtl, x: M + cw + 0.4, y: 2.82, w: cw - 0.2, h: 1, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.3 });

  table(s, {
    x: M, y: 4.0, w: W - M * 2, colW: [(W - M * 2) / 2, (W - M * 2) / 2],
    head: ["השאלה שהחוזה מעורר", "מה עונה עליה"],
    rows: [
      ["מה בדיוק הבטחנו?", "מסלול קריירה — תבנית אחת, זהה לכולם"],
      ["האם הפקוד עומד בו?", "מנוע פערים שמחשב מחדש בכל צפייה"],
      ["איפה אני נופל, על פני כל אנשיי?", "דשבורד ועץ מסגרות"],
      ["איך אני מוכיח מה נעשה?", "חוות דעת ומופעים, עם הקבצים המצורפים"],
      ["ומה עם שאלה שלא חשבנו עליה?", "הסוכן"],
    ],
  });
}

/* ════════════════ 7 · why now ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "השאלה הראשונה שתישאל", title: "במה זה שונה מהפעמים הקודמות?" });
  body(s, "התשובה חייבת להיות מכנית. לא מוטיבציה — מנגנון.", { y: 2.28, fontSize: 15 });
  table(s, {
    x: M, y: 2.85, w: W - M * 2, colW: [(W - M * 2) / 2, (W - M * 2) / 2],
    head: ["למה תכניות קודמות דעכו", "מה נושא את זה ב-Helm"],
    rows: [
      ["אף אחד לא נשאל ״אתה עומד בזה?״ ברגע שבו זה עוד ניתן לתיקון", "מנוע הפערים מסמן מה מתקרב, מה חלף, ומה חסר — לכל אדם, כל הזמן"],
      ["אין מחיר להתעלמות", "המצב גלוי כלפי מעלה, בעץ המסגרות, בלי דוח שצריך להכין"],
      ["המפקד מתחלף — והתכנית נעלמת איתו", "התכנית עוגנת בתאריך הגיוס של האיש, לא בקדנציה של המפקד"],
      ["שינוי מסלול מאפס את מה שהיה", "מעבר בין מסלולים שומר את ההיסטוריה, ומבחין בין ״לא נדרש ממנו״ ל״נדרש ולא בוצע״"],
    ],
  });
  s.addText("השורה השלישית היא המכרעת: ״לאורך זמן״ פירושו כמעט תמיד תחלופת מפקדים.", {
    ...rtl, x: M, y: 6.35, w: W - M * 2, h: 0.3, fontSize: 11.5, color: C.muted, italic: true,
  });
}

/* ════════════════ 8 · chapter ════════════════ */
{
  const s = slide({ dark: true });
  s.addText("חלק שלישי", { ...rtl, x: M, y: 0.95, w: 3, h: 0.3, fontSize: 11, color: "7FA79A", charSpacing: 2.2 });
  s.addText("המערכת", { ...rtl, x: M, y: 2.7, w: W - M * 2, h: 0.4, fontSize: 12, bold: true, color: C.accentLit, charSpacing: 2.4 });
  s.addText("שלושה מסכים, ושאלה פתוחה", { ...rtl, x: M, y: 3.15, w: W - M * 2, h: 1.1, fontSize: 46, bold: true, color: "FFFFFF" });
}

/* ════════════════ 9 · dashboard ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "מסך ראשון", title: "דשבורד — איפה אני נופל" });
  const bullets = [
    ["עמידה ביחס לפקודים", " כמספר אחד, ולידו כמה אירועים באי-עמידה וכמה מתקרבים."],
    ["עץ המסגרות", " מתגלגל כלפי מעלה: מרכז ◂ תחום ◂ מדור ◂ צוות. כל רמה רואה את מה שתחתיה."],
    ["חתוך אוטומטית להרשאות", " — מפקד רואה את אנשיו, ראש תחום את התחום, ואף אחד לא רואה מעבר לזה."],
    ["אין דוח להכין", " — המספר קיים כי הנתונים קיימים."],
  ];
  bullets.forEach(([b, rest], i) => {
    s.addText([{ text: "•  " + b, options: { bold: true, color: C.ink } }, { text: rest, options: { color: C.muted } }],
      { ...rtl, x: M, y: 2.5 + i * 0.72, w: 6.6, h: 0.65, fontSize: 13, lineSpacingMultiple: 1.25 });
  });

  // schematic dashboard
  const bx = 8.0, bw = W - M - 8.0;
  s.addShape(pptx.ShapeType.rect, { x: bx, y: 2.35, w: bw, h: 3.6, fill: { color: "FFFFFF" }, line: { color: C.line, width: 1 } });
  s.addShape(pptx.ShapeType.rect, { x: bx, y: 2.35, w: bw, h: 0.4, fill: { color: C.ground }, line: { type: "none" } });
  s.addText("Helm   ·   דשבורד", { ...rtl, x: bx + 0.15, y: 2.37, w: bw - 0.3, h: 0.36, fontSize: 10, color: "CFE6DD" });
  s.addText("69%", { ...rtl, x: bx + 0.2, y: 2.85, w: 1.5, h: 0.6, fontSize: 34, bold: true, color: C.accent });
  s.addText("עמידה ביחס לפקודים", { ...rtl, x: bx + 1.75, y: 3.05, w: bw - 1.95, h: 0.3, fontSize: 10.5, color: C.muted });
  const kpi = [["17", "באי-עמידה", C.critical], ["4", "מתקרבים", C.warn], ["13", "אנשים", C.ink]];
  kpi.forEach(([n, l, col], i) => {
    const kx = bx + 0.2 + i * ((bw - 0.4) / 3);
    s.addShape(pptx.ShapeType.rect, { x: kx, y: 3.55, w: (bw - 0.4) / 3 - 0.12, h: 0.65, fill: { color: C.paper }, line: { color: C.line, width: 0.75 } });
    s.addText(n, { ...rtl, x: kx + 0.08, y: 3.6, w: (bw - 0.4) / 3 - 0.28, h: 0.35, fontSize: 17, bold: true, color: col });
    s.addText(l, { ...rtl, x: kx + 0.08, y: 3.93, w: (bw - 0.4) / 3 - 0.28, h: 0.25, fontSize: 8.5, color: C.muted });
  });
  const tree = [["תחום אלגוריתמיקה", "🔴 6   🟡 2", 0], ["מדור ראייה", "🔴 4", 0.25], ["צוות פיקסל", "🔴 3", 0.5], ["צוות עדשה", "🟡 1", 0.5]];
  tree.forEach(([nm, badge, indent], i) => {
    const ty = 4.4 + i * 0.34;
    s.addText(nm, { ...rtl, x: bx + 0.2 + indent, y: ty, w: bw - 1.9 - indent, h: 0.3, fontSize: 10.5, bold: true, color: C.ink });
    s.addText(badge, { ...rtl, x: bx + bw - 1.55, y: ty, w: 1.35, h: 0.3, fontSize: 10, color: C.muted, align: "left" });
  });
}

/* ════════════════ 10 · people ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "מסך שני", title: "אנשים — מי, באיזה מסלול, ובאיזה מצב" });
  const bullets = [
    ["עמודת מסלול קריירה", " לכל אדם — לחיצה פותחת את המסלול הגנרי שההנהלה הגדירה."],
    ["פילטר לכל עמודה", ", תוך כדי הקלדה: מי בתחום הזה, מי במסלול ההוא, מי עומד לסיים."],
    ["כרטיס אישי", " — פרטים, תכנית, התקדמות, וכל חוות הדעת שנכתבו."],
    ["״מי מהאנשים שלי בלי מסלול?״", " — שאלה של שתי לחיצות."],
  ];
  bullets.forEach(([b, rest], i) => {
    s.addText([{ text: "•  " + b, options: { bold: true, color: C.ink } }, { text: rest, options: { color: C.muted } }],
      { ...rtl, x: M, y: 2.5 + i * 0.72, w: 5.4, h: 0.65, fontSize: 13, lineSpacingMultiple: 1.25 });
  });
  const px = 6.9, pw = W - M - 6.9;
  const cell = (t, o = {}) => ({ text: t, options: { ...rtl, fontSize: 10, color: C.muted, ...o } });
  s.addTable(
    [
      [cell("שם", { bold: true, charSpacing: 1 }), cell("מסגרת", { bold: true }), cell("מסלול קריירה", { bold: true }), cell("סטטוס", { bold: true })],
      [cell("נועם אזולאי", { color: C.ink }), cell("ראייה ◂ פיקסל"), cell("מסלול מומחה", { color: C.accent, bold: true }), cell("פעיל")],
      [cell("שירה דגן", { color: C.ink }), cell("ראייה ◂ עדשה"), cell("מסלול פיקוד", { color: C.accent, bold: true }), cell("פעיל")],
      [cell("איתמר גולן", { color: C.ink }), cell("שפה ◂ סמנטיקה"), cell("ללא מסלול"), cell("פעיל")],
      [cell("רותם קפלן", { color: C.ink }), cell("ראייה ◂ פיקסל"), cell("מסלול קליטה", { color: C.accent, bold: true }), cell("סיום מתוכנן")],
    ],
    { x: px, y: 2.55, w: pw, colW: [pw * 0.27, pw * 0.3, pw * 0.26, pw * 0.17],
      border: { type: "solid", pt: 0.75, color: C.line }, fill: { color: "FFFFFF" }, margin: [5, 8, 5, 8] },
  );
  s.addText("השמות להמחשה בלבד", { ...rtl, x: px, y: 4.5, w: pw, h: 0.25, fontSize: 9, color: C.muted, italic: true });
}

/* ════════════════ 11 · career ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "מסך שלישי", title: "ניהול קריירה — כתיבת החוזה" });
  const bullets = [
    ["אבני דרך", " בחודש מוגדר מהגיוס, יעדים מצטברים עם נקודות ביקורת, ומופעים תקופתיים שנפרסים לבד."],
    ["הכול יחסי לתאריך הגיוס", " — תבנית אחת משרתת את כולם, ומתורגמת לתאריכים אמיתיים לכל אדם."],
    ["שיוך יוצר עותק עצמאי", " — עדכון התבנית לא משנה למפרע את מי שכבר במסלול."],
    ["איור המסלול", " ניתן להפקה כ-PDF לשיחות אישיות ולמצגות."],
  ];
  bullets.forEach(([b, rest], i) => {
    s.addText([{ text: "•  " + b, options: { bold: true, color: C.ink } }, { text: rest, options: { color: C.muted } }],
      { ...rtl, x: M, y: 2.5 + i * 0.78, w: 6.4, h: 0.72, fontSize: 13, lineSpacingMultiple: 1.25 });
  });
  const tx = 7.9, tw = W - M - 7.9;
  s.addShape(pptx.ShapeType.rect, { x: tx, y: 2.35, w: tw, h: 3.7, fill: { color: "FFFFFF" }, line: { color: C.line, width: 1 } });
  const track = [
    ["חודש 72", "סיום המסלול", false], ["60", "שעות ניהול · יעד 500", true],
    ["48", "קורס פיקוד בכיר", false], ["36", "חוות דעת תקופתית", false],
    ["24", "ניהול צוות ראשון", false], ["9", "קורס ניהול בסיסי · פטור", false],
  ];
  track.forEach(([mo, ev, metric], i) => {
    const y = 2.6 + i * 0.44;
    s.addText(mo, { ...rtl, x: tx + tw - 1.0, y, w: 0.85, h: 0.32, fontSize: 9.5, color: C.muted, align: "left" });
    s.addShape(pptx.ShapeType.rect, { x: tx + 0.2, y, w: tw - 1.3, h: 0.34, fill: { color: metric ? C.mist : "FFFFFF" }, line: { color: C.line, width: 0.75 } });
    s.addText(ev, { ...rtl, x: tx + 0.3, y: y + 0.02, w: tw - 1.5, h: 0.3, fontSize: 10, color: i === 5 ? C.muted : C.ink });
  });
  s.addShape(pptx.ShapeType.rect, { x: tx + 0.2, y: 5.28, w: tw - 1.3, h: 0.4, fill: { color: C.ground }, line: { type: "none" } });
  s.addText("גיוס", { ...rtl, x: tx + 0.3, y: 5.32, w: tw - 1.5, h: 0.32, fontSize: 11, bold: true, color: "FFFFFF" });
}

/* ════════════════ 12 · evidence ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "תיעוד", title: "מה שקרה בפועל — עם ראיות" });
  body(s, "כל מופע תקופתי הוא משבצת שממתינה לתוכן: מי מילא, מתי, ומה נכתב. אפשר לצרף מסמכים — והם נשמרים עם הרשומה, לא בתיקייה אצל מישהו.",
    { y: 2.45, w: 6.4, fontSize: 13.5 });
  [
    "מופע שחלף ולא מולא נצבע כפער, ולא נעלם.",
    "רשומות חופשיות לאירועים שאינם בתכנית — כנס, צל״ש, קורס חיצוני.",
    "מעבר בין מסלולים שומר את הכול, ומתעד גם את סיבת המעבר.",
  ].forEach((t, i) =>
    s.addText("•  " + t, { ...rtl, x: M, y: 3.6 + i * 0.42, w: 6.4, h: 0.38, fontSize: 12.5, color: C.muted }),
  );
  card(s, { x: 7.5, y: 2.4, w: W - M - 7.5, h: 1.35, title: "⊘  פטור",
    text: "האירוע מוקדם ממועד שיוך העובד למסלול — מעולם לא נדרש ממנו. אין כאן כישלון." });
  card(s, { x: 7.5, y: 3.9, w: W - M - 7.5, h: 1.35, title: "✕  נדרש ולא בוצע",
    text: "הגיע המועד, לא נעשה. מתועד לנצח, ואינו נספר כפער אחרי מעבר מסלול." });
  s.addText("שתי המילים נראות דומה בדוח, ואומרות דברים הפוכים על אדם. המערכת לא מערבבת אותן.", {
    ...rtl, x: 7.5, y: 5.4, w: W - M - 7.5, h: 0.5, fontSize: 11, color: C.muted, italic: true, lineSpacingMultiple: 1.2,
  });
}

/* ════════════════ 13 · agent ════════════════ */
{
  const s = slide({ dark: true });
  heading(s, { eyebrowText: "הלב של המערכת", title: "שאלה חופשית, בשפה שלך, על האנשים שלך", dark: true, titleSize: 30 });
  s.addText("המפקד", { ...rtl, x: W - M - 1.3, y: 2.5, w: 1.3, h: 0.3, fontSize: 10, color: "7FA79A", charSpacing: 1.6 });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 2.45, w: W - M * 2 - 1.5, h: 0.55, fill: { color: C.ground2 }, line: { color: "1B4A3E", width: 1 } });
  s.addText("מי מהאנשים שלי לא קיבל חוות דעת בשנה האחרונה, ומה מצב שעות הגמול שלהם?", {
    ...rtl, x: M + 0.15, y: 2.5, w: W - M * 2 - 1.8, h: 0.45, fontSize: 13, color: C.onDark,
  });
  s.addText("Helm", { ...rtl, x: W - M - 1.3, y: 3.2, w: 1.3, h: 0.3, fontSize: 10, color: C.accentLit, charSpacing: 1.6 });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 3.15, w: W - M * 2 - 1.5, h: 0.7, fill: { color: "0B3C31" }, line: { color: C.accent, width: 1 } });
  s.addText("שלושה אנשים · לכל אחד מפורטים המופעים שלא מולאו, שעות הגמול מול היעד, וקישור לכרטיס.\nהתשובה נשענת רק על מה שבראות שלך.", {
    ...rtl, x: M + 0.15, y: 3.2, w: W - M * 2 - 1.8, h: 0.6, fontSize: 12, color: C.onDark, lineSpacingMultiple: 1.2,
  });

  const steps = ["שואלים בשפה חופשית", "מקבלים תשובה עם ראיות", "שומרים אותה כחוק", "דוח קבוע, מיידי, זהה בכל הרצה"];
  const sw = (W - M * 2) / 4;
  steps.forEach((t, i) => {
    const x = W - M - sw - i * sw;
    const lit = i === 2;
    s.addShape(pptx.ShapeType.rect, { x, y: 4.15, w: sw - 0.08, h: 0.75,
      fill: { color: lit ? C.accent : C.ground2 }, line: { color: lit ? C.accent : "1B4A3E", width: 1 } });
    s.addText(t, { ...rtl, x: x + 0.12, y: 4.24, w: sw - 0.32, h: 0.6, fontSize: 11.5, bold: true,
      color: lit ? "FFFFFF" : C.onDark, lineSpacingMultiple: 1.15 });
  });
  s.addText([
    { text: "זו לא ״יש לנו AI״. זו ", options: { color: C.onDarkMuted } },
    { text: "חקירה שהופכת לתקן", options: { color: "FFFFFF", bold: true } },
    { text: ": שאלה טובה שמפקד שאל פעם אחת הופכת לדוח שכל הארגון מריץ מכאן והלאה — בלי מודל, בלי אי-ודאות, ובאותה תוצאה בדיוק.", options: { color: C.onDarkMuted } },
  ], { ...rtl, x: M, y: 5.15, w: W - M * 2, h: 0.8, fontSize: 14, lineSpacingMultiple: 1.3 });
  s.addText("הסוכן קורא בלבד, ורק את מה שבהרשאות השואל. הוא אינו משנה דבר במערכת.", {
    ...rtl, x: M, y: 6.1, w: W - M * 2, h: 0.3, fontSize: 10.5, color: "7FA79A",
  });
}

/* ════════════════ 14 · HR ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "הקהל השני", title: "צוות HR קטן יכול לתת מעטפת רחבה" });
  body(s, "היום הזמן של HR נבלע במעקב, ולכן הוא לא מגיע לתמיכה. כשהמעקב נעשה לבד, מה שנשאר הוא ההתערבות — וזה בדיוק החלק שדורש אדם.",
    { y: 2.4, w: 7.3, fontSize: 14 });
  table(s, {
    x: M, y: 3.3, w: 7.3, colW: [3.65, 3.65],
    head: ["היום", "עם Helm"],
    rows: [
      ["לאסוף מי בפיגור", "הרשימה קיימת"],
      ["להזכיר למפקדים", "המפקד רואה לבד, לפני שזה הופך לפער"],
      ["להכין דוח לכל בקשה", "הדוח נשמר פעם אחת ורץ לבד"],
      ["מענה בירוקרטי", "ליווי ממוקד למי שבאמת צריך"],
    ],
  });
  rule(s, { x: W - M - 0.045, y: 2.4, h: 2.2 });
  s.addText("למה HR שותף בפיילוט", { ...rtl, x: 8.5, y: 2.4, w: W - M - 8.7, h: 0.32, fontSize: 15, bold: true, color: C.ink });
  s.addText("הם היחידים שרואים את הרוחב, הם שיזהו איפה התכנית עצמה לא מתאימה למציאות, והם שיישאו את ההטמעה מול המפקדים.",
    { ...rtl, x: 8.5, y: 2.8, w: W - M - 8.7, h: 1, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.3 });
  s.addText("פיילוט בלי HR בודק כלי.\nפיילוט עם HR בודק שיטה.",
    { ...rtl, x: 8.5, y: 3.95, w: W - M - 8.7, h: 0.7, fontSize: 14, bold: true, color: C.ink, lineSpacingMultiple: 1.25 });
}

/* ════════════════ 15 · limits ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "גבולות", title: "מה שהמערכת עדיין לא עושה" });
  s.addText("עדיף שתשמעו את זה כאן ולא בחודש השני.", {
    ...rtl, x: M, y: 2.25, w: W - M * 2, h: 0.3, fontSize: 14, color: C.muted, italic: true,
  });
  const cw = (W - M * 2 - 0.3) / 2, ch = 1.5, y0 = 2.75;
  card(s, { x: M, y: y0, w: cw, h: ch, title: "לפקוד אין משתמש",
    text: "היום המערכת משרתת מפקדים ו-HR. השקיפות לאיש מגיעה מכך שלמפקד יש סוף-סוף מה לומר לו — לא ממסך שהוא נכנס אליו." });
  card(s, { x: M + cw + 0.3, y: y0, w: cw, h: ch, title: "מסך אישי לפקוד — החלטה, לא פיצ׳ר",
    text: "חוות הדעת נכתבות עליו. לחשוף אותן משנה את אופי הכלי. זו החלטה שנרצה לקבל יחד, ולא להחליק." });
  card(s, { x: M, y: y0 + ch + 0.3, w: cw, h: ch, title: "הנתונים לא מגיעים לבד",
    text: "קליטה ראשונית של אנשים קיימים דורשת עבודה. יש לכך כלים — קליטה ממסמכים בעזרת הסוכן, וייבוא תצורה — אבל זה מאמץ אמיתי." });
  card(s, { x: M + cw + 0.3, y: y0 + ch + 0.3, w: cw, h: ch, title: "המערכת לא מחליטה",
    text: "היא מודדת מול חוזה שאתם כתבתם. אם החוזה לא נכון, המערכת תמדוד בנאמנות דבר לא נכון." });
}

/* ════════════════ 16 · the ask ════════════════ */
{
  const s = slide({ dark: true });
  s.addText("הבקשה", { ...rtl, x: M, y: 0.95, w: 3, h: 0.3, fontSize: 11, color: "7FA79A", charSpacing: 2.2 });
  heading(s, { eyebrowText: "מה אנחנו מבקשים", title: "תחום אחד. שלושה חודשים. יחד עם HR.", dark: true, y: 1.7, titleSize: 40 });
  const n = [["1", "תחום — כל המדורים והצוותים שתחתיו"], ["3", "חודשים מרגע שהנתונים בפנים"], ["2", "מסלולים שההנהלה תגדיר לפיילוט"]];
  const bw = (W - M * 2 - 0.5) / 3;
  n.forEach(([num, label], i) => {
    const x = W - M - bw - i * (bw + 0.25);
    s.addShape(pptx.ShapeType.rect, { x, y: 3.5, w: bw, h: 1.25, fill: { color: C.ground2 }, line: { color: "1B4A3E", width: 1 } });
    s.addText(num, { ...rtl, x: x + 0.2, y: 3.6, w: bw - 0.4, h: 0.6, fontSize: 34, bold: true, color: C.accentLit });
    s.addText(label, { ...rtl, x: x + 0.2, y: 4.18, w: bw - 0.4, h: 0.5, fontSize: 11, color: C.onDarkMuted, lineSpacingMultiple: 1.2 });
  });
  s.addText("לא פריסה ארגונית. תחום אחד שבו נבדוק אם החוזה מחזיק כשיש מי שנושא אותו — ונחזור אליכם עם מספרים, לא עם התרשמות.", {
    ...rtl, x: M, y: 5.1, w: W - M * 2, h: 0.7, fontSize: 15, color: C.onDarkMuted, lineSpacingMultiple: 1.3,
  });
}

/* ════════════════ 17 · success ════════════════ */
{
  const s = slide();
  heading(s, { eyebrowText: "איך נדע שהצליח", title: "מדדים שנסכים עליהם מראש" });
  const metrics = [
    ["כיסוי", " — איזה אחוז מאנשי התחום משויכים למסלול בסוף החודש הראשון."],
    ["סגירת פערים", " — כמה אירועים באי-עמידה היו בתחילה, וכמה בסוף."],
    ["שימוש אמיתי", " — כמה מפקדים נכנסו מיוזמתם, ולא כי התבקשו."],
    ["עומס HR", " — כמה בקשות לדוחות ידניים הגיעו, לעומת התקופה שלפני."],
    ["מה האנשים אומרים", " — שאלון קצר לפקודי התחום בתחילה ובסוף, על שקיפות ההמשך."],
  ];
  metrics.forEach(([b, rest], i) => {
    s.addText([{ text: "•  " + b, options: { bold: true, color: C.ink } }, { text: rest, options: { color: C.muted } }],
      { ...rtl, x: M, y: 2.45 + i * 0.6, w: 7.3, h: 0.55, fontSize: 13, lineSpacingMultiple: 1.2 });
  });
  s.addText("המדד האחרון הוא החשוב ביותר, והוא היחיד שלא מגיע מהמערכת.", {
    ...rtl, x: M, y: 5.6, w: 7.3, h: 0.3, fontSize: 11.5, color: C.muted, italic: true,
  });
  rule(s, { x: W - M - 0.045, y: 2.4, h: 2.6 });
  s.addText("מה נדרש מכם", { ...rtl, x: 8.5, y: 2.4, w: W - M - 8.7, h: 0.32, fontSize: 15, bold: true, color: C.ink });
  s.addText("החלטה על התחום · שני מסלולים מוגדרים · איש קשר ב-HR · וגישה לנתוני האנשים הקיימים.",
    { ...rtl, x: 8.5, y: 2.8, w: W - M - 8.7, h: 0.9, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.3 });
  s.addText("מה לא נדרש", { ...rtl, x: 8.5, y: 3.85, w: W - M - 8.7, h: 0.32, fontSize: 15, bold: true, color: C.ink });
  s.addText("שינוי בתהליכי העבודה, מערכת חדשה ללמוד, או התחייבות מעבר לשלושת החודשים.",
    { ...rtl, x: 8.5, y: 4.25, w: W - M - 8.7, h: 0.9, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.3 });
}

/* ════════════════ 18 · close ════════════════ */
{
  const s = slide({ dark: true });
  s.addText("אתם כותבים את החוזה.\nאנחנו נדאג שמישהו יישא אותו.", {
    ...rtl, x: M, y: 2.6, w: W - M * 2, h: 1.8, fontSize: 40, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.25,
  });
  s.addText("Helm", { ...rtl, x: M, y: 4.7, w: W - M * 2, h: 0.5, fontSize: 20, color: C.accentLit });
}

// the compass strip goes on last, so it sits above every slide's fills
slides.forEach(({ s, dark }, i) => strip(s, i, slides.length, dark));

const out = process.argv[2] ?? "Helm.pptx";
await pptx.writeFile({ fileName: out });
console.log(`${slides.length} slides → ${out}`);
