import { MinimalClient } from "@/types/clients";
import kitcasterLogo from "@/assets/kitcaster-logo.png";

interface TitleSlideProps {
  client: MinimalClient;
  reportName: string;
  quarter?: string;
}

export const TitleSlide = ({ client, reportName, quarter }: TitleSlideProps) => {
  const clientPrimaryColor = client.brand_colors?.primary;

  return (
    <div className="text-center space-y-12 w-full">
      {/* Logos */}
      <div className="flex items-center justify-center gap-8">
        <img 
          src={kitcasterLogo} 
          alt="Kitcaster" 
          className="h-14 w-auto object-contain"
        />
        {client.logo_url && (
          <>
            <div className="h-8 w-px bg-border" />
            <img 
              src={client.logo_url} 
              alt={client.company || client.name}
              className="h-14 w-auto max-w-[200px] object-contain"
            />
          </>
        )}
      </div>

      {/* Accent line */}
      <div 
        className="h-1 w-32 mx-auto rounded-full"
        style={{ 
          background: clientPrimaryColor 
            ? `linear-gradient(90deg, ${clientPrimaryColor}, ${clientPrimaryColor}40)` 
            : 'hsl(var(--primary))' 
        }}
      />

      {/* Title */}
      <div className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Podcast Campaign Report
        </h1>
        <p className="text-2xl md:text-3xl text-muted-foreground">
          {client.company || client.name}
          {quarter && ` • ${quarter}`}
        </p>
      </div>
    </div>
  );
};