import { createHash } from "node:crypto";

/**
 * Text normalisation shared by grading, hashing and near-duplicate detection.
 */

const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at for with by from as is are was were be been being it its this that these those " +
    "you your we our they their he she his her i me my do does did can could should would will shall may might must " +
    "what which who whom whose when where why how if then than so such into about over under there here not no yes"
  ).split(" "),
);

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[`'’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Very light stemmer: enough to treat "requests"/"request" and "locking"/"lock" as the same token. */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ations", "ation", "ingly", "ings", "ing", "edly", "ies", "ied", "ers", "er", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const root = word.slice(0, -suffix.length);
      return suffix === "ies" || suffix === "ied" ? root + "y" : root;
    }
  }
  return word;
}

/** Content words: normalized, stop-words removed, stemmed. */
export function contentTokens(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(stem);
}

/** SHA-256 over normalized prompt + answer. Two questions that differ only in case/punctuation collide. */
export function contentHash(prompt: string, answer: string): string {
  return createHash("sha256").update(`${normalizeText(prompt)}␞${normalizeText(answer)}`).digest("hex");
}
