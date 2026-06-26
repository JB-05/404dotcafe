"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closeCafe, fetchCafeSessions, fetchCafeStats, fetchCafeStatus, openCafe } from "@/lib/api";

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CafeControl() {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["cafe-status"],
    queryFn: fetchCafeStatus,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["cafe-stats"],
    queryFn: fetchCafeStats,
    refetchInterval: 60000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["cafe-sessions"],
    queryFn: () => fetchCafeSessions(10),
  });

  const open = useMutation({
    mutationFn: openCafe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe-status"] });
      queryClient.invalidateQueries({ queryKey: ["cafe-stats"] });
      queryClient.invalidateQueries({ queryKey: ["cafe-sessions"] });
    },
  });

  const close = useMutation({
    mutationFn: closeCafe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe-status"] });
      queryClient.invalidateQueries({ queryKey: ["cafe-stats"] });
      queryClient.invalidateQueries({ queryKey: ["cafe-sessions"] });
    },
  });

  const isOpen = status?.is_open ?? false;
  const busy = open.isPending || close.isPending;

  return (
    <div className="admin-card border-l-4 border-l-blue-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-card-title">Cafe operations</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-slate-400"}`}
            />
            <p className="text-lg font-semibold">{isOpen ? "Open — accepting orders" : "Closed"}</p>
          </div>
          {isOpen && status?.current_session_seconds != null && (
            <p className="text-sm admin-muted mt-1">
              Current session: {fmtDuration(status.current_session_seconds)}
            </p>
          )}
          {stats && (
            <p className="text-xs admin-muted mt-2">
              {stats.days_active} days active · {stats.total_open_hours}h total open · {stats.total_sessions}{" "}
              sessions
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isOpen ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => open.mutate()}
              className="admin-btn admin-btn-primary"
            >
              {open.isPending ? "Opening…" : "Open cafe"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => close.mutate()}
              className="admin-btn border-red-300 text-red-700 hover:bg-red-50"
            >
              {close.isPending ? "Closing…" : "Close cafe"}
            </button>
          )}
        </div>
      </div>
      {(open.error || close.error) && (
        <p className="text-sm text-red-600 mt-2">{(open.error ?? close.error)?.message}</p>
      )}
      {!isOpen && (
        <p className="text-sm admin-muted mt-3">
          Orders are blocked until you open the cafe. Staff POS and customer checkout will stay disabled.
        </p>
      )}

      {sessions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-xs font-medium admin-muted mb-2">Recent sessions</p>
          <ul className="space-y-1 text-xs">
            {sessions.slice(0, 5).map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>
                  {new Date(s.opened_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {s.is_active && " · active"}
                </span>
                <span className="admin-muted">{fmtDuration(s.duration_seconds)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
