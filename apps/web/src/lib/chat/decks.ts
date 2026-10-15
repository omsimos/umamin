/** Game card decks: plain data shared by the chat room (cardId validation),
 *  the UI (rendering), and the mock transport. Card ids are part of the wire
 *  protocol: never reuse or repurpose one within a deploy window. */

export type DeckId =
  | "this-or-that"
  | "would-you-rather"
  | "hot-takes"
  | "never-have-i-ever"
  | "green-or-red";

export interface GameCard {
  id: string;
  deck: DeckId;
  /** Optional framing line above the options. */
  prompt?: string;
  optionA: string;
  optionB: string;
  /** Offered as a one-tap message after the reveal, so a round feeds the
   *  conversation. Must read naturally whatever either side picked. */
  followUp: string;
}

type Entry = [id: string, a: string, b: string, followUp: string];
type Statement = [id: string, prompt: string, followUp: string];

function choices(deck: DeckId, prefix: string, prompt?: string) {
  return (entries: Entry[]): GameCard[] =>
    entries.map(([id, optionA, optionB, followUp]) => ({
      id: `${prefix}-${id}`,
      deck,
      ...(prompt ? { prompt } : {}),
      optionA,
      optionB,
      followUp,
    }));
}

/** Decks where every card shares the same two answers. */
function statements(
  deck: DeckId,
  prefix: string,
  optionA: string,
  optionB: string,
  frame: (s: string) => string = (s) => s,
) {
  return (entries: Statement[]): GameCard[] =>
    entries.map(([id, prompt, followUp]) => ({
      id: `${prefix}-${id}`,
      deck,
      prompt: frame(prompt),
      optionA,
      optionB,
      followUp,
    }));
}

