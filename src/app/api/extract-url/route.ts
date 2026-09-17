import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = (await req.json()) as { url: string };
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs are supported" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "PaperCast/1.0 (local podcast tool)",
        Accept: "text/html,text/plain,application/pdf,*/*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch that page (HTTP ${res.status}).` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();

    let title = url;
    let text = raw;

    if (contentType.includes("html")) {
      title =
        raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? url;
      text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, "\n\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 20) {
      return NextResponse.json(
        { error: "That page didn't have enough readable text. Try a different URL." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text, title, wordCount });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "The page took too long to load."
        : err instanceof Error
          ? err.message
          : "Could not fetch that URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
