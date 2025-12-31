import { KitcasterLogo } from "@/components/KitcasterLogo";

export const ClientReportFooter = () => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">Powered by</span>
        <KitcasterLogo className="h-6 w-auto opacity-70" />
      </div>
    </footer>
  );
};