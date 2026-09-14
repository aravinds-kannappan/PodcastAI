# PaperCast

Turn a paper, memo, or notes file into a two host podcast in the browser. No Speechify account, no OpenAI key, no cloud TTS.

PaperCast extracts text locally, writes a Maya and Jordan conversation from the important sentences in the document, and reads it with the **Web Speech API** that already ships in Chrome and Edge.

## What it does

- Upload PDF, Markdown, TXT, HTML, RTF, or DOCX (plus CSV and TeX).
- Extract text in the browser (`pdf.js` for PDFs, Mammoth for Word).
- Build an extractive two host script. Hosts quote and rephrase the page instead of calling an LLM.
- Play the episode with system voices. Pause, skip lines, change speed, download the script.
- Sample stack included: a synthetic research PDF plus two shorter notes files.

Nothing leaves your machine except optional sample fetches from this same app. There is no auth, no database, and no paid API.

## Run it

Verified on this machine with **Node v22.23.2** and **npm 10.9.8**. Use Node 22 or newer.

No environment variables and no `.env` file. The app is fully local.

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
npm run lint
npm run typecheck
```

Optional: regenerate the bundled sample PDF.

```bash
npm run makeSamplePdf
```

## How it works without an API

The script generator scores sentences (abstracts, findings, numbers, hedges), drops near duplicates, and fills host templates. Maya asks; Jordan answers from the text. It will sound like a tight reading of the document, not like a hired comedy duo. That is the point of a free local booth.

Playback uses `window.speechSynthesis`. If your browser has no English voices, install one at the OS level or switch to Chrome.

## Limits

- Scanned PDFs with no text layer cannot be read. Export a text PDF.
- Voices are whatever the browser offers. They will not match a commercial studio.
- Extractive dialogue can miss structure that a large model would invent. It also will not invent citations, which is safer.

## License

MIT. Sample documents in `public/samples` are original synthetic text written for this project.
