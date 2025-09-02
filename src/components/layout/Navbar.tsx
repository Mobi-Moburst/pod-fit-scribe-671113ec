import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Evaluate" },
  { to: "/batch", label: "Batch" },
  { to: "/clients", label: "Clients" },
  { to: "/history", label: "History" },
  { to: "/prep-sheet", label: "Prep Sheet" },
];

export const Navbar = () => {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-14 px-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-tr from-primary to-accent" aria-hidden />
          <span className="font-semibold">Podcast Fit Rater</span>
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className="hidden sm:block">
              <Button
                variant={pathname === t.to ? "soft" : "ghost"}
                size="sm"
                className={cn("rounded-full", pathname === t.to && "border")}
                aria-current={pathname === t.to ? "page" : undefined}
              >
                {t.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
