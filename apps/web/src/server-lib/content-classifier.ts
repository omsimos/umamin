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

// Pinned: the bare alias follows jev-latest, which moves without a deploy, and
// the thresholds and scripts/moderation-cases.json were tuned on 1.13. 1.14
// scored counter-speech 15-30 points higher on drama in the regression gate.
const MODEL_ID = "typesafe-ai/jev-1.13.0";
const TIMEOUT_MS = 2000;
const MIN_TEXT_LENGTH = 3;
const CONTEXT_MAX_LENGTH = 500;
const THREAD_MAX_COMMENTS = 3;
const THREAD_COMMENT_MAX_LENGTH = 200;

// Sent once in the state rather than repeated per question: the state is
// billed once, each question separately.
const PLATFORM_CONTEXT =
  'The text is from a Philippine social app and may be English, Filipino/Tagalog, Bisaya, or Taglish, sometimes disguised with alternating caps, number substitution, or split syllables ("t4ng1na", "ba is liw" for baliw). Casual profanity used for emphasis or banter (tangina, leche, bwisit, gago between friends) is not by itself hateful or harassing.';

// Only sent with a replyingTo: on a standalone post it nudged every drama
// score down for no reason.
const REPLY_CONTEXT =
  '"replyingTo" is a different person\'s post that the author is replying to or quoting. Judge only what the author wrote in "text": the author is responsible for replyingTo only if their text agrees with it, repeats it, or adds to it. Condemning, questioning, or reporting it is not the author attacking anyone.';

// Replaces REPLY_CONTEXT when a comment has earlier comments. The last clause
// keeps a defender in a hostile thread from scoring like the attacker: without
// it, pile-ons were caught but counter-speech drama rose with them.
const THREAD_CONTEXT =
  '"replyingTo" is a different person\'s post that the author is commenting on, and "earlierComments" are other people\'s comments on that post, oldest first, written before the author\'s. Judge only what the author wrote in "text": the author is responsible for replyingTo or an earlier comment only if their text agrees with it, repeats it, or adds to it. Condemning, questioning, or reporting it is not the author attacking anyone. Agreeing with, laughing along with, or adding to an earlier comment that attacks or mocks someone is joining in on it; defending that person or disagreeing with the comment is not drama.';

// Safe to soften on because the question is the recipient's own text: the send
// path stores their profile prompt or note, never a sender-supplied string.
const QUESTION_CONTEXT =
  '"question" is the prompt the recipient posted on their own profile, and "text" is an anonymous message someone sent them in answer to it. Judge only what the sender wrote in "text". Answering what the recipient asked, even frankly, is not drama or gossip by itself.';

