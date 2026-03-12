import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

export const SlideNavigation = ({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  onExit,
}: SlideNavigationProps) => {
  return (
    <>
      {/* Top-right controls */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={onExit}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation arrows */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrev}
          disabled={currentSlide === 0}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-full border border-border">
          <span className="text-sm font-medium">{currentSlide + 1}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">{totalSlides}</span>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={currentSlide === totalSlides - 1}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>
    </>
  );
};