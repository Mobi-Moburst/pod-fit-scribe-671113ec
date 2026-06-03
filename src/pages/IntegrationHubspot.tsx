import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { HubspotSettingsCard } from "@/components/settings/HubspotSettingsCard";
import { useEffect } from "react";

export default function IntegrationHubspot() {
  const { isAdmin, isLoading } = useUserRole();

  useEffect(() => {
    document.title = "HubSpot — Integrations";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto py-8 px-4 space-y-6 relative z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings/integrations">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Integrations
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HubSpot</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pipeline mapping, ticket sync, and historical backfill.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isAdmin ? (
          <HubspotSettingsCard />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" /> Admin only
              </CardTitle>
              <CardDescription>HubSpot configuration is restricted to admins.</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        )}
      </main>
    </div>
  );
}
