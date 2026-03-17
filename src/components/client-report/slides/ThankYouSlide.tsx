import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { MinimalClient } from "@/types/clients";
import { KitcasterLogo } from "@/components/KitcasterLogo";

interface ThankYouSlideProps {
  client: MinimalClient;
}

export const ThankYouSlide = ({ client }: ThankYouSlideProps) => {
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    // Fire confetti from both sides
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

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
        <KitcasterLogo className="h-8 w-auto" />
      </div>
    </div>
  );
};