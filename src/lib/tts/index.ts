import { BrowserSpeechProvider } from "./browser-provider";
import { CoquiProvider } from "./coqui-provider";
import { MacOSSayProvider } from "./macos-say-provider";
import { PiperProvider } from "./piper-provider";
import type { TTSProvider } from "./types";

export type { AudioOutput, TTSProvider } from "./types";
export { BrowserSpeechProvider } from "./browser-provider";
export { CoquiProvider } from "./coqui-provider";
export { MacOSSayProvider } from "./macos-say-provider";
export { PiperProvider } from "./piper-provider";

export const ttsProviders: TTSProvider[] = [
  new BrowserSpeechProvider(),
  new PiperProvider(),
  new MacOSSayProvider(),
  new CoquiProvider(),
];

export async function detectVoiceProvider(): Promise<TTSProvider> {
  for (const provider of ttsProviders) {
    if (await provider.available()) return provider;
  }
  return ttsProviders[0];
}
