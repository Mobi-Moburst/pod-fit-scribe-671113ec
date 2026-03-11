import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { ReactNode, useEffect } from "react";

function BatcaveClassSync() {
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "batcave") {
      root.classList.add("batcave");
    } else {
      root.classList.remove("batcave");
    }
  }, [theme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      themes={["light", "dark", "batcave"]}
    >
      <BatcaveClassSync />
      {children}
    </NextThemeProvider>
  );
}
