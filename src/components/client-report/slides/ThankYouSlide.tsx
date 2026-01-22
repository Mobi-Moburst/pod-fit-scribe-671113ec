import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { MinimalClient } from "@/types/clients";
import { KitcasterLogo } from "@/components/KitcasterLogo";

interface ThankYouSlideProps {
  client: MinimalClient;
}

export const ThankYouSlide = ({ client }: ThankYouSlideProps) => {
  const hasTriggered = useRef(false);
  const [animateShine, setAnimateShine] = useState(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    // Trigger shine animation
    setAnimateShine(true);

    // Fire confetti from both sides
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#3bd4ff', '#ffe43a', '#ff6671', '#ffffff'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#3bd4ff', '#ffe43a', '#ff6671', '#ffffff'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  return (
    <div className="text-center space-y-12 w-full">
      <h2 className="text-5xl md:text-7xl font-bold gradient-text relative inline-block">
        <span className="relative">
          Thank You
          {animateShine && (
            <span 
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'text-shine 1.5s ease-out forwards',
                mixBlendMode: 'overlay',
              }}
            />
          )}
        </span>
      </h2>
      
      <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
        We look forward to continuing our partnership and achieving even greater podcast visibility for {client.company || client.name}.
      </p>

      <div className="pt-12 flex items-center justify-center gap-3">
        <span className="text-muted-foreground">Powered by</span>
        <KitcasterLogo className="h-8 w-auto" />
      </div>

      <style>{`
        @keyframes text-shine {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
};