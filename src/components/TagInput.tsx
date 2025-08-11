import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  label?: string;
}

export function TagInput({ value, onChange, placeholder, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");

  const add = (t: string) => {
    const v = norm(t);
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...(value || []), v]);
    setDraft("");
    inputRef.current?.focus();
  };
  const remove = (t: string) => onChange((value || []).filter((x) => x !== t));

  const visibleSuggestions = useMemo(() => {
    const q = draft.toLowerCase();
    if (!q) return suggestions.slice(0, 6);
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 6);
  }, [draft, suggestions]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 items-center rounded-md border bg-background px-2 py-2">
        {(value || []).map((t) => (
          <Badge key={t} variant="secondary" className="flex items-center gap-1">
            {t}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => remove(t)}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none h-8 px-1 min-w-[140px]"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value?.length) {
              remove(value[value.length - 1]);
            }
          }}
        />
      </div>
      {!!visibleSuggestions.length && (
        <div className="mt-1 rounded-md border bg-card text-sm shadow-sm">
          <div className="max-h-40 overflow-auto py-1">
            {visibleSuggestions.map((s) => (
              <button
                type="button"
                key={s}
                className="w-full text-left px-2 py-1.5 hover:bg-muted"
                onClick={() => add(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
