"use client";

import { useEffect, useRef } from "react";
import { BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExtractedPaper, ModelClaim } from "@/lib/types";

type Props = {
  papers: ExtractedPaper[];
  claims: ModelClaim[];
  activeClaimId: string | null;
};

function matchScore(paragraph: string, evidence: string): number {
  if (!evidence) return 0;
  const pLower = paragraph.toLowerCase();
  const eLower = evidence.toLowerCase();
  if (pLower.includes(eLower)) return 100;
  const eWords = eLower.split(/\s+/).filter((w) => w.length > 4);
  if (!eWords.length) return 0;
  let hits = 0;
  for (const w of eWords) {
    if (pLower.includes(w)) hits++;
  }
  return (hits / eWords.length) * 100;
}

export function SourceViewer({ papers, claims, activeClaimId }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  const activeClaim = activeClaimId ? claims.find((c) => c.id === activeClaimId) : null;
  const activeEvidence = activeClaim?.evidence ?? "";

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeClaimId]);

  const fullText = papers.map((p) => p.text).join("\n\n");
  const paragraphs = fullText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const scores = paragraphs.map((p) => matchScore(p, activeEvidence));
  const maxScore = Math.max(...scores, 0);
  const threshold = 30;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <BookOpen className="size-4 text-primary" />
        <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Source document
        </p>
        {activeClaim && (
          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
            {activeClaim.kind}
          </span>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-4 pb-4">
          {paragraphs.map((para, i) => {
            const isHighlighted =
              activeEvidence.length > 0 && scores[i] >= threshold && scores[i] === maxScore;
            return (
              <div
                key={i}
                ref={isHighlighted ? activeRef : undefined}
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed transition-all duration-500 ${
                  isHighlighted
                    ? "border-l-4 border-orange-400 bg-orange-50 font-medium text-foreground shadow-sm"
                    : "text-muted-foreground/80"
                }`}
              >
                {para}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
