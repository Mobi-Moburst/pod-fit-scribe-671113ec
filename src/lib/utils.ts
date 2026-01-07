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
