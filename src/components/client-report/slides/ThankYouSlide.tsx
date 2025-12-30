import { MinimalClient } from "@/types/clients";
import kitcasterLogo from "@/assets/kitcaster-logo.png";

interface ThankYouSlideProps {
  client: MinimalClient;
}

export const ThankYouSlide = ({ client }: ThankYouSlideProps) => {
  return (
    <div className="text-center space-y-12 w-full">
      <h2 className="text-5xl md:text-7xl font-bold gradient-text">
        Thank You
      </h2>
      
      <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
        We look forward to continuing our partnership and achieving even greater podcast visibility for {client.company || client.name}.
      </p>

      <div className="pt-12 flex items-center justify-center gap-3">
        <span className="text-muted-foreground">Powered by</span>
        <img 
          src={kitcasterLogo} 
          alt="Kitcaster" 
          className="h-8 w-auto object-contain"
        />
      </div>
    </div>
  );
};