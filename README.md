# PaperCast

Turn a paper, memo, or notes file into a two-host podcast on your machine. No Speechify account, no OpenAI key, no cloud TTS.

PaperCast does **not** generate dialogue from raw extracted sentences. It runs a local loop:

**ExtractedPaper → PaperModel → EpisodePlan → Script → Critique → Benchmark**

Then it reads the script with the **Web Speech API** that already ships in Chrome and Edge. Better local TTS (Piper, macOS `say`, Coqui) is stubbed for later.

## What it does

- Upload PDF, Markdown, TXT, HTML, RTF, or DOCX.
- Extract text in the browser (`pdf.js` for PDFs, Mammoth for Word).
- Build a **PaperModel**: thesis, claims, evidence, methods, limitations.
- Pick **style** (Thoughtful Talk, Lecture, Fast Briefing, Deep Dive, Reviewer), **length**, and **audience**.
- Plan the episode from those claim ids, then write Maya (curious host) and Jordan (research explainer) from the plan.
- Critique grounding, repetition, and extractive leaks.
- Play the episode with system voices.
- **Benchmark** tab: score a sample stack or the current upload with an Ollama judge or the rule-based fallback.

Nothing leaves your machine except optional sample fetches from this same app. There is no auth, no database, and no paid API.

## Tabs

- **Studio** — upload, generate, listen, and inspect script / takeaways / claims / evidence / limitations.
- **Benchmark** — evaluation dashboard (scores 0–100, issues, recommendations, repeated phrases, missing coverage, export JSON).
- **Local Models** — Ollama connection, model picker, voice provider status.

Ollama judging runs locally. Scores are heuristic and should be used for iteration, not as objective truth.

## Ollama (optional, recommended)

If [Ollama](https://ollama.com) is running at `http://localhost:11434` with a pulled model, PaperCast uses it for writing and (on the Benchmark tab) for judging. If Ollama is down, times out, has no models, or returns unusable JSON, the **rule-based** writer and judge ship the episode instead.

Preferred models: `llama3.1`, then `qwen2.5`, then `mistral`, then any pulled model.

No `.env` file. No API keys. The app never calls a cloud model.

```bash
ollama pull llama3.1
ollama serve
```

## Run it

Verified with **Node 22** and npm. Use Node 22 or newer.

```bash
git clone git@github.com:aravinds-kannappan/PodcastAI.git
cd PodcastAI
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127). Drop a PDF or click **Load sample stack**, then **Make episode**, then play. Open the **Benchmark** tab to score the loop.

```bash
npm run build
npm start
```

`npm start` also binds to `http://127.0.0.1:43127`.

```bash
npm test
npm run lint
npm run typecheck
```

Browser voices are the playback fallback. Install an English system voice if SpeechSynthesis is silent. Local neural TTS is planned, not required.

## How the loop works without an API

1. **ExtractedPaper** — sections and source sentences from the file.
2. **PaperModel** — scored claims turned into gists, with the original sentence kept only as evidence.
3. **EpisodePlan** — beats (hook, thesis, methods, evidence, caveats, takeaways) that point at claim ids.
4. **Script** — Maya asks; Jordan answers from the gist, not from the page.
5. **Critique** — flags ungrounded lines, missing limitations, robotic filler, and 12-word source copies.
6. **Benchmark** — 0–100 scores for understanding, grounding, coverage, non-repetition, structure, and usefulness.

Local Next.js routes proxy Ollama on this machine only: `/api/ollama/tags`, `/api/ollama/generate`, `/api/benchmark`.

## Limits

- Scanned PDFs with no text layer cannot be read. Export a text PDF.
- Voices are whatever the browser offers. They will not match a commercial studio.
- The rule writer is dry on purpose. Ollama can color the dialogue locally; it still has to survive critique.
- Benchmark scores are for iteration, not a claim of objective quality.
- This is a first pass through a paper, not a substitute for reading one you have to review.

## License

MIT. Sample documents in `public/samples` are original synthetic text written for this project.
