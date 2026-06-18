import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { LogOut, Settings } from "lucide-react";

const baseTabs = [
  { to: "/overview", label: "Overview" },
  { to: "/companies", label: "Companies" },
  { to: "/research", label: "Research", flag: "research_tab" as const },
  { to: "/reports", label: "Reports" },
  { to: "/studio", label: "Studio" },
];

const researchRoutes = ["/", "/batch", "/history", "/research"];

export const Navbar = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { enabled: researchEnabled } = useFeatureFlag("research_tab");
  const tabs = baseTabs.filter((t) => {
    if (t.flag === "research_tab") return isAdmin || researchEnabled;
    return true;
  });

  return (
    <header className="sticky top-0 z-40 h-[64px] bg-[rgba(11,12,16,0.5)] backdrop-blur-[60px] border-b border-[rgba(255,255,255,0.06)]">
      <div className="container mx-auto flex items-center justify-between h-full px-4">
        <Link to="/" className="flex items-center gap-3">
          <KitcasterLogo className="h-10 w-auto" />
          <span className="font-bold tracking-[-0.5px] text-white hidden md:inline">
            Kitcaster Campaign Command Center
          </span>
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
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-[12px] text-[14px] tracking-[-0.5px]",
                    isActive && "nav-active text-white"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {t.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <Link to="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-[40px] w-[40px] text-[#9ca3af] hover:text-white",
                    (pathname === "/settings" || pathname.startsWith("/settings/")) && "nav-active text-white"
                  )}
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="rounded-full h-[40px] w-[40px] text-[#9ca3af] hover:text-white"
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
