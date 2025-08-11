import { cn } from "@/lib/utils";

export const scoreToColor = (score: number) => {
  if (score < 4.5) return 'from-red-500 to-red-400';
  if (score < 6.5) return 'from-amber-500 to-amber-400';
  if (score < 7.5) return 'from-yellow-500 to-yellow-400';
  if (score < 9) return 'from-green-500 to-green-400';
  return 'from-emerald-500 to-teal-400';
};

export const ScoreBadge = ({ score }: { score: number }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full px-6 py-3 text-2xl font-bold text-background animate-scorepop',
        'bg-gradient-to-tr',
        scoreToColor(score)
      )}
      aria-label={`Overall score ${score}`}
    >
      {score.toFixed(1)}
    </div>
  );
};
