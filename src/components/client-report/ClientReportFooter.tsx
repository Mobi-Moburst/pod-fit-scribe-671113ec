import kitcasterLogo from "@/assets/kitcaster-logo.png";

export const ClientReportFooter = () => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">Powered by</span>
        <img 
          src={kitcasterLogo} 
          alt="Kitcaster" 
          className="h-6 w-auto object-contain opacity-70"
        />
      </div>
    </footer>
  );
};