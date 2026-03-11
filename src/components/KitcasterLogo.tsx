import { useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import darkLogo from "@/assets/kitcaster-logo.png";
import lightLogo from "@/assets/kitcaster-logo-light.png";
import batcaveLogo from "@/assets/kitcaster-batcave-logo.png";

interface KitcasterLogoProps {
  className?: string;
}

export const KitcasterLogo = ({ className = "h-8 w-auto" }: KitcasterLogoProps) => {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 5) {
      // Prevent navigation when activating easter egg
      e.preventDefault();
      e.stopPropagation();
      clickCountRef.current = 0;
      setTheme(theme === "batcave" ? "dark" : "batcave");
      return;
    }

    // Reset count after 2s of inactivity
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);
  }, [theme, setTheme]);

  let logoSrc: string;
  if (theme === "batcave") {
    logoSrc = batcaveLogo;
  } else {
    logoSrc = resolvedTheme === "dark" ? lightLogo : darkLogo;
  }

  return (
    <img
      src={logoSrc}
      alt="Kitcaster by Moburst"
      className={`object-contain cursor-pointer ${className}`}
      onClick={handleClick}
    />
  );
};
