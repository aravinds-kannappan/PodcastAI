export const SAMPLES = [
  {
    path: "/samples/CivicAttention.pdf",
    name: "CivicAttention.pdf",
    type: "application/pdf",
  },
  {
    path: "/samples/SourdoughNotes.md",
    name: "SourdoughNotes.md",
    type: "text/markdown",
  },
  {
    path: "/samples/QuietHourMemo.txt",
    name: "QuietHourMemo.txt",
    type: "text/plain",
  },
] as const;

export async function fetchSampleFiles(): Promise<File[]> {
  const files: File[] = [];
  for (const sample of SAMPLES) {
    const res = await fetch(sample.path);
    if (!res.ok) throw new Error(`Missing sample ${sample.name}`);
    const blob = await res.blob();
    files.push(new File([blob], sample.name, { type: sample.type }));
  }
  return files;
}
