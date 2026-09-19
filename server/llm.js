// llm.js — AWS-powered LLM provider.
// This project uses AWS technologies only: the language model runs on
// Amazon Bedrock (AWS's managed generative-AI service) via the Converse API.
// Bedrock is called over HTTPS with AWS SigV4 signing (see awsSigner.js), so it
// works without the AWS SDK on Node 16+.
// LLM_PROVIDER=bedrock (default) or "builtin" (offline NLP fallback).

import { signedRequest } from "./awsSigner.js";

const SYSTEM_PROMPT =
  "You are a friendly AI assistant answering over a voice interface. " +
  "Keep answers concise and natural for spoken delivery — usually one to three sentences. " +
  "Avoid markdown, bullet points, code blocks, or emojis, since the reply will be read aloud.";

function awsCredentials() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
  };
}

/**
 * Amazon Bedrock provider (AWS). Uses the Converse API, which works across
 * Bedrock models (Amazon Nova, Anthropic Claude, Meta Llama, Mistral, etc.).
 */
async function bedrockGenerate({ system, messages }) {
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0";
  const creds = awsCredentials();
  if (!creds.accessKeyId || !creds.secretAccessKey) {
    throw new Error("AWS credentials are not set (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)");
  }

  // Bedrock Converse content-block message shape.
  const converseMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: [{ text: m.content }],
  }));

  const host = `bedrock-runtime.${region}.amazonaws.com`;
  // The model id contains a ":" which must be percent-encoded once (%3A) in the
  // path — and the SAME encoded path must be used for both the request and the
  // SigV4 canonical string, or the signature will not match.
  const path = `/model/${modelId.replace(/:/g, "%3A")}/converse`;

  const response = await signedRequest({
    service: "bedrock",
    region,
    host,
    path,
    credentials: creds,
    body: {
      messages: converseMessages,
      system: [{ text: system }],
      inferenceConfig: { maxTokens: 400, temperature: 0.6 },
    },
  });

  const blocks = response?.output?.message?.content || [];
  const text = blocks.map((b) => b.text || "").join(" ").trim();
  if (!text) throw new Error("Bedrock returned an empty response");
  return text;
}

/**
 * Returns the configured provider name, or "builtin".
 * @returns {"builtin"|"bedrock"}
 */
export function providerName() {
  const p = (process.env.LLM_PROVIDER || "bedrock").toLowerCase();
  return p === "bedrock" ? "bedrock" : "builtin";
}

/**
 * Whether the AWS LLM is configured. Bedrock is "enabled" when static AWS
 * credentials are present. Reachability/permissions are validated at call time.
 * @returns {boolean}
 */
export function llmEnabled() {
  if (providerName() !== "bedrock") return false;
  return Boolean(process.env.AWS_ACCESS_KEY_ID) && Boolean(process.env.AWS_SECRET_ACCESS_KEY);
}

/**
 * Generate a reply from the AWS LLM (Amazon Bedrock).
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

  if (provider === "bedrock") return bedrockGenerate(payload);
  throw new Error("No AWS LLM provider configured");
}
