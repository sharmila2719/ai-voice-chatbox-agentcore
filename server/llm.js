// llm.js — pluggable LLM providers.
// Selected via LLM_PROVIDER env: "builtin" (none), "groq", "openai", or "ollama".
// Each provider exposes async generate({ system, messages }) -> string.
// "groq" is a FREE cloud LLM (free API key) and is the default recommendation.

import { getFetch } from "./fetchCompat.js";

const SYSTEM_PROMPT =
  "You are a friendly AI voice assistant answering over a voice interface. " +
  "Keep answers concise and natural for spoken delivery — usually one to three sentences. " +
  "Avoid markdown, bullet points, code blocks, or emojis, since the reply will be read aloud.";

/**
 * OpenAI Chat Completions provider.
 */
async function openaiGenerate({ system, messages }) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const fetch = await getFetch();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.6,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Pollinations provider — FREE public LLM, no API key / no signup required.
 * Uses the OpenAI-compatible endpoint at text.pollinations.ai.
 * Quality/uptime are lower than paid providers, but it needs zero config.
 */
async function pollinationsGenerate({ system, messages }) {
  const model = process.env.POLLINATIONS_MODEL || "openai";
  const fetch = await getFetch();
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Pollinations request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  // The endpoint may return JSON (OpenAI shape) or, occasionally, plain text.
  const raw = await res.text();
  try {
    const data = JSON.parse(raw);
    return data?.choices?.[0]?.message?.content?.trim() || raw.trim();
  } catch {
    return raw.trim();
  }
}

/**
 * Groq provider — FREE cloud LLM with an OpenAI-compatible API.
 * Get a free key at https://console.groq.com/keys
 */
async function groqGenerate({ system, messages }) {
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const fetch = await getFetch();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.6,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Ollama local LLM provider (matches the PDF's Ollama + Llama3 stack).
 */
async function ollamaGenerate({ system, messages }) {
  const base = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3";

  const fetch = await getFetch();
  const res = await fetch(`${base.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "system", content: system }, ...messages],
      options: { temperature: 0.6 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Ollama request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.message?.content?.trim() || "";
}

/**
 * Returns the configured provider name, or "builtin" if none.
 * @returns {"builtin"|"openai"|"ollama"}
 */
export function providerName() {
  const p = (process.env.LLM_PROVIDER || "builtin").toLowerCase();
  return ["pollinations", "groq", "openai", "ollama"].includes(p) ? p : "builtin";
}

/**
 * Whether a real LLM is configured and usable.
 * @returns {boolean}
 */
export function llmEnabled() {
  const p = providerName();
  if (p === "pollinations") return true; // no key needed; reachability checked at call time
  if (p === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (p === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (p === "ollama") return true; // reachability checked at call time
  return false;
}

/**
 * Generate a reply from the configured LLM.
 * @param {{message:string, history?:{role:string, content:string}[]}} input
 * @returns {Promise<string>}
 */
export async function generateReply({ message, history = [] }) {
  const provider = providerName();
  const messages = [
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
  const payload = { system: SYSTEM_PROMPT, messages };

  if (provider === "pollinations") return pollinationsGenerate(payload);
  if (provider === "groq") return groqGenerate(payload);
  if (provider === "openai") return openaiGenerate(payload);
  if (provider === "ollama") return ollamaGenerate(payload);
  throw new Error("No LLM provider configured");
}
