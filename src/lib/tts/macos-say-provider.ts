import type { TTSProvider } from "./types";

/** Stub: macOS `say` for later. Not required to run PaperCast. */
export class MacOSSayProvider implements TTSProvider {
  id = "macos-say";
  label = "macOS say (planned)";

  async available(): Promise<boolean> {
    // Detection-only stub. Wiring `say` is future work.
    return false;
  }
}
