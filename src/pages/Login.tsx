import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Loader2, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { user, isLoading, signIn, resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Enter your email", description: "We'll send a password reset link.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await resetPassword(email.trim());
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "A password reset link has been sent." });
      setIsForgotPassword(false);
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
          <CardTitle className="text-2xl">
            {isForgotPassword ? "Reset Password" : "Campaign Command Center"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Enter your email and we'll send you a reset link."
              : "Sign in to manage campaigns and reports."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@kitcaster.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isForgotPassword ? "Send Reset Link" : "Sign In"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsForgotPassword(!isForgotPassword)}
            >
              {isForgotPassword ? "Back to login" : "Forgot password?"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
