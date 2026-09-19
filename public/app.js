// app.js — voice chatbox client.
// Uses the Web Speech API for speech-to-text (SpeechRecognition) and
// speech synthesis for text-to-speech. Talks to the AgentCore backend at /api/chat.

(() => {
  "use strict";

  const chatEl = document.getElementById("chat");
  const transcriptEl = document.getElementById("transcript");
  const micButton = document.getElementById("micButton");
  const statusBadge = document.getElementById("statusBadge");
  const llmTag = document.getElementById("llmTag");
  const textForm = document.getElementById("textForm");
  const textInput = document.getElementById("textInput");
  const speakToggle = document.getElementById("speakToggle");

  // Conversation history sent to the backend for context.
  const history = [];
  let listening = false;
  let recognition = null;

  // ── UI helpers ──────────────────────────────────────────────
  function setStatus(text, kind) {
    statusBadge.textContent = text;
    statusBadge.className = "status-badge" + (kind ? " " + kind : "");
  }

  function addMessage(role, text, meta) {
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    if (meta) {
      const m = document.createElement("span");
      m.className = "meta";
      m.textContent = meta;
      el.appendChild(m);
    }
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
    return el;
  }

  // ── Text-to-speech ──────────────────────────────────────────
  function speak(text) {
    if (!speakToggle.checked) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.0;
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch (_) {
      /* ignore synthesis errors */
    }
  }

  // ── Backend call ────────────────────────────────────────────
  async function sendToAgent(message) {
    addMessage("user", message);
    history.push({ role: "user", content: message });
    setStatus("Thinking…", "thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(0, -1) }),
      });
      if (!res.ok) throw new Error("Server responded " + res.status);
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't generate a reply.";
      const meta =
        (data.source ? data.source : "builtin") +
        (data.intent && data.intent !== "UNKNOWN" ? " · " + data.intent : "");
      addMessage("bot", reply, meta);
      history.push({ role: "assistant", content: reply });
      speak(reply);
      setStatus("Ready");
    } catch (err) {
      console.error(err);
      addMessage("system", "Could not reach the assistant. Is the server running?");
      setStatus("Error", "error");
    }
  }

  // ── Speech recognition setup ────────────────────────────────
  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      micButton.disabled = true;
      addMessage(
        "system",
        "Speech recognition isn't supported in this browser. Use Chrome or Edge for voice, or type your question below."
      );
      return null;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = "";

    rec.onstart = () => {
      listening = true;
      finalText = "";
      micButton.classList.add("listening");
      setStatus("Listening…", "listening");
      transcriptEl.textContent = "";
    };

    rec.onresult = (event) => {
      let interim = "";
      finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      transcriptEl.textContent = finalText || interim;
    };

    rec.onerror = (event) => {
      console.warn("recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        addMessage("system", "Microphone access was blocked. Please allow it and try again.");
      }
      setStatus("Ready");
    };

    rec.onend = () => {
      listening = false;
      micButton.classList.remove("listening");
      const said = (finalText || transcriptEl.textContent || "").trim();
      transcriptEl.textContent = "";
      if (said) {
        sendToAgent(said);
      } else {
        setStatus("Ready");
      }
    };

    return rec;
  }

  function toggleListening() {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      return;
    }
    // Cancel any ongoing speech so the mic doesn't hear the bot.
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    try {
      recognition.start();
    } catch (_) {
      /* start() can throw if called twice quickly; ignore */
    }
  }

  // ── Health / provider tag ───────────────────────────────────
  async function loadHealth() {
    try {
      const res = await fetch("/health");
      const data = await res.json();
      const provider = data.llmProvider || "builtin";
      llmTag.textContent =
        provider === "builtin" ? "engine: built-in NLP" : "engine: " + provider;
    } catch (_) {
      llmTag.textContent = "";
    }
  }

  // ── Wire up events ──────────────────────────────────────────
  recognition = initRecognition();

  micButton.addEventListener("click", toggleListening);

  textForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = textInput.value.trim();
    if (!msg) return;
    textInput.value = "";
    sendToAgent(msg);
  });

  // Greeting
  addMessage("bot", "Hi! I'm your AI voice assistant. Tap the microphone and ask me anything.");
  loadHealth();
})();
