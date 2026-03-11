import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Simple toggle: dark ↔ light. Batcave always exits to dark (its base).
  const handleToggle = () => {
    if (theme === "dark" || theme === "batcave" || theme === undefined) {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const isDark = theme === "dark" || theme === "batcave" || theme === undefined;

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={handleToggle}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};
