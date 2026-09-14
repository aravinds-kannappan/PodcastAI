# PaperCast

Turn a paper, memo, or notes file into a two-host podcast in the browser. No Speechify account, no OpenAI key, no cloud TTS.

PaperCast does **not** generate dialogue from raw extracted sentences. It runs a local loop:

**ExtractedPaper → PaperModel → EpisodePlan → Script → Critique → Benchmark**

Then it reads the script with the **Web Speech API** that already ships in Chrome and Edge.

## What it does

- Upload PDF, Markdown, TXT, HTML, RTF, or DOCX (plus CSV and TeX).
- Extract text in the browser (`pdf.js` for PDFs, Mammoth for Word).
- Build a **PaperModel**: paraphrased claims with evidence quotes, a thesis, methods, and limitations.
- Plan the episode from those claim ids, then write Maya and Jordan from the plan.
- Critique grounding and extractive leaks; score coverage, grounding, leak rate, and host balance.
- Play the episode with system voices. Pause, skip lines, change speed, download the script.
- Sample stack included: a synthetic research PDF plus two shorter notes files.

Nothing leaves your machine except optional sample fetches from this same app. There is no auth, no database, and no paid API.

## Ollama (optional)

If [Ollama](https://ollama.com) is running at `http://localhost:11434` with a pulled model, PaperCast will try it for the script step. The pass is kept only if critique still finds no raw-sentence leak. If Ollama is down, times out, or returns unusable JSON, the **rule-based writer** ships the episode instead.

No `.env` file. No API keys. The app never calls a cloud model.

```bash
ollama serve
ollama pull llama3.2
```

## Run it

Verified with **Node v22.23.2** and **npm 10.9.8**. Use Node 22 or newer.

```bash
git clone git@github.com:aravinds-kannappan/PodcastAI.git
cd PodcastAI
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127). Drop a PDF or click **Load sample stack**, then **Make episode**, then play.

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

Optional: regenerate the bundled sample PDF.

```bash
npm run makeSamplePdf
```

## How the loop works without an API

1. **ExtractedPaper** — sections and source sentences from the file.
2. **PaperModel** — scored claims turned into gists, with the original sentence kept only as evidence.
3. **EpisodePlan** — beats (cold open, setup, claims, methods, caveats, takeaways) that point at claim ids.
4. **Script** — Maya asks; Jordan answers from the gist, not from the page.
5. **Critique** — flags ungrounded lines, missing limitations, and 12-word source copies.
6. **Benchmark** — coverage, grounding, extractive leak, host balance.

Playback uses `window.speechSynthesis`. If your browser has no English voices, install one at the OS level or switch to Chrome.

## Limits

- Scanned PDFs with no text layer cannot be read. Export a text PDF.
- Voices are whatever the browser offers. They will not match a commercial studio.
- The rule writer is dry on purpose. Ollama can color the dialogue locally; it still has to survive critique.
- This is a first pass through a paper, not a substitute for reading one you have to review.

## License

MIT. Sample documents in `public/samples` are original synthetic text written for this project.
