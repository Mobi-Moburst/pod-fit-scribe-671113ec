import { format } from "date-fns";
import { MinimalClient } from "@/types/clients";
import { KitcasterLogo } from "@/components/KitcasterLogo";

interface ClientReportHeaderProps {
  client: MinimalClient;
  reportName: string;
  quarter?: string;
  generatedAt: string;
}

export const ClientReportHeader = ({ client, reportName, quarter, generatedAt }: ClientReportHeaderProps) => {
  const clientPrimaryColor = client.brand_colors?.primary;
  
  return (
    <header className="space-y-6">
      {/* Logo Bar */}
      <div className="flex items-center justify-between">
        <KitcasterLogo className="h-12 w-auto" />
        
        {client.logo_url && (
          <div 
            className="h-14 px-4 rounded-xl flex items-center justify-center"
            style={{ 
              backgroundColor: clientPrimaryColor ? `${clientPrimaryColor}12` : 'hsl(var(--muted))'
            }}
          >
            <img 
              src={client.logo_url} 
              alt={client.company || client.name} 
              className="h-10 w-auto max-w-[180px] object-contain"
            />
          </div>
        )}
      </div>

      {/* Accent Line */}
      <div 
        className="h-1.5 w-full rounded-full"
        style={{ 
          background: clientPrimaryColor 
            ? `linear-gradient(90deg, ${clientPrimaryColor}, ${clientPrimaryColor}30)` 
            : 'hsl(var(--primary))' 
        }}
      />

      {/* Title and Meta */}
      <div className="space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Podcast Campaign Report
        </h1>
        <div className="flex items-center gap-3 text-lg text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">{client.company || client.name}</span>
          {quarter && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{quarter}</span>
            </>
          )}
          <span className="text-muted-foreground/50">•</span>
          <span>{format(new Date(generatedAt), 'MMMM d, yyyy')}</span>
        </div>
      </div>
    </header>
  );
};