export const CLASSIFIER_QUESTIONS = {
  hate: {
    type: "boolean",
    instructions:
      "Does the text attack or use slurs against people because of race, ethnicity, nationality, religion, gender, sexual orientation, or disability? Criticism of politicians, parties, or public figures is not hate.",
  },
  // The wording alone keeps cries for help from scoring as threats. A score
  // override on a separate self-harm question let "I'll kill you and then
  // myself" through; scripts/moderation-cases.json holds both sides.
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
  sexual: {
    type: "boolean",
    instructions:
      "Does the text sexually harass someone, ask someone for sexual photos, video calls, or meetups, sexualize a minor or anyone who says they are under 18, or threaten to share someone's intimate photos?",
  },
  encouragesSelfHarm: {
    type: "boolean",
    instructions:
      "Does the text tell, dare, or wish another person to hurt or kill themselves (for example kys, magpakamatay ka na)? The author talking about their own pain or wanting to die is not this.",
  },
  // Common local scams named outright: the generic wording alone doesn't tie
  // "see who sent your message" or a lookalike domain to phishing.
  scam: {
    type: "boolean",
    instructions:
      "Is the text a scam, phishing, or spam attempt? For example: promising free money, GCash or Maya cash, load, prizes, or giveaways for clicking a link or sending details; asking for an OTP, password, or login; offering to reveal who sent an anonymous message; investment or crypto schemes that double money; online casino, sabong, or betting promotions; selling followers or accounts; or a link pretending to be Umamin, GCash, Maya, a bank, or a delivery service. Sharing a normal link to a song, article, or video is not a scam. Warning people about a scam is not a scam.",
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
  sexual: BooleanAnswer;
  encouragesSelfHarm: BooleanAnswer;
  scam: BooleanAnswer;
  harassment: BooleanAnswer;
  drama: { choice: string; probabilities?: Record<string, number> };
  political: BooleanAnswer;
};

export type ContentKind = "post" | "comment" | "note" | "message";

export type ContentScores = {
  severe: number;
  drama: number;
  reason: string | null;
};

const CLEAN: ContentScores = { severe: 0, drama: 0, reason: null };

const SEVERE_KEYS = [
  "hate",
  "threat",
  "doxxing",
  "sexual",
  "encouragesSelfHarm",
  "scam",
  "harassment",
] as const;
// Below this, a severe question doesn't name the reason; the drama choice does.
const SEVERE_REASON_FLOOR = 50;

const pct = (probability: number) =>
  Math.round(Math.min(Math.max(probability, 0), 1) * 100);

// An @handle means the text is aimed at a user on the app, which the
// political exemption must never cover.
const MENTION = /(?:^|[^\w@])@[\w-]{2,}/;

/** Pure mapping from Jev's answers to the 0-100 scores stored on a row. */
export function scoreAnswers(
  answers: ClassifierAnswers,
  text = "",
  kind?: ContentKind,
): ContentScores {
  const severe: Record<(typeof SEVERE_KEYS)[number], number> = {
    hate: answers.hate.probability,
    threat: answers.threat.probability,
    doxxing: answers.doxxing.probability,
    sexual: answers.sexual.probability,
    encouragesSelfHarm: answers.encouragesSelfHarm.probability,
    scam: answers.scam.probability,
    harassment: answers.harassment.probability,
  };

  // A message is always aimed at its recipient, the case the exemption must
  // never cover (same reason as an @handle).
  const political =
    kind !== "message" &&
    answers.political.probability >= 0.5 &&
    !MENTION.test(text);
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

// The Gateway reports our own timeout as a 500 whose cause is the AbortError,
// so the cause chain is walked. Returns the matching error's name, or null for
// a failure worth reporting.
function expectedFailureName(err: unknown): string | null {
  let current = err;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== "object" || current === null) return null;
    const { name, statusCode, cause } = current as {
      name?: unknown;
      statusCode?: unknown;
      cause?: unknown;
    };
    if (name === "AbortError" || name === "TimeoutError") return name;
    if (statusCode === 429) return typeof name === "string" ? name : "429";
    current = cause;
  }
  return null;
}

export type ClassifyInput = {
  kind: ContentKind;
  text: string;
  // Parent post for a comment, quoted post for a quote.
  context?: string | null;
  // A comment's earlier comments by other people, oldest first.
  thread?: readonly string[] | null;
  // The recipient's profile prompt a message answers.
  question?: string | null;
};

function buildState(input: ClassifyInput, text: string) {
  const thread = (input.thread ?? [])
    .map((comment) => comment.trim().slice(0, THREAD_COMMENT_MAX_LENGTH))
    .filter(Boolean)
    .slice(-THREAD_MAX_COMMENTS);
  const question = input.question?.trim().slice(0, CONTEXT_MAX_LENGTH);

  const platform = [PLATFORM_CONTEXT];
  if (thread.length > 0) platform.push(THREAD_CONTEXT);
  else if (input.context) platform.push(REPLY_CONTEXT);
  if (question) platform.push(QUESTION_CONTEXT);

  return {
    platform: platform.join(" "),
    kind: input.kind,
    text,
    ...(input.context
      ? { replyingTo: input.context.slice(0, CONTEXT_MAX_LENGTH) }
      : {}),
    ...(thread.length > 0 ? { earlierComments: thread } : {}),
    ...(question ? { question } : {}),
  };
}

export async function classifyContent(
  env: AppEnv,
  input: ClassifyInput,
  opts: {
    // Test seam; production resolves Jev through the Gateway.
    model?: Experimental_EvaluationModel;
    defer?: (promise: Promise<unknown>) => void;
    // A background retry has no user waiting on it.
    timeoutMs?: number;
  } = {},
): Promise<ContentScores | null> {
  const text = input.text.trim();
  if (text.length < MIN_TEXT_LENGTH) return CLEAN;

  const apiKey = env.AI_GATEWAY_API_KEY;
  if (!opts.model && !apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? TIMEOUT_MS,
  );

  try {
    const sdk = await import("ai");
    const model = opts.model ?? defaultModel(sdk, apiKey as string);
    const result = await sdk.experimental_evaluate({
      model,
      state: buildState(input, text),
      questions: CLASSIFIER_QUESTIONS,
      // The call blocks a user's write; a retry would only add latency.
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    return scoreAnswers(result.answers, text, input.kind);
  } catch (err) {
    const expected = expectedFailureName(err);
    if (expected) {
      // Kind and error name only: enough for Workers Logs to show the rate.
      console.warn("content classification skipped", {
        kind: input.kind,
        error: expected,
      });
    } else {
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
