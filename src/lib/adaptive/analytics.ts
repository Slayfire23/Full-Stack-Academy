/**
 * Analytics calculations over real persisted records. Pure functions: the service layer
 * queries the database, these compute. Nothing here invents data — empty input gives
 * empty/zero output, and "not enough data" is reported as such.
 */

/** YYYY-MM-DD for an instant in the given IANA time zone. */
export function dayKey(date: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/**
 * Current streak: consecutive active days ending today — or ending yesterday, so the
 * streak does not read 0 at breakfast before today's session.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): { current: number; longest: number } {
  const days = new Set(activeDays);
  let current = 0;
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  let longest = 0;
  for (const day of days) {
    if (days.has(shiftDay(day, -1))) continue; // not a run start
    let len = 0;
    let c = day;
    while (days.has(c)) {
      len++;
      c = shiftDay(c, 1);
    }
    longest = Math.max(longest, len);
  }
  return { current, longest };
}

export interface GradedAttempt {
  topicId: string;
  correct: boolean;
  createdAt: Date;
}

export interface TopicStat {
  topicId: string;
  attempts: number;
  correct: number;
  accuracy: number; // raw, 0..1
}

export const MIN_ATTEMPTS_FOR_RANKING = 3;

export function topicStats(attempts: readonly GradedAttempt[]): TopicStat[] {
  const map = new Map<string, { attempts: number; correct: number }>();
  for (const a of attempts) {
    const s = map.get(a.topicId) ?? { attempts: 0, correct: 0 };
    s.attempts++;
    if (a.correct) s.correct++;
    map.set(a.topicId, s);
  }
  return [...map.entries()].map(([topicId, s]) => ({ topicId, ...s, accuracy: s.correct / s.attempts }));
}

/** Weakest/strongest only among topics with enough answers to mean something. */
export function rankTopics(stats: readonly TopicStat[], n = 3) {
  const ranked = stats.filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_RANKING);
  const byAcc = [...ranked].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
  // With few ranked topics, split them so a topic is never both "weak" and "strong".
  const weakest = byAcc.slice(0, Math.min(n, Math.ceil(byAcc.length / 2)));
  const strongest = [...byAcc]
    .reverse()
    .filter((s) => !weakest.some((w) => w.topicId === s.topicId))
    .slice(0, n);
  return { weakest, strongest };
}

export function overallAccuracy(attempts: readonly { correct: boolean }[]): number | null {
  if (attempts.length === 0) return null;
  return attempts.filter((a) => a.correct).length / attempts.length;
}

/** Daily answered/correct series for the last `days` days (oldest first). */
export function dailySeries(attempts: readonly GradedAttempt[], now: Date, days: number, timeZone = "UTC") {
  const today = dayKey(now, timeZone);
  const keys = Array.from({ length: days }, (_, i) => shiftDay(today, i - (days - 1)));
  const buckets = new Map(keys.map((k) => [k, { day: k, answered: 0, correct: 0 }]));
  for (const a of attempts) {
    const b = buckets.get(dayKey(a.createdAt, timeZone));
    if (!b) continue;
    b.answered++;
    if (a.correct) b.correct++;
  }
  return keys.map((k) => buckets.get(k)!);
}

/** Total study minutes from sessions, capping idle gaps so a tab left open overnight does not count. */
export function studyMinutes(
  sessions: readonly { startedAt: Date; lastActivityAt: Date; endedAt: Date | null }[],
  maxSessionMinutes = 180,
): number {
  let total = 0;
  for (const s of sessions) {
    const end = s.endedAt ?? s.lastActivityAt;
    const mins = (end.getTime() - s.startedAt.getTime()) / 60000;
    if (mins > 0) total += Math.min(mins, maxSessionMinutes);
  }
  return Math.round(total);
}

// ───────────────────────── Recommendation ─────────────────────────

export interface TopicSignal {
  topicId: string;
  title: string;
  order: number;
  dueCount: number;
  recentErrors: number; // incorrect answers in the last 7 days
  attempts: number;
  correct: number;
  unseenCount: number;
}

export interface Recommendation {
  topicId: string;
  title: string;
  reasons: string[];
  score: number;
  basis: "history" | "starting-point";
}

/**
 * Next topic to study: due reviews, recent mistakes and low accuracy all pull a topic up.
 * A user with no history gets the first topic with unseen material, labelled as a
 * starting point rather than a data-driven verdict.
 */
export function recommendNextTopic(signals: readonly TopicSignal[]): Recommendation | null {
  if (signals.length === 0) return null;
  const hasHistory = signals.some((s) => s.attempts > 0 || s.dueCount > 0);

  if (!hasHistory) {
    const first = [...signals].sort((a, b) => a.order - b.order).find((s) => s.unseenCount > 0) ?? signals[0]!;
    return {
      topicId: first.topicId,
      title: first.title,
      reasons: ["Start here — no study history yet."],
      score: 0,
      basis: "starting-point",
    };
  }

  let best: Recommendation | null = null;
  for (const s of signals) {
    const reasons: string[] = [];
    let score = 0;
    if (s.dueCount > 0) {
      score += Math.min(s.dueCount, 20) * 2;
      reasons.push(`${s.dueCount} card${s.dueCount === 1 ? "" : "s"} due for review`);
    }
    if (s.recentErrors > 0) {
      score += Math.min(s.recentErrors, 10) * 3;
      reasons.push(`${s.recentErrors} recent mistake${s.recentErrors === 1 ? "" : "s"}`);
    }
    if (s.attempts >= MIN_ATTEMPTS_FOR_RANKING) {
      const acc = s.correct / s.attempts;
      if (acc < 0.7) {
        score += (0.7 - acc) * 40;
        reasons.push(`${Math.round(acc * 100)}% accuracy`);
      }
    }
    if (reasons.length === 0 && s.unseenCount > 0 && s.attempts === 0) {
      score += 1 + 1 / (1 + s.order); // gentle preference for curriculum order
      reasons.push("Not started yet");
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { topicId: s.topicId, title: s.title, reasons, score: Math.round(score * 10) / 10, basis: "history" };
    }
  }
  return best;
}
