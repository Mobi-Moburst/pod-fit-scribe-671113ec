import { format } from "date-fns";
import { MinimalClient } from "@/types/clients";
import kitcasterLogo from "@/assets/kitcaster-logo.png";

interface ReportHeaderProps {
  client: MinimalClient;
  generated_at: string;
  batch_name: string;
}

export const ReportHeader = ({ client, generated_at, batch_name }: ReportHeaderProps) => {
  const clientPrimaryColor = client.brand_colors?.primary;
  
  return (
    <div className="space-y-4">
      {/* Co-branded Logo Bar */}
      <div className="flex items-center justify-between">
        {/* Moburst/Kitcaster Logo */}
        <div className="flex items-center gap-3">
          <img 
            src={kitcasterLogo} 
            alt="Kitcaster" 
            className="h-10 w-auto object-contain"
          />
        </div>
        
        {/* Client Logo */}
        {client.logo_url && (
          <div className="flex items-center gap-3">
            <div 
              className="h-12 px-3 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: clientPrimaryColor ? `${clientPrimaryColor}15` : 'hsl(var(--muted))'
              }}
            >
              <img 
                src={client.logo_url} 
                alt={client.company || client.name} 
                className="h-8 w-auto max-w-[150px] object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Accent Line with Client Brand Color */}
      {clientPrimaryColor && (
        <div 
          className="h-1 w-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${clientPrimaryColor}, ${clientPrimaryColor}40)` }}
        />
      )}

      {/* Report Title and Metadata */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Podcast Campaign Report</h1>
        <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
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
    </div>
  );
};
