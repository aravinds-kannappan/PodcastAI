import type { TTSProvider } from "./types";

/** Stub: Piper neural TTS for later. Not required to run PaperCast. */
export class PiperProvider implements TTSProvider {
  id = "piper";
  label = "Piper (planned)";

  async available(): Promise<boolean> {
    return false;
  }
}
