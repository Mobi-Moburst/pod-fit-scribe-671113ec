import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Calculate the next quarter from a quarter string (e.g., "Q4 2025" -> "Q1 2026")
export function getNextQuarter(currentQuarter: string): string {
  const match = currentQuarter.match(/Q(\d)\s*(\d{4})/);
  if (!match) {
    // Default to next quarter from current date
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    const nextQ = currentQ === 4 ? 1 : currentQ + 1;
    const nextYear = currentQ === 4 ? now.getFullYear() + 1 : now.getFullYear();
    return `Q${nextQ} ${nextYear}`;
  }
  
  const quarterNum = parseInt(match[1]);
  const year = parseInt(match[2]);
  
  if (quarterNum === 4) {
    return `Q1 ${year + 1}`;
  }
  return `Q${quarterNum + 1} ${year}`;
}

// Derive the next quarter from a date (typically report end date)
// For example: 2026-01-01 (end of report range) -> Q1 2026
export function getQuarterFromDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${year}`;
}

// Get the quarter following a given date
export function getNextQuarterFromDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  const currentQuarter = Math.floor(month / 3) + 1;
  
  if (currentQuarter === 4) {
    return `Q1 ${year + 1}`;
  }
  return `Q${currentQuarter + 1} ${year}`;
}
