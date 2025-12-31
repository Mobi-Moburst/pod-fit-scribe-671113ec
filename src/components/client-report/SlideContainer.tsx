import { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SlideContainerProps {
  children: ReactNode;
  scrollable?: boolean;
}

export const SlideContainer = ({ children, scrollable = false }: SlideContainerProps) => {
  if (scrollable) {
    return (
      <ScrollArea className="h-full w-full">
        <div className="px-8 py-6 md:px-16 md:py-10">
          <div className="max-w-5xl w-full mx-auto pb-24">
            {children}
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-8 md:p-16">
      <div className="max-w-5xl w-full h-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};