import { format } from "date-fns";
import { MinimalClient } from "@/types/clients";

interface ReportHeaderProps {
  client: MinimalClient;
  generated_at: string;
  batch_name: string;
}

export const ReportHeader = ({ client, generated_at, batch_name }: ReportHeaderProps) => {
  return (
    <div className="space-y-2">
      <h1 className="text-4xl font-bold">Podcast Campaign Report</h1>
      <div className="flex items-center gap-4 text-muted-foreground">
        <div>
          <span className="font-medium">Client:</span> {client.name}
          {client.company && ` - ${client.company}`}
        </div>
        <div className="text-muted-foreground">•</div>
        <div>
          <span className="font-medium">Generated:</span>{' '}
          {format(new Date(generated_at), 'MMM d, yyyy')}
        </div>
        <div className="text-muted-foreground">•</div>
        <div>
          <span className="font-medium">Report:</span> {batch_name}
        </div>
      </div>
    </div>
  );
};