export const GAME_DECKS: Record<DeckId, GameCard[]> = {
  "this-or-that": choices(
    "this-or-that",
    "tot",
  )([
    ["coffee", "Coffee", "Tea", "What's your usual order?"],
    ["owl", "Early bird", "Night owl", "What time do you usually sleep?"],
    ["beach", "Beach", "Mountains", "What's the best trip you've taken?"],
    ["call", "Call", "Text", "Voice notes: love them or hate them?"],
    ["dogs", "Dogs", "Cats", "Do you have any pets?"],
    ["sweet", "Sweet", "Savory", "What's your comfort snack?"],
    ["summer", "Summer", "Winter", "What's your perfect weather?"],
    ["books", "Books", "Podcasts", "Anything good you've been into lately?"],
    [
      "city",
      "Big city",
      "Small town",
      "If you could live anywhere, where would it be?",
    ],
    [
      "cinema",
      "Cinema night",
      "Couch movie night",
      "What's the last movie you really liked?",
    ],
    ["jollibee", "Jollibee", "McDo", "What do you always order there?"],
    ["adobo", "Adobo", "Sinigang", "Who makes the best one you've had?"],
    ["milktea", "Milk tea", "Iced coffee", "What's your go-to drink?"],
    [
      "plans",
      "Plan everything",
      "Wing it",
      "What's the most spontaneous thing you've done?",
    ],
    ["weekend", "Stay in", "Go out", "What does your ideal weekend look like?"],
    ["sunrise", "Sunrise", "Sunset", "What's the best view you've ever seen?"],
    [
      "games",
      "Mobile games",
      "Console or PC",
      "What are you playing these days?",
    ],
    ["series", "Movies", "Series", "What are you watching right now?"],
    [
      "adaptation",
      "Read the book",
      "Watch the movie",
      "Which adaptation actually got it right?",
    ],
    [
      "seat",
      "Window seat",
      "Aisle seat",
      "Where's the last place you traveled to?",
    ],
    ["anime", "Anime", "K-drama", "What got you into it?"],
    [
      "hangout",
      "Big group",
      "One-on-one",
      "What does a good hangout look like for you?",
    ],
    ["shower", "Morning shower", "Night shower", "Okay but why, though?"],
    ["ube", "Ube", "Mango", "What's the best dessert you've ever had?"],
  ]),
  "would-you-rather": choices(
    "would-you-rather",
    "wyr",
    "Would you rather…",
  )([
    ["fly", "Fly", "Be invisible", "Where would you go first?"],
    [
      "time",
      "Visit the past",
      "Visit the future",
      "What year are you visiting?",
    ],
    [
      "minds",
      "Read minds",
      "Pause time",
      "What's the first thing you'd do with it?",
    ],
    [
      "animals",
      "Talk to animals",
      "Speak every language",
      "Which animal or language first?",
    ],
    [
      "fame",
      "Be famous",
      "Be secretly rich",
      "What's the first thing you'd buy?",
    ],
    [
      "media",
      "Live without music",
      "Live without movies",
      "What song would you miss the most?",
    ],
    [
      "food",
      "Eat your favorite food forever",
      "Never eat it again",
      "What's your favorite food, though?",
    ],
    [
      "outcome",
      "Know every outcome",
      "Be surprised forever",
      "What would you want to know first?",
    ],
    [
      "island",
      "Tropical island",
      "Cabin in the woods",
      "Who are you bringing with you?",
    ],
    [
      "memory",
      "Relive one day",
      "Erase one memory",
      "What's a day you'd happily relive?",
    ],
    [
      "teleport",
      "Teleport anywhere",
      "Never need sleep",
      "What would you do with the extra time?",
    ],
    [
      "rewind",
      "Have a rewind button",
      "Have a pause button",
      "When would you have used it this week?",
    ],
    [
      "master",
      "Master any instrument",
      "Master any sport",
      "Which one would you pick?",
    ],
    [
      "leak",
      "Leak your search history",
      "Leak your camera roll",
      "What's the most chaotic thing you've searched?",
    ],
    [
      "sing",
      "Sing instead of talk",
      "Dance everywhere you walk",
      "What song would be your theme?",
    ],
    [
      "weather",
      "Always summer",
      "Always rainy",
      "What do you do on a rainy day?",
    ],
    [
      "lottery",
      "Win the lottery",
      "Live twice as long",
      "What would you do first?",
    ],
    [
      "phone",
      "Lose your phone for a week",
      "Lose your voice for a week",
      "How would you survive it?",
    ],
    [
      "world",
      "Live in a movie",
      "Live in a video game",
      "Which one would you live in?",
    ],
    [
      "cringe",
      "Relive your most awkward moment",
      "Let everyone watch it once",
      "Okay, what was the moment?",
    ],
    [
      "room",
      "Be the funniest in the room",
      "Be the smartest in the room",
      "Who's the funniest person you know?",
    ],
    [
      "friends",
      "One best friend",
      "Ten good friends",
      "What makes someone a real friend to you?",
    ],
    [
      "helper",
      "Have a personal chef",
      "Have a personal driver",
      "What would make your week easier?",
    ],
    [
      "era",
      "Be a kid again for a day",
      "Be ten years older for a day",
      "What would you tell your younger self?",
    ],
  ]),
  "hot-takes": statements(
    "hot-takes",
    "ht",
    "Agree",
    "Disagree",
  )([
    [
      "pineapple",
      "Pineapple belongs on pizza.",
      "What's your actual favorite pizza?",
    ],
    ["cereal", "Cereal is a soup.", "What else is secretly a soup?"],
    [
      "reply",
      "Replying instantly is attractive, not desperate.",
      "How fast do you usually reply?",
    ],
    [
      "breakfast",
      "Breakfast food is the best food.",
      "What's the best breakfast you know?",
    ],
    [
      "home-movie",
      "Watching at home beats the cinema.",
      "What's the last movie you watched?",
    ],
    [
      "cold-pizza",
      "Cold pizza beats reheated pizza.",
      "What's a weird food combo you love?",
    ],
    [
      "old-music",
      "Music peaked ten years ago.",
      "What's a song that hits every time?",
    ],
    [
      "morning",
      "Morning people are doing life right.",
      "What does your morning look like?",
    ],
    [
      "spoilers",
      "Spoilers don't actually ruin a story.",
      "Has a spoiler ever ruined something for you?",
    ],
    ["hotdog", "A hot dog is a sandwich.", "Is a taco a sandwich, then?"],
    [
      "sequels",
      "Sequels are usually better than the original.",
      "Which sequel actually won?",
    ],
    [
      "group-chat",
      "Every group chat should be muted.",
      "How many group chats are you in?",
    ],
    ["rice", "Every meal is better with rice.", "Rice with what, though?"],
    ["k", "Replying with just 'k' is rude.", "What reply annoys you the most?"],
    ["naps", "Naps are a waste of time.", "Are you a nap person?"],
    [
      "online-friends",
      "Online friends are real friends.",
      "Have you ever met an online friend in person?",
    ],
    [
      "socials",
      "Social media was better a few years ago.",
      "Which app do you open first in the morning?",
    ],
    [
      "staying-in",
      "Canceled plans are the best plans.",
      "What do you do with the free time?",
    ],
    ["mango", "Mango is the best fruit.", "Okay, what's a better fruit?"],
    [
      "group-projects",
      "Group projects should be banned.",
      "What's your worst group project story?",
    ],
    [
      "cold-room",
      "You can't sleep unless the room is cold.",
      "Fan or aircon person?",
    ],
    [
      "remakes",
      "Remakes ruin the classics.",
      "Which remake should never have happened?",
    ],
    [
      "texting-first",
      "Texting first isn't a big deal.",
      "Do you usually text first?",
    ],
    [
      "dessert",
      "Dessert first is a valid life choice.",
      "What's the dessert worth skipping dinner for?",
    ],
  ]),
  "never-have-i-ever": statements(
    "never-have-i-ever",
    "nhie",
    "I have",
    "Never",
    (s) => `Never have I ever… ${s}`,
  )([
    [
      "ghosted",
      "ghosted someone mid-conversation.",
      "What makes you lose interest in a chat?",
    ],
    [
      "cried-movie",
      "cried at a movie.",
      "What's the saddest movie you've seen?",
    ],
    [
      "all-nighter",
      "pulled an all-nighter for no good reason.",
      "What's the latest you've stayed up, and why?",
    ],
    [
      "fake-song",
      "pretended to know a song.",
      "What song have you had on repeat lately?",
    ],
    [
      "wrong-text",
      "sent a text to the wrong person.",
      "What's the most awkward text you've ever sent?",
    ],
    [
      "binge",
      "binged a whole series in one day.",
      "What's the last show you couldn't stop watching?",
    ],
    [
      "self-talk",
      "had a full conversation with myself.",
      "Do you narrate your life in your head too?",
    ],
    [
      "floor-food",
      "eaten something right off the floor.",
      "Five-second rule: real or fake?",
    ],
    [
      "fake-laugh",
      "laughed at a joke I didn't get.",
      "What's a joke that always gets you?",
    ],
    [
      "rewatch",
      "rewatched a show instead of starting a new one.",
      "What's your comfort show?",
    ],
    [
      "scrolled",
      "scrolled way too far back on someone's profile.",
      "Are you a lurker or a poster?",
    ],
    [
      "busy",
      "pretended to be busy to skip plans.",
      "What's your favorite excuse?",
    ],
    [
      "karaoke",
      "sung karaoke in front of strangers.",
      "What's your karaoke song?",
    ],
    [
      "lost",
      "gotten lost in my own city.",
      "What's your favorite spot where you live?",
    ],
    [
      "unsent",
      "typed a long message and deleted it.",
      "Do you overthink texts too?",
    ],
    [
      "family-size",
      "finished a family-size snack alone.",
      "What's your ultimate snack?",
    ],
    [
      "selfies",
      "taken fifty selfies to post one.",
      "Do you post a lot or mostly lurk?",
    ],
    [
      "wave",
      "waved back at someone who wasn't waving at me.",
      "What's your most awkward moment this year?",
    ],
    [
      "names",
      "forgotten someone's name right after hearing it.",
      "Are you better with names or faces?",
    ],
    [
      "class-nap",
      "fallen asleep in class.",
      "What's the hardest class you've taken?",
    ],
    [
      "celeb",
      "had a celebrity crush that lasted years.",
      "Which celebrity would you want to meet?",
    ],
    [
      "burned",
      "burned something while cooking.",
      "What's one dish you can actually cook?",
    ],
    [
      "on-read",
      "left someone on read on purpose.",
      "How long before a late reply starts to bother you?",
    ],
    [
      "room-dance",
      "danced alone in my room like nobody was watching.",
      "What song makes you dance no matter what?",
    ],
  ]),
  "green-or-red": statements(
    "green-or-red",
    "gr",
    "🟢 Green flag",
    "🚩 Red flag",
  )([
    [
      "voice-notes",
      "Sends voice notes instead of texts.",
      "Voice notes or texts for you?",
    ],
    ["early", "Shows up 15 minutes early.", "Are you usually early or late?"],
    ["plants", "Owns way too many houseplants.", "Can you keep a plant alive?"],
    [
      "fast-reply",
      "Replies to everything within a minute.",
      "What's your usual reply speed?",
    ],
    [
      "no-socials",
      "Has no social media at all.",
      "Which app could you never delete?",
    ],
    [
      "same-order",
      "Orders the same thing every single time.",
      "What's your forever order?",
    ],
    [
      "playlist",
      "Makes you a playlist.",
      "What song would you put on a playlist for a stranger?",
    ],
    [
      "ex-friends",
      "Is still best friends with their ex.",
      "Can exes really be friends?",
    ],
    [
      "lowercase",
      "Texts in all lowercase.",
      "Lowercase texter or proper punctuation?",
    ],
    [
      "phone-dinner",
      "Checks their phone all through dinner.",
      "How bad is your screen time?",
    ],
    [
      "details",
      "Remembers tiny things you mentioned once.",
      "What's a small thing that makes your day?",
    ],
    [
      "calls-mom",
      "Calls their mom every day.",
      "Who do you talk to the most every day?",
    ],
    [
      "zodiac",
      "Picks friends based on zodiac signs.",
      "What's your sign, and do you believe in it?",
    ],
    [
      "gym",
      "Brings up the gym in every conversation.",
      "What could you talk about for hours?",
    ],
    [
      "toppings",
      "Has very strong opinions about pizza toppings.",
      "What's on your perfect pizza?",
    ],
    [
      "lurker",
      "Watches all your stories but never replies.",
      "Are you a lurker or a replier?",
    ],
    [
      "competitive",
      "Gets way too competitive at board games.",
      "What game brings out your competitive side?",
    ],
    ["k", "Replies with just 'k'.", "What's the worst one-word reply?"],
    ["alarms", "Sets seven alarms to wake up.", "How many alarms do you set?"],
    [
      "pet-talk",
      "Talks to their pet like a person.",
      "What would your pet say about you?",
    ],
    [
      "sorry-first",
      "Always says sorry first after a fight.",
      "Are you quick to apologize?",
    ],
    [
      "honest",
      "Is brutally honest about everything.",
      "Truth that stings or a nice lie?",
    ],
    [
      "plans-ahead",
      "Plans hangouts weeks in advance.",
      "Planner or last-minute person?",
    ],
    ["reads-receipts", "Turns off read receipts.", "Read receipts on or off?"],
  ]),
};

