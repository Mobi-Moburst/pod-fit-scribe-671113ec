import { useState } from "react";
import { Lightbulb, ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/utils";

interface ExpandableTalkingPointProps {
  title: string;
  description: string;
}

const CHAR_LIMIT = 150;

export const ExpandableTalkingPoint = ({ title, description }: ExpandableTalkingPointProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsExpansion = description.length > CHAR_LIMIT;

  const displayText = needsExpansion && !isExpanded
    ? description.slice(0, CHAR_LIMIT).replace(/\s+\S*$/, '') + '…'
    : description;

  return (
    <div 
      className={cn(
        "group bg-card border border-border hover:border-accent/30 rounded-lg p-3 transition-all duration-300",
        needsExpansion && "cursor-pointer"
      )}
      onClick={() => needsExpansion && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-2">
        <div className="p-1.5 bg-accent/10 rounded-md mt-0.5 shrink-0">
          <Lightbulb className="h-3.5 w-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-0.5">{title}</h4>
          <MarkdownRenderer 
            content={displayText} 
            className="text-xs text-muted-foreground leading-snug" 
          />
          {needsExpansion && (
            <button 
              className="flex items-center gap-1 text-xs text-accent mt-1 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? 'Show less' : 'Read more'}
              <ChevronDown className={cn(
                "h-3 w-3 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
