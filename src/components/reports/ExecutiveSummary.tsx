import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface ExecutiveSummaryProps {
  summary: string;
}

export const ExecutiveSummary = ({ summary }: ExecutiveSummaryProps) => {
  if (!summary) return null;

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Executive Summary</h3>
      </div>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {summary.split('\n\n').map((paragraph, idx) => (
          <p key={idx} className="text-foreground mb-3 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </Card>
  );
};
