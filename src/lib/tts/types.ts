import type { PodcastScript } from "@/lib/types";

export type AudioOutput = {
  kind: "browser-speech" | "file" | "unavailable";
  note: string;
  mimeType?: string;
  bytes?: Uint8Array;
};

export interface TTSProvider {
  id: string;
  label: string;
  available(): Promise<boolean>;
  synthesize?(script: PodcastScript): Promise<AudioOutput>;
}
