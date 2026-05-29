import { useEffect, useMemo, useState } from "react";
import { api, type AuditLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Eye, History, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
      .map(([key, entryValue]) => `${key.replace(/_/g, " ")}: ${formatValue(entryValue)}`)
      .join("\n") || "—";
  }
  return String(value);
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    try {
      setLogs(await api.auditLogs.list(200));
    } catch (e: any) {
      toast.error(e.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return logs.filter((log) => {
      const createdAt = new Date(log.created_at);
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      if (!q) return true;

      const haystack = [
        log.actor_name,
        log.actor_email,
        log.action,
        formatValue(log.created_value),
        formatValue(log.updated_value),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [actionFilter, fromDate, logs, search, toDate]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, fromDate, search, toDate]);

  const totalPages = Math.max(Math.ceil(filteredLogs.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [currentPage, filteredLogs]);

  return (
    <main className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              {user?.role === "admin" ? "Review all users' recent activities." : "Review your recent activities."}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user, action, values..."
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Created Value</TableHead>
                  <TableHead>Updated Value</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No audit logs yet</TableCell>
                  </TableRow>
                )}
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{log.actor_name || "Admin"}</div>
                      <div className="text-xs text-muted-foreground">{log.actor_email || "—"}</div>
                    </TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground font-sans">{formatValue(log.created_value)}</pre>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground font-sans">{formatValue(log.updated_value)}</pre>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!loading && filteredLogs.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} · {filteredLogs.length} log{filteredLogs.length === 1 ? "" : "s"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AuditLogDetailDrawer log={selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)} />
    </main>
  );
}

function AuditLogDetailDrawer({ log, onOpenChange }: { log: AuditLog | null; onOpenChange: (open: boolean) => void }) {
  const oldValue = log ? preferredValue(log.created_value) : "—";
  const newValue = log ? preferredValue(log.updated_value) : "—";
  const changes = log ? changeSummary(log, oldValue, newValue) : "—";

  return (
    <Sheet open={!!log} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {log && (
          <div className="space-y-5">
            <SheetHeader className="pr-8">
              <SheetTitle className="text-2xl">Audit Log Details</SheetTitle>
              <SheetDescription>Readable activity summary</SheetDescription>
            </SheetHeader>

            <div className="rounded-xl border bg-background p-6 font-mono text-[15px] leading-7 text-foreground shadow-sm">
              <DetailBlock label="Action" value={log.action} />
              <DetailBlock label="Performed By" value={log.actor_name || "—"} />
              <DetailBlock label="Time" value={new Date(log.created_at).toLocaleString()} />
              <DetailBlock label="Changes" value={changes} />
              <DetailBlock label="Old Value" value={oldValue} />
              <DetailBlock label="New Value" value={newValue} last />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBlock({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-6"}>
      <div>{label}:</div>
      <div className="whitespace-pre-wrap text-muted-foreground">{value || "—"}</div>
    </div>
  );
}

function valueField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return record[key] === undefined || record[key] === null || record[key] === "" ? null : formatValue(record[key]);
}

function preferredValue(value: unknown) {
  return valueField(value, "status")
    || valueField(value, "title")
    || valueField(value, "name")
    || valueField(value, "candidate_name")
    || formatValue(value);
}

function changeSummary(log: AuditLog, oldValue: string, newValue: string) {
  const oldStatus = valueField(log.created_value, "status");
  const newStatus = valueField(log.updated_value, "status");
  if (oldStatus || newStatus) {
    return `Status changed from ${oldStatus || "—"} to ${newStatus || "—"}`;
  }
  if (oldValue !== "—" && newValue !== "—") return `${oldValue} changed to ${newValue}`;
  if (newValue !== "—") return `${log.action}: ${newValue}`;
  if (oldValue !== "—") return `${log.action}: ${oldValue}`;
  return log.action;
}
