# AI Voice Chatbox · AgentCore

A voice-driven AI chatbox that runs as a website. You speak a question, it
understands you, and it answers back out loud. Built with the latest browser
speech technologies plus a Node.js **AgentCore** backend that does the NLP/AI
reasoning, with an optional plug-in to a real LLM (OpenAI or a local Ollama /
Llama3 model).

This is a web-based adaptation of the ARM Educations *AI Voice IVR Platform*
concept. Instead of telephone/SIP calls, it delivers the same ASR → AI → TTS
loop through the browser so it can be shared with a public URL.

## Architecture & demo

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full architecture
diagram (rendered on GitHub) and a sample demo conversation showing how the
voice chatbox answers questions.

## How it works

```
 You speak  ──▶  Browser Speech-to-Text (Web Speech API)
                        │  transcribed text
                        ▼
                 AgentCore backend  ──▶  NLP intent engine
                 (Node.js / Express)      │
                        │                  ├─ built-in rules (time, date, greetings…)
                        │                  └─ LLM (OpenAI or Ollama) for open questions
                        ▼
                 Reply text  ──▶  Browser Text-to-Speech  ──▶  You hear the answer
```

| Layer            | Technology                          | Role                                    |
| ---------------- | ----------------------------------- | --------------------------------------- |
| Speech-to-Text   | Web Speech API (`SpeechRecognition`) | Convert your voice to text in-browser   |
| AI / NLP         | AgentCore + intent engine + LLM     | Understand intent, generate the answer  |
| Text-to-Speech   | Web Speech API (`speechSynthesis`)  | Speak the reply aloud                   |
| Web server       | Node.js + Express                   | Serve the site, host the `/api/chat` API |
| Public URL       | localtunnel                         | Share the app on the internet           |

## Requirements

- Node.js 18 or newer (uses built-in `fetch` and ES modules)
- A Chromium browser (Chrome or Edge) for voice input. Typing works everywhere.

## Setup

```bash
npm install
```

Optionally configure an LLM and settings:

```bash
cp .env.example .env
# edit .env
```

Without any config it runs on the **built-in NLP engine** — no API key needed.

## Run

```bash
npm start
```

Then open http://localhost:3000 and click the microphone.

## Get a public URL

With the server running, in a second terminal:

```bash
npm run tunnel
```

This prints a public `https://…loca.lt` URL you can share. (Any tunnel works —
ngrok or `cloudflared tunnel --url http://localhost:3000` are fine alternatives.)

## Using a free AI model (recommended)

The app is preconfigured for **Groq**, a free cloud LLM (runs Llama 3.1, no
credit card). Get a free key and paste it in:

1. Visit https://console.groq.com/keys and sign in
2. Create an API key (starts with `gsk_...`)
3. Put it in `.env`:
   ```
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_your_key_here
   GROQ_MODEL=llama-3.1-8b-instant
   ```
4. `npm start`

## Other AI options

Edit `.env`:

**OpenAI**
```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**Ollama (local, matches the PDF's Ollama + Llama3 stack)**
```
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```
Start it first with `ollama serve` and `ollama pull llama3`.

If the LLM is unreachable or errors, AgentCore automatically falls back to the
built-in NLP engine so the chatbox keeps working.

## Project structure

```
.
├── public/            # front-end (served as the website)
│   ├── index.html
│   ├── styles.css
│   └── app.js         # speech recognition + TTS + API calls
├── server/
│   ├── index.js       # Express server, /health and /api/chat
│   ├── agentcore.js   # orchestrator: NLP vs LLM decision
│   ├── nlp.js         # built-in intent classifier
│   ├── llm.js         # OpenAI / Ollama providers
│   └── tunnel.js      # public URL via localtunnel
├── .env.example
└── package.json
```

## API

`POST /api/chat`

```json
{ "message": "what time is it?", "history": [] }
```

Response:

```json
{ "reply": "The current time is …", "intent": "TIME", "confidence": 1, "source": "builtin" }
```

`GET /health` returns service status and the active LLM provider.

## Notes & limits

- Voice input relies on the browser Web Speech API, best supported in Chrome/Edge.
  On some browsers it uses a cloud service for recognition.
- Speech synthesis voices vary by operating system.
- This is a demo assistant. The banking/IVR intents (like balance inquiry) return
  placeholder responses rather than real account data.
