import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ReportPasswordGateProps {
  slug: string;
  onAuthenticated: () => void;
}

export function ReportPasswordGate({ slug, onAuthenticated }: ReportPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError("");
    setIsSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-report-password", {
        body: { slug, password: password.trim() },
      });

      if (fnError || !data?.success) {
        setError("Incorrect password. Please try again.");
      } else {
        // Store auth in sessionStorage so refreshes don't re-prompt
        sessionStorage.setItem(`report-auth-${slug}`, "true");
        onAuthenticated();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative p-4">
      <BackgroundFX />
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <KitcasterLogo className="h-10 w-auto" />
          </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Lock className="h-5 w-5" />
            Protected Report
          </CardTitle>
          <CardDescription>
            Enter the password provided by your campaign manager to view this report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter report password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              View Report
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
