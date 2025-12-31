import { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KitcasterLogo } from "@/components/KitcasterLogo";

interface SlideContainerProps {
  children: ReactNode;
  scrollable?: boolean;
  showBranding?: boolean;
}

export const SlideContainer = ({ children, scrollable = false, showBranding = true }: SlideContainerProps) => {
  const brandingElement = showBranding && (
    <div className="absolute bottom-4 left-6 z-10 opacity-60 hover:opacity-100 transition-opacity">
      <KitcasterLogo className="h-6 w-auto" />
    </div>
  );

  if (scrollable) {
    return (
      <div className="relative h-full w-full">
        <ScrollArea className="h-full w-full">
          <div className="px-8 py-6 md:px-16 md:py-10">
            <div className="max-w-5xl w-full mx-auto pb-24">
              {children}
            </div>
          </div>
        </ScrollArea>
        {brandingElement}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex items-center justify-center p-8 md:p-16">
      <div className="max-w-5xl w-full h-full flex flex-col items-center justify-center">
        {children}
      </div>
      {brandingElement}
    </div>
  );
};