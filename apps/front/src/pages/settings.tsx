import { useQueryClient } from "@tanstack/react-query";
import { Monitor, Smartphone, Tablet, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamSection } from "@/components/team/team-section";
import { useSessions } from "@/hooks/queries/use-sessions";
import { revokeSession } from "@/lib/auth";

function getDeviceIcon(deviceInfo: string): React.ReactNode {
  const lower = deviceInfo.toLowerCase();
  if (
    lower.includes("mobile") ||
    lower.includes("android") ||
    lower.includes("iphone")
  ) {
    return <Smartphone className="size-4" />;
  }
  if (lower.includes("tablet") || lower.includes("ipad")) {
    return <Tablet className="size-4" />;
  }
  return <Monitor className="size-4" />;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SettingsPage() {
  const { data: sessions = [], isLoading } = useSessions();
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await revokeSession(sessionId);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      console.error("[Settings] Failed to revoke session", error);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-lg">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account and active sessions.
        </p>
      </div>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <TeamSection />

      {/* ── Sessions ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Devices and browsers where you are currently logged in.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && sessions.length === 0 && (
            <p className="py-4 text-center text-muted-foreground text-sm">
              No active sessions found.
            </p>
          )}

          {!isLoading && sessions.length > 0 && (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {getDeviceIcon(session.deviceInfo)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-sm">
                        {session.userName}
                      </p>
                      {session.isCurrent && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="truncate text-muted-foreground text-xs">
                      {session.deviceInfo} &middot; {session.ipAddress} &middot;{" "}
                      {formatDate(session.lastActiveAt)}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRevoke(session.sessionId)}
                      disabled={revokingId === session.sessionId}
                      title="Revoke session"
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardPanel>
      </Card>
    </div>
  );
}
