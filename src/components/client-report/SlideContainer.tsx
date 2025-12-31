import { ReactNode } from "react";

interface SlideContainerProps {
  children: ReactNode;
  scrollable?: boolean;
}

export const SlideContainer = ({ children, scrollable = false }: SlideContainerProps) => {
  if (scrollable) {
    return (
      <div className="h-full w-full overflow-y-auto p-8 md:p-16">
        <div className="max-w-5xl w-full mx-auto pb-24">
          {children}
        </div>
      </div>
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