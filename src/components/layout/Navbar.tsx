import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import kitcasterLogo from "@/assets/kitcaster-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tabs = [
  { to: "/", label: "Evaluate" },
  { to: "/batch", label: "Batch" },
  { to: "/clients", label: "Clients" },
  { to: "/history", label: "History" },
  { to: "/reports", label: "Reports" },
];

export const Navbar = () => {
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    }
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-14 px-3">
        <Link to="/" className="flex items-center gap-2">
          <img 
            src={kitcasterLogo} 
            alt="Kitcaster by Moburst" 
            className="h-8 w-auto"
          />
          <span className="font-semibold">Podcast Qualifying Engine</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <UserIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
