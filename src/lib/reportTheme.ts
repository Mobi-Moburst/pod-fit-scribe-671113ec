export interface ReportTheme {
  primary: string;
  secondary: string;
  accent: string;
  font: string;
  logo?: string;
}

export const defaultTheme: ReportTheme = {
  primary: "#9b87f5",
  secondary: "#7E69AB",
  accent: "#6E59A5",
  font: "Inter, sans-serif"
};

export function applyReportTheme(theme: ReportTheme) {
  // Generate CSS variables for report theming
  const root = document.documentElement;
  root.style.setProperty('--report-primary', theme.primary);
  root.style.setProperty('--report-secondary', theme.secondary);
  root.style.setProperty('--report-accent', theme.accent);
  root.style.setProperty('--report-font', theme.font);
  
  return {
    chartColors: {
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444'
    }
  };
}

export function scoreToColor(score: number): string {
  if (score < 4.5) return '#ef4444'; // red
  if (score < 6.5) return '#f59e0b'; // amber
  if (score < 7.5) return '#eab308'; // yellow
  if (score < 9) return '#10b981'; // green
  return '#059669'; // emerald
}
