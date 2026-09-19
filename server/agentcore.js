// agentcore.js — the orchestrator brain.
// Mirrors the "Bot Orchestrator" role from the project PDF. Every turn flows
// through three layers:
//   1. NLP     (nlp.js)  — classify intent + extract signal from the utterance
//   2. AgentCore (here)  — decide how to answer and assemble context
//   3. LLM     (llm.js)  — generate the natural-language answer
//
// The LLM is the primary reasoning engine. The only things answered without it
// are deterministic facts the model cannot know reliably (the real time/date),
// which NLP detects and AgentCore computes directly.

import { classify, replyForIntent } from "./nlp.js";
import { generateReply, llmEnabled, providerName } from "./llm.js";

// Intents that are pure local computations (an LLM would only guess these).
const DETERMINISTIC = new Set(["TIME", "DATE"]);

/**
 * Process one user utterance and produce a reply.
 * @param {object} input
 * @param {string} input.message  transcribed user text
 * @param {{role:string, content:string}[]} [input.history] prior turns
 * @returns {Promise<{reply:string, intent:string, confidence:number, source:string}>}
 */
export async function handleTurn({ message, history = [] }) {
  const text = String(message || "").trim();
  if (!text) {
    return {
      reply: "I didn't catch that. Could you say it again?",
      intent: "EMPTY",
      confidence: 0,
      source: "builtin",
    };
  }

  // ── Layer 1: NLP intent classification (always runs) ──
  const { intent, confidence } = classify(text);

  // ── Deterministic short-circuit: time/date are computed, never guessed ──
  if (DETERMINISTIC.has(intent) && confidence >= 0.4) {
    const local = replyForIntent(intent);
    if (local) return { reply: local, intent, confidence, source: "builtin" };
  }

  // ── Layer 2/3: AgentCore delegates to the LLM as the primary engine ──
  if (llmEnabled()) {
    try {
      // Give the LLM the NLP result as a hint so intent guides the response.
      const intentHint =
        intent && intent !== "UNKNOWN"
          ? `\n\n(Detected intent: ${intent}. Answer naturally in that context.)`
          : "";
      const reply = await generateReply({
        message: text + intentHint,
        history,
      });
      if (reply) {
        return {
          reply,
          intent: intent === "UNKNOWN" ? "LLM" : intent,
          confidence,
          source: providerName(),
        };
      }
    } catch (err) {
      // LLM unreachable/misconfigured — degrade gracefully so the app still talks.
      console.warn(`[agentcore] LLM error, using built-in fallback: ${err.message}`);
    }
  }

  // ── Fallback: built-in NLP reply, or a prompt to enable the LLM ──
  const local = replyForIntent(intent);
  if (local) return { reply: local, intent, confidence, source: "builtin" };

  return {
    reply:
      "I understood your question but the AI language model isn't reachable right now. " +
      "Set LLM_PROVIDER (openai or ollama) in the .env file to enable full AI answers. " +
      "Meanwhile I can still tell you the time, the date, or what I can do.",
    intent: "UNKNOWN",
    confidence,
    source: "builtin",
  };
}
