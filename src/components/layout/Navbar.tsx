import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { LogOut, Settings } from "lucide-react";

const baseTabs = [
  { to: "/overview", label: "Overview" },
  { to: "/companies", label: "Companies" },
  { to: "/research", label: "Research", adminOnly: true },
  { to: "/reports", label: "Reports" },
  { to: "/studio", label: "Studio" },
];

const researchRoutes = ["/", "/batch", "/history", "/research"];

export const Navbar = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const tabs = baseTabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-14 px-3">
        <Link to="/" className="flex items-center gap-2">
          <KitcasterLogo className="h-8 w-auto" />
          <span className="font-semibold">Kitcaster Campaign Command Center</span>
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => {
            const isActive =
              t.to === "/research"
                ? researchRoutes.includes(pathname)
                : pathname === t.to || pathname.startsWith(t.to + "/");
            return (
              <Link key={t.to} to={t.to} className="hidden sm:block">
                <Button
                  variant={isActive ? "soft" : "ghost"}
                  size="sm"
                  className={cn("rounded-full", isActive && "border")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {t.label}
                </Button>
              </Link>
            );
          })}
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
