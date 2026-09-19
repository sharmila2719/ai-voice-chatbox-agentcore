// index.js — Express web server.
// Serves the voice chatbox front-end and exposes the AgentCore chat API.

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleTurn } from "./agentcore.js";
import { providerName, llmEnabled } from "./llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

// Health check — mirrors the /health endpoint from the project spec.
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "agentcore-voice-chatbox",
    llmProvider: providerName(),
    llmEnabled: llmEnabled(),
  });
});

// Main chat endpoint: takes transcribed text, returns a spoken-friendly reply.
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (typeof message !== "string") {
      return res.status(400).json({ error: "Field 'message' (string) is required." });
    }
    const result = await handleTurn({ message, history: Array.isArray(history) ? history : [] });
    res.json(result);
  } catch (err) {
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: "Internal error handling the request." });
  }
});

app.listen(PORT, () => {
  console.log("\n  AI ChatBot (AgentCore + NLP + AWS Bedrock) is running");
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(
    `  LLM:      ${providerName()}${
      llmEnabled() ? " (AWS credentials detected)" : " (add AWS credentials to .env — using built-in NLP)"
    }`
  );
  console.log(`\n  To get a public URL, run in a second terminal:  npm run tunnel\n`);
});
