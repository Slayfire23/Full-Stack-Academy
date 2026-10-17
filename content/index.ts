import type { SeedQuestion } from "./helpers";
import { questionsPart1 } from "./questions-1";
import { questionsPart2 } from "./questions-2";
import { questionsPart3 } from "./questions-3";
import { questionsPart4 } from "./questions-4";
import { questionsExtra } from "./questions-extra";

export type { SeedQuestion } from "./helpers";
export { curriculum, tracks } from "./curriculum";

export const allQuestions: SeedQuestion[] = [
  ...questionsPart1,
  ...questionsPart2,
  ...questionsPart3,
  ...questionsPart4,
  ...questionsExtra,
];
