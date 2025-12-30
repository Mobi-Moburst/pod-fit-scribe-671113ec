import { ReactNode } from "react";

interface SlideContainerProps {
  children: ReactNode;
}

export const SlideContainer = ({ children }: SlideContainerProps) => {
  return (
    <div className="h-full w-full flex items-center justify-center p-8 md:p-16">
      <div className="max-w-5xl w-full h-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};