export const DECK_ORDER: DeckId[] = [
  "this-or-that",
  "would-you-rather",
  "hot-takes",
  "never-have-i-ever",
  "green-or-red",
];

export const DECK_META: Record<
  DeckId,
  { label: string; emoji: string; hint: string }
> = {
  "this-or-that": { label: "This or That", emoji: "⚡", hint: "Quick picks" },
  "would-you-rather": {
    label: "Would You Rather",
    emoji: "🤔",
    hint: "Impossible choices",
  },
  "hot-takes": { label: "Hot Takes", emoji: "🌶️", hint: "Agree or disagree" },
  "never-have-i-ever": {
    label: "Never Have I Ever",
    emoji: "🙊",
    hint: "Confess or deny",
  },
  "green-or-red": {
    label: "Green or Red Flag",
    emoji: "🚩",
    hint: "Call the flag",
  },
};

/** What the play menu offers: a deck, or Mind Reader across every deck. */
export type PlayChoice = DeckId | "mind-reader";

const CARDS_BY_ID = new Map<string, GameCard>(
  Object.values(GAME_DECKS)
    .flat()
    .map((c) => [c.id, c]),
);

export function cardById(id: string): GameCard | undefined {
  return CARDS_BY_ID.get(id);
}

const STATEMENT_DECKS = new Set<DeckId>([
  "hot-takes",
  "never-have-i-ever",
  "green-or-red",
]);

/** One line naming a card: the statement for decks whose cards all share the
 *  same two answers, otherwise the two options. */
export function cardTitle(card: GameCard): string {
  return STATEMENT_DECKS.has(card.deck) && card.prompt
    ? card.prompt
    : `${card.optionA} or ${card.optionB}`;
}

/** Draws a card the pair hasn't played yet. Once a pool runs dry it reshuffles
 *  rather than ending the game. */
export function drawCard(
  choice: PlayChoice,
  played: ReadonlySet<string>,
  random: () => number = Math.random,
): GameCard {
  const pool =
    choice === "mind-reader"
      ? DECK_ORDER.flatMap((d) => GAME_DECKS[d])
      : GAME_DECKS[choice];
  const fresh = pool.filter((c) => !played.has(c.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(random() * from.length)];
}
