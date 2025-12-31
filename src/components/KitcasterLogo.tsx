import { useTheme } from "next-themes";
import darkLogo from "@/assets/kitcaster-logo.png";
import lightLogo from "@/assets/kitcaster-logo-light.png";

interface KitcasterLogoProps {
  className?: string;
}

export const KitcasterLogo = ({ className = "h-8 w-auto" }: KitcasterLogoProps) => {
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? lightLogo : darkLogo;
  
  return (
    <img 
      src={logoSrc} 
      alt="Kitcaster by Moburst" 
      className={`object-contain ${className}`}
    />
  );
};
