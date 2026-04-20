import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableNumberProps {
  value: number;
  onSave: (next: number) => void;
  /** Called when edit mode is entered/exited (useful to suppress parent onClick) */
  onEditingChange?: (editing: boolean) => void;
  /** Display formatter, e.g. n => n.toLocaleString() */
  format?: (n: number) => string;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
  min?: number;
  ariaLabel?: string;
  /** When false, renders just the formatted value with no edit affordance */
  editable?: boolean;
}

/**
 * Inline-editable number with a pencil that appears on hover.
 * Click pencil → input becomes editable. Enter or check icon to save, Escape or X to cancel.
 */
export function EditableNumber({
  value,
  onSave,
  onEditingChange,
  format = (n) => n.toLocaleString(),
  className,
  inputClassName,
  iconClassName,
  min = 0,
  ariaLabel = "Edit value",
  editable = true,
}: EditableNumberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value ?? 0));
  }, [value, editing]);

  useEffect(() => {
    onEditingChange?.(editing);
    if (editing) {
      // Focus & select on next tick
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing, onEditingChange]);

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const commit = () => {
    const parsed = Math.max(min, Math.round(parseFloat(draft.replace(/,/g, "")) || 0));
    if (parsed !== value) onSave(parsed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value ?? 0));
    setEditing(false);
  };

  if (!editable) {
    return <span className={className}>{format(value)}</span>;
  }

  if (editing) {
    return (
      <span
        className={cn("inline-flex items-center gap-1", className)}
        onClick={stop}
        onMouseDown={stop}
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={draft}
          min={min}
          onChange={(e) => setDraft(e.target.value)}
          onClick={stop}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={cn(
            "w-32 rounded-md border border-input bg-background px-2 py-1 text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring",
            inputClassName
          )}
          aria-label={ariaLabel}
        />
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            commit();
          }}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            cancel();
          }}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <span className={cn("group/edit inline-flex items-center gap-1.5", className)}>
      <span>{format(value)}</span>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setEditing(true);
        }}
        className={cn(
          "opacity-0 group-hover/edit:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground print:hidden",
          iconClassName
        )}
        title="Edit value"
        aria-label={ariaLabel}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
