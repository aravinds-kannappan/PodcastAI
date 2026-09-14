import type { PodcastScript } from "@/lib/types";
import type { AudioOutput, TTSProvider } from "./types";

export class BrowserSpeechProvider implements TTSProvider {
  id = "browser-speech";
  label = "Browser SpeechSynthesis";

  async available(): Promise<boolean> {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  async synthesize(script: PodcastScript): Promise<AudioOutput> {
    const ok = await this.available();
    if (!ok) {
      return {
        kind: "unavailable",
        note: "This browser has no Web Speech API. Try Chrome or Edge.",
      };
    }
    return {
      kind: "browser-speech",
      note: `Ready to speak ${script.lines.length} lines with system voices. No TTS vendor, no key.`,
    };
  }
}

export const browserSpeechProvider = new BrowserSpeechProvider();
