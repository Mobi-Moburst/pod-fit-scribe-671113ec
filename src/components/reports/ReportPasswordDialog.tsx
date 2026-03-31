import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

interface ReportPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
  title?: string;
  description?: string;
  currentHasPassword?: boolean;
}

export function ReportPasswordDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Set Report Password",
  description = "Clients will need this password to view the published report.",
  currentHasPassword = false,
}: ReportPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(password);
      setPassword("");
      setConfirmPw("");
      onOpenChange(false);
    } catch {
      setError("Failed to set password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePassword = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(""); // empty string = remove password
      setPassword("");
      setConfirmPw("");
      onOpenChange(false);
    } catch {
      setError("Failed to remove password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="report-pw">Password</Label>
            <div className="relative">
              <Input
                id="report-pw"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a password for this report"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-pw-confirm">Confirm Password</Label>
            <Input
              id="report-pw-confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex gap-2 sm:gap-0">
          {currentHasPassword && (
            <Button
              variant="outline"
              onClick={handleRemovePassword}
              disabled={isSubmitting}
              className="text-destructive"
            >
              Remove Password
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {currentHasPassword ? "Update Password" : "Set Password & Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
