"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
                disabled && "opacity-50"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}
