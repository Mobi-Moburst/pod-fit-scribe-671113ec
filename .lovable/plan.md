
# Make Call Notes Summary Scrollable

## Change
In `src/components/call-notes/CallNotesList.tsx`, wrap the summary text in a scrollable container with a max height, and use the `MarkdownRenderer` component (already exists at `src/components/ui/markdown-renderer.tsx`) since Fathom summaries come in markdown format.

## Technical Details

**File: `src/components/call-notes/CallNotesList.tsx`**

1. Import `MarkdownRenderer` from `@/components/ui/markdown-renderer`
2. Replace the summary `<p>` tag (~line 112) with a scrollable div + MarkdownRenderer:

```tsx
<div className="max-h-48 overflow-y-auto rounded border border-border/20 p-2">
  <MarkdownRenderer content={note.summary} className="text-sm" />
</div>
```

This gives the summary a `max-h-48` (192px) cap with vertical scrolling, proper markdown rendering, and a subtle border to indicate the scrollable area.
