import { MinimalClient } from "@/types/clients";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { Sparkles } from "lucide-react";

interface ThankYouSlideProps {
  client: MinimalClient;
}

export const ThankYouSlide = ({ client }: ThankYouSlideProps) => {
  return (
    <div className="relative text-center w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary orb - cyan */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] animate-thankyou-orb-1"
          style={{ 
            background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
            top: '10%',
            left: '20%',
          }}
        />
        {/* Accent orb - yellow */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-[100px] animate-thankyou-orb-2"
          style={{ 
            background: 'radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)',
            bottom: '10%',
            right: '15%',
          }}
        />
        {/* Secondary orb - mixed */}
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[80px] animate-thankyou-orb-3"
          style={{ 
            background: 'radial-gradient(circle, hsl(var(--primary)) 0%, hsl(var(--accent)) 50%, transparent 70%)',
            top: '50%',
            left: '60%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-12 animate-thankyou-content">
        {/* Sparkle icon */}
        <div className="flex justify-center animate-thankyou-sparkle">
          <div className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        {/* Main heading with animated gradient */}
        <h2 className="text-5xl md:text-7xl font-bold animate-thankyou-heading">
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient-flow bg-clip-text text-transparent">
            Thank You
          </span>
        </h2>
        
        {/* Subtext */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-thankyou-text">
          We look forward to continuing our partnership and achieving even greater podcast visibility for{" "}
          <span className="text-foreground font-medium">{client.company || client.name}</span>.
        </p>

        {/* Powered by */}
        <div className="pt-8 flex items-center justify-center gap-3 animate-thankyou-logo">
          <span className="text-muted-foreground">Powered by</span>
          <KitcasterLogo className="h-8 w-auto" />
        </div>
      </div>

      {/* Subtle particle effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40 animate-thankyou-particle"
            style={{
              left: `${15 + i * 15}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
