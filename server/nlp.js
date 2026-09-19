// nlp.js — lightweight built-in NLP engine.
// Does intent classification + entity extraction with no external dependencies,
// so the chatbox answers immediately even without any LLM configured.

/**
 * Normalize text for matching: lowercase, strip punctuation, collapse spaces.
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize normalized text into words.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

// Intent definitions. Each intent has keyword/phrase patterns and a set of
// candidate spoken responses. Scoring rewards phrase matches over single words.
const INTENTS = [
  {
    name: "GREETING",
    patterns: ["hello", "hi", "hey", "good morning", "good evening", "good afternoon", "greetings"],
    responses: [
      "Hello! I'm your AI voice assistant. How can I help you today?",
      "Hi there! Ask me anything, just speak and I'll answer.",
    ],
  },
  {
    name: "GOODBYE",
    patterns: ["bye", "goodbye", "see you", "that is all", "thats all", "no thank you", "no thanks", "exit", "quit"],
    responses: [
      "Goodbye! Have a great day.",
      "Thanks for chatting. Talk to you soon!",
    ],
  },
  {
    name: "THANKS",
    patterns: ["thank you", "thanks", "appreciate it", "thank you so much"],
    responses: ["You're welcome!", "Happy to help. Anything else?"],
  },
  {
    name: "IDENTITY",
    patterns: ["who are you", "what are you", "your name", "what can you do", "what do you do"],
    responses: [
      "I'm an AI voice chatbox built on AgentCore. I use speech recognition to hear you, natural language processing to understand you, and text-to-speech to reply out loud.",
    ],
  },
  {
    name: "TIME",
    patterns: ["what time", "current time", "time now", "tell me the time"],
    responses: [], // handled dynamically
  },
  {
    name: "DATE",
    patterns: ["what date", "todays date", "what day", "current date", "day is it"],
    responses: [], // handled dynamically
  },
  {
    name: "HELP",
    patterns: ["help", "how do i use", "how does this work", "what should i say"],
    responses: [
      "Just press the microphone and speak your question. I can tell you the time and date, answer general questions, and chat. Try saying 'what can you do?'",
    ],
  },
  {
    name: "BALANCE_INQUIRY",
    patterns: ["account balance", "my balance", "check balance", "how much money", "balance inquiry"],
    responses: [
      "This is a demo assistant, so I don't have access to real accounts. In the full IVR system this would securely fetch your balance from the backend.",
    ],
  },
];

/**
 * Score how well text matches an intent's patterns.
 * @param {string} normText normalized user text
 * @param {{patterns:string[]}} intent
 * @returns {number}
 */
function scoreIntent(normText, intent) {
  let score = 0;
  for (const pattern of intent.patterns) {
    if (!pattern) continue;
    if (pattern.includes(" ")) {
      // multi-word phrase — strong signal
      if (normText.includes(pattern)) score += 2 + pattern.split(" ").length;
    } else {
      // single word — match on token boundary
      const re = new RegExp(`(^| )${pattern}( |$)`);
      if (re.test(normText)) score += 1;
    }
  }
  return score;
}

/**
 * Classify user text into the best matching intent.
 * @param {string} text
 * @returns {{intent:string, confidence:number, scores:Object}}
 */
export function classify(text) {
  const normText = normalize(text);
  let best = { name: "UNKNOWN", score: 0 };
  const scores = {};
  for (const intent of INTENTS) {
    const s = scoreIntent(normText, intent);
    scores[intent.name] = s;
    if (s > best.score) best = { name: intent.name, score: s };
  }
  // crude confidence: normalize score into 0..1 with diminishing returns
  const confidence = best.score === 0 ? 0 : Math.min(1, best.score / 5);
  return { intent: best.name, confidence, scores };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Produce a reply for a classified intent using the built-in rules.
 * Returns null when the intent has no canned/dynamic answer (caller should
 * fall back to the LLM or a default).
 * @param {string} intent
 * @returns {string|null}
 */
export function replyForIntent(intent) {
  switch (intent) {
    case "TIME": {
      const now = new Date();
      return `The current time is ${now.toLocaleTimeString()}.`;
    }
    case "DATE": {
      const now = new Date();
      return `Today is ${now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`;
    }
    default: {
      const def = INTENTS.find((i) => i.name === intent);
      if (def && def.responses.length) return pick(def.responses);
      return null;
    }
  }
}
