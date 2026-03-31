import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Settings } from "lucide-react";

const tabs = [
  { to: "/", label: "Evaluate" },
  { to: "/batch", label: "Batch" },
  { to: "/companies", label: "Companies" },
  { to: "/history", label: "History" },
  { to: "/reports", label: "Reports" },
];

export const Navbar = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-14 px-3">
        <Link to="/" className="flex items-center gap-2">
          <KitcasterLogo className="h-8 w-auto" />
          <span className="font-semibold">Kitcaster Campaign Command Center</span>
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
          {user && (
            <>
              <Link to="/settings">
                <Button
                  variant={pathname === "/settings" ? "soft" : "ghost"}
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground"
                title={`Sign out (${user.email})`}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
