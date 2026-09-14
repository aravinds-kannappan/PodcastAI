import type { TTSProvider } from "./types";

/** Stub: Coqui / local neural TTS for later. Not required to run PaperCast. */
export class CoquiProvider implements TTSProvider {
  id = "coqui";
  label = "Coqui (planned)";

  async available(): Promise<boolean> {
    return false;
  }
}
