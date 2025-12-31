import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "[&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0",
        "[&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-4",
        "[&>ol]:my-2 [&>ol]:list-decimal [&>ol]:pl-4",
        "[&_li]:my-1",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
