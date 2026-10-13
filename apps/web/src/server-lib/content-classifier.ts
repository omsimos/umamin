import type { createGateway, Experimental_EvaluationModel } from "ai";
import type { AppEnv } from "./env";
import { captureServerException } from "./posthog";

// Classifies user-written text with TypeSafe's Jev through the Vercel AI
// Gateway. Every failure (no key, timeout, rate limit, refusal, bad response)
// returns null, which callers store as "unclassified" and readers treat as
// clean: the classifier only ever covers content, so failing open is the safe
// direction. See docs/superpowers/community-safety-plan.md.
//
// The AI SDK is imported lazily: statically it adds ~325 kB to the Worker's
// startup bundle, which every request would pay for on a cold start.

const MODEL_ID = "typesafe-ai/jev";
const TIMEOUT_MS = 2000;
const MIN_TEXT_LENGTH = 3;
const CONTEXT_MAX_LENGTH = 500;

// Sent once in the state rather than repeated per question: the state is
// billed once, each question separately.
const PLATFORM_CONTEXT =
  "The text is from a Philippine social app and may be English, Filipino/Tagalog, or Taglish. Casual profanity used for emphasis or banter (tangina, leche, bwisit, gago between friends) is not by itself hateful or harassing.";

export const CLASSIFIER_QUESTIONS = {
  hate: {
    type: "boolean",
    instructions:
      "Does the text attack or use slurs against people because of race, ethnicity, nationality, religion, gender, sexual orientation, or disability? Criticism of politicians, parties, or public figures is not hate.",
  },
  threat: {
    type: "boolean",
    instructions:
      "Does the text threaten violence or harm against another person? Statements about the author's own sadness, self-harm, or wanting to die are not threats. Obvious jokes between friends are not threats.",
  },
  doxxing: {
    type: "boolean",
    instructions:
      "Does the text reveal private information about a real person, such as full name with school or address, phone number, or private photos or chat screenshots?",
  },
  harassment: {
    type: "boolean",
    instructions:
      "Does the text insult, mock, or degrade a specific identifiable person or user? Disagreeing with someone's opinion is not harassment. Hostile opinions about politicians, parties, or groups of political supporters are allowed political speech, not harassment.",
  },
  drama: {
    type: "choice",
    instructions:
      "What kind of interpersonal drama is this? Quotes, poetry, and general life advice are none. Political opinions, including hostile ones about politicians, parties, or groups of political supporters, are none.",
    criteria: {
      none: null,
      callout: "Publicly accuses or confronts a specific person",
      indirect:
        "A veiled jab at an unnamed person the audience is meant to recognize (parinig)",
      gossip: "Discusses another person's private life or business",
      fight: "Hostile back-and-forth with another user",
    },
  },
  selfHarm: {
    type: "boolean",
    instructions:
      "Does the author talk about hurting themselves or wanting to die?",
  },
  political: {
    type: "boolean",
    instructions:
      "Is the text mainly a political opinion about politicians, political parties, government, or groups of political supporters (for example Kakampinks, DDS, BBM supporters)?",
  },
} as const;

type BooleanAnswer = { probability: number };
export type ClassifierAnswers = {
  hate: BooleanAnswer;
  threat: BooleanAnswer;
  doxxing: BooleanAnswer;
  harassment: BooleanAnswer;
  drama: { choice: string; probabilities?: Record<string, number> };
  selfHarm: BooleanAnswer;
  political: BooleanAnswer;
};

export type ContentKind = "post" | "comment" | "note" | "message";

export type ContentScores = {
  severe: number;
  drama: number;
  reason: string | null;
};

const CLEAN: ContentScores = { severe: 0, drama: 0, reason: null };

const SEVERE_KEYS = ["hate", "threat", "doxxing", "harassment"] as const;
// Below this, a severe question doesn't name the reason; the drama choice does.
const SEVERE_REASON_FLOOR = 50;

const pct = (probability: number) =>
  Math.round(Math.min(Math.max(probability, 0), 1) * 100);

/** Pure mapping from Jev's answers to the 0-100 scores stored on a row. */
export function scoreAnswers(answers: ClassifierAnswers): ContentScores {
  const severe: Record<(typeof SEVERE_KEYS)[number], number> = {
    hate: answers.hate.probability,
    threat: answers.threat.probability,
    doxxing: answers.doxxing.probability,
    harassment: answers.harassment.probability,
  };
  // A cry for help must never be blurred as a threat.
  if (answers.selfHarm.probability >= 0.5) severe.threat = 0;

  const political = answers.political.probability >= 0.5;
  if (political) severe.harassment = 0;

  const noneProbability =
    answers.drama.probabilities?.none ??
    (answers.drama.choice === "none" ? 1 : 0);
  const drama = political ? 0 : pct(1 - noneProbability);

  const [topKey, topValue] = SEVERE_KEYS.map(
    (key) => [key, severe[key]] as const,
  ).reduce((best, next) => (next[1] > best[1] ? next : best));
  const severeScore = pct(topValue);

  const reason =
    severeScore >= SEVERE_REASON_FLOOR
      ? topKey
      : !political && answers.drama.choice !== "none"
        ? answers.drama.choice
        : null;

  return { severe: severeScore, drama, reason };
}

const gateways = new Map<string, ReturnType<typeof createGateway>>();

function defaultModel(
  sdk: typeof import("ai"),
  apiKey: string,
): Experimental_EvaluationModel {
  let gateway = gateways.get(apiKey);
  if (!gateway) {
    gateway = sdk.createGateway({ apiKey });
    gateways.set(apiKey, gateway);
  }
  return gateway.evaluationModel(MODEL_ID);
}

function isExpectedFailure(err: unknown) {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  const status = (err as { statusCode?: unknown }).statusCode;
  return status === 429;
}

export async function classifyContent(
  env: AppEnv,
  input: {
    kind: ContentKind;
    text: string;
    // Parent post for a comment, quoted post for a quote.
    context?: string | null;
  },
  opts: {
    // Test seam; production resolves Jev through the Gateway.
    model?: Experimental_EvaluationModel;
    defer?: (promise: Promise<unknown>) => void;
  } = {},
): Promise<ContentScores | null> {
  const text = input.text.trim();
  if (text.length < MIN_TEXT_LENGTH) return CLEAN;

  const apiKey = env.AI_GATEWAY_API_KEY;
  if (!opts.model && !apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const sdk = await import("ai");
    const model = opts.model ?? defaultModel(sdk, apiKey as string);
    const result = await sdk.experimental_evaluate({
      model,
      state: {
        platform: PLATFORM_CONTEXT,
        kind: input.kind,
        text,
        ...(input.context
          ? { context: input.context.slice(0, CONTEXT_MAX_LENGTH) }
          : {}),
      },
      questions: CLASSIFIER_QUESTIONS,
      // The call blocks a user's write; a retry would only add latency.
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    return scoreAnswers(result.answers);
  } catch (err) {
    if (!isExpectedFailure(err)) {
      console.error("content classification failed", err);
      captureServerException(env, opts.defer, err, {
        properties: { classifier: input.kind },
      });
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
