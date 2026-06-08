const INITIAL_MAP: Record<string, string> = {
  zh: "ㄓ", ch: "ㄔ", sh: "ㄕ",
  b: "ㄅ", p: "ㄆ", m: "ㄇ", f: "ㄈ",
  d: "ㄉ", t: "ㄊ", n: "ㄋ", l: "ㄌ",
  g: "ㄍ", k: "ㄎ", h: "ㄏ",
  j: "ㄐ", q: "ㄑ", x: "ㄒ",
  r: "ㄖ", z: "ㄗ", c: "ㄘ", s: "ㄙ",
};

// Ordered longest-first so greedy matching works
const FINAL_MAP: [string, string][] = [
  ["iang", "ㄧㄤ"], ["iong", "ㄩㄥ"], ["uang", "ㄨㄤ"], ["ueng", "ㄨㄥ"],
  ["ang", "ㄤ"], ["eng", "ㄥ"], ["ing", "ㄧㄥ"], ["ong", "ㄨㄥ"],
  ["ian", "ㄧㄢ"], ["iao", "ㄧㄠ"], ["uan", "ㄨㄢ"], ["van", "ㄩㄢ"], ["uai", "ㄨㄞ"],
  ["ai", "ㄞ"], ["an", "ㄢ"], ["ao", "ㄠ"], ["ei", "ㄟ"], ["en", "ㄣ"],
  ["er", "ㄦ"], ["ia", "ㄧㄚ"], ["ie", "ㄧㄝ"], ["in", "ㄧㄣ"],
  ["iu", "ㄧㄡ"], ["ou", "ㄡ"], ["ua", "ㄨㄚ"], ["ui", "ㄨㄟ"],
  ["un", "ㄨㄣ"], ["uo", "ㄨㄛ"], ["ve", "ㄩㄝ"], ["vn", "ㄩㄣ"],
  ["a", "ㄚ"], ["e", "ㄜ"], ["i", "ㄧ"], ["o", "ㄛ"], ["u", "ㄨ"], ["v", "ㄩ"],
];

const TONE_MARKS = ["", "", "ˊ", "ˇ", "ˋ", "˙"];

function syllableToZhuyin(s: string): string {
  const toneMatch = s.match(/([1-5])$/);
  const tone = toneMatch ? parseInt(toneMatch[1]) : 1;
  let p = s.replace(/[1-5]$/, "").toLowerCase().replace(/ü/g, "v");

  let initial = "";
  let rest = p;

  // Try 2-char initials first
  for (const k of ["zh", "ch", "sh"]) {
    if (p.startsWith(k)) { initial = k; rest = p.slice(2); break; }
  }
  // Try 1-char initials
  if (!initial) {
    for (const k of Object.keys(INITIAL_MAP)) {
      if (k.length === 1 && p.startsWith(k)) { initial = k; rest = p.slice(1); break; }
    }
  }

  // j/q/x: 'u' is really 'ü'
  if (["j", "q", "x"].includes(initial)) rest = rest.replace(/^u/, "v");

  // zh/ch/sh/r/z/c/s + i = empty final (e.g. zhi, chi, si)
  if (["zh", "ch", "sh", "r", "z", "c", "s"].includes(initial) && rest === "i") rest = "";

  // Handle y/w medials (no zhuyin initial)
  if (!initial) {
    if (p.startsWith("yu") || p.startsWith("yv")) { rest = "v" + p.slice(2); }
    else if (p.startsWith("yi")) { rest = p.slice(1); }
    else if (p[0] === "y") { rest = "i" + p.slice(1); }
    else if (p.startsWith("wu")) { rest = p.slice(1); }
    else if (p[0] === "w") { rest = "u" + p.slice(1); }
  }

  const zhInitial = INITIAL_MAP[initial] ?? "";
  const pair = FINAL_MAP.find(([from]) => from === rest);
  if (!pair && rest !== "") return s; // fallback: return original pinyin
  const zhFinal = pair ? pair[1] : "";

  return zhInitial + zhFinal + TONE_MARKS[tone];
}

/** Convert a numbered-pinyin string (may be multi-syllable, space-separated) to zhuyin. */
export function numberedPinyinToZhuyin(pinyin: string): string {
  if (!pinyin) return "";
  return pinyin.split(" ").map(syllableToZhuyin).join(" ");
}
