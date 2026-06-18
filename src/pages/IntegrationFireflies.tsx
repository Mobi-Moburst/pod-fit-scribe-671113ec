import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plug,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";

interface FirefliesConnection {
  id: string;
  user_id: string;
  fireflies_email: string | null;
  fireflies_name: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
}

interface ManagedUser {
  id: string;
  email: string;
  role: "admin" | "user" | "viewer";
}

export default function IntegrationFireflies() {
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [myConnection, setMyConnection] = useState<FirefliesConnection | null>(null);
  const [isLoadingMine, setIsLoadingMine] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [allConnections, setAllConnections] = useState<FirefliesConnection[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  useEffect(() => {
    document.title = "Fireflies — Integrations";
  }, []);

  const loadMyConnection = async () => {
    if (!user) return;
    setIsLoadingMine(true);
    const { data, error } = await supabase
      .from("fireflies_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) console.error(error);
    else setMyConnection(data as FirefliesConnection | null);
    setIsLoadingMine(false);
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setIsLoadingAdmin(true);
    try {
      const [connsRes, usersRes] = await Promise.all([
        supabase.from("fireflies_connections").select("*"),
        supabase.functions.invoke("manage-users", { body: { action: "list" } }),
      ]);
      if (connsRes.error) throw connsRes.error;
      if (usersRes.error) throw new Error(usersRes.error.message);
      setAllConnections((connsRes.data || []) as FirefliesConnection[]);
      setAllUsers(usersRes.data?.users || []);
    } catch (err: any) {
      toast({ title: "Error loading admin data", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingAdmin(false);
    }
  };

  useEffect(() => { if (user) loadMyConnection(); }, [user]);
  useEffect(() => { if (isAdmin) loadAdminData(); }, [isAdmin]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyInput.trim().length < 10) {
      toast({ title: "Invalid key", description: "API key looks too short.", variant: "destructive" });
      return;
    }
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-fireflies", {
        body: { api_key: apiKeyInput.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Fireflies connected",
        description: `Linked to ${data.fireflies_email || "your account"}. Initial sync started.`,
      });
      setApiKeyInput("");
      setShowConnectDialog(false);
      await loadMyConnection();
      if (isAdmin) loadAdminData();
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncNow = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-fireflies-meetings", {
        body: { user_id: user.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const result = data?.results?.[0];
      toast({ title: "Sync complete", description: `Imported ${result?.imported ?? 0} new meeting(s).` });
      await loadMyConnection();
      if (isAdmin) loadAdminData();
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("disconnect-fireflies", { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Disconnected" });
      setMyConnection(null);
      if (isAdmin) loadAdminData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const adminRows = allUsers.map((u) => ({ user: u, conn: allConnections.find((c) => c.user_id === u.id) }));

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Fireflies Notetaker</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect your personal Fireflies account so your meeting notes flow into the Command Center.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Your connection
            </CardTitle>
            <CardDescription>Only your meetings are pulled — your key, your data.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMine ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : myConnection ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-md border border-[rgba(255,255,255,0.05)] bg-muted/30">
                  <CheckCircle2 className="h-5 w-5 text-[#10b981] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      Connected as {myConnection.fireflies_name || myConnection.fireflies_email || "Unknown"}
                    </div>
                    {myConnection.fireflies_email && (
                      <div className="text-xs text-muted-foreground">{myConnection.fireflies_email}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Last sync:{" "}
                      {myConnection.last_synced_at
                        ? new Date(myConnection.last_synced_at).toLocaleString()
                        : "never"}
                    </div>
                    {myConnection.last_sync_status === "error" && myConnection.last_sync_error && (
                      <div className="text-xs text-destructive mt-2 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="break-words">{myConnection.last_sync_error}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSyncNow} disabled={isSyncing} variant="outline" size="sm">
                    {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync now
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Fireflies?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your API key will be removed. Already-synced meeting notes stay put. You can reconnect any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnect}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-md border border-dashed border-[rgba(255,255,255,0.05)]">
                  <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Not connected</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Generate an API key in Fireflies, then paste it here.
                    </div>
                  </div>
                </div>
                <Button onClick={() => setShowConnectDialog(true)} size="sm">
                  <Plug className="h-4 w-4 mr-2" />
                  Connect Fireflies
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle>Team Fireflies Status</CardTitle>
                <CardDescription>
                  Who on the team has connected Fireflies and when each account last synced.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAdmin ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team member</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fireflies account</TableHead>
                        <TableHead>Last sync</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminRows.map(({ user: u, conn }) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-sm">{u.email}</TableCell>
                          <TableCell>
                            {conn ? (
                              conn.last_sync_status === "error" ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Error
                                </Badge>
                              ) : (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Connected
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{conn?.fireflies_email || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {conn?.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-destructive max-w-xs truncate">
                            {conn?.last_sync_error || ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Fireflies</DialogTitle>
              <DialogDescription>
                Paste your personal Fireflies API key. We'll validate it and start pulling the last 30 days of your meetings.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ff-key">API key</Label>
                <Input
                  id="ff-key"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="ff_xxxxxxxxxxxxxxxx"
                  maxLength={500}
                  required
                  autoFocus
                />
                <a
                  href="https://app.fireflies.ai/integrations/custom/fireflies"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Get your API key from Fireflies
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setShowConnectDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={isConnecting}>
                  {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Connect
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
