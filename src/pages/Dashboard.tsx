import { useEffect, useMemo, useState } from "react";
import { api, type Candidate, type CandidatePagination, type CandidateSortBy, type CandidateSummary, type Job, type JobPositionStatus, type SortOrder } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, XCircle, Calendar as CalendarIcon, Briefcase, Search, Trash2, Eye, FileText, Download, FilePenLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateNotesDialog } from "@/components/CandidateNotes";
import { CandidateProfileDrawer } from "@/components/CandidateProfileDrawer";
import { EmptyState, TableSkeletonRows } from "@/components/StateViews";
import { useAuth } from "@/lib/auth";
import { StageBadge } from "@/lib/pipeline";
import { toast } from "sonner";

const jobPositionStatuses: Array<{ value: JobPositionStatus; label: string }> = [
  { value: "ongoing", label: "Ongoing" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

const jobStatusStyles: Record<JobPositionStatus, string> = {
  ongoing: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-200",
  on_hold: "border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 focus:ring-yellow-200",
  cancelled: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-200",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-200",
};

const candidateSortOptions: Array<{ value: CandidateSortBy; label: string }> = [
  { value: "created_at", label: "Newest" },
  { value: "ats_score", label: "ATS Score" },
  { value: "skills_match_percent", label: "Skills Match" },
  { value: "candidate_name", label: "Candidate Name" },
  { value: "status", label: "Status" },
  { value: "recommendation", label: "Recommendation" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const canEdit = user?.role !== "viewer";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<CandidateSummary | null>(null);
  const [pagination, setPagination] = useState<CandidatePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<CandidateSortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewCv, setViewCv] = useState<Candidate | null>(null);
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [profileFor, setProfileFor] = useState<Candidate | null>(null);
  const [notesFor, setNotesFor] = useState<Candidate | null>(null);
  const [updatingJobStatus, setUpdatingJobStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const pageSize = 10;
  const jobPageSize = 5;

  async function load() {
    setLoading(true);
    const [jobsRes, candRes, summaryRes] = await Promise.all([
      api.jobs.list(),
      api.candidates.paginated({ page, limit: pageSize, status: filter, search: debouncedSearch, sortBy, sortOrder }),
      api.candidates.summary(),
    ]);
    setJobs(jobsRes || []);
    setCandidates(candRes.data || []);
    setPagination(candRes.pagination);
    setSummary(summaryRes);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, filter, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const stats = useMemo(() => ({
    jobs: jobs.length,
    total: summary?.total || 0,
    accepted: summary?.accepted || 0,
    rejected: summary?.rejected || 0,
    scheduled: summary?.scheduled || 0,
  }), [jobs, summary]);

  const jobTitle = (id: string) => jobs.find((j) => j.id === id)?.title || "—";
  const jobCandidateCount = (id: string) => summary?.byJob.find((item) => item.job_id === id)?.count || 0;
  const jobTotalPages = Math.max(Math.ceil(jobs.length / jobPageSize), 1);
  const currentJobPage = Math.min(jobPage, jobTotalPages);
  const paginatedJobs = useMemo(() => {
    const start = (currentJobPage - 1) * jobPageSize;
    return jobs.slice(start, start + jobPageSize);
  }, [currentJobPage, jobs]);

  async function deleteJob(id: string) {
    if (!confirm("Delete this job and all its candidates?")) return;
    await api.jobs.remove(id);
    toast.success("Job deleted");
    load();
  }

  async function updateJobStatus(id: string, current_position_status: JobPositionStatus) {
    const previousJobs = jobs;
    setUpdatingJobStatus(id);
    setJobs((items) => items.map((job) => job.id === id ? { ...job, current_position_status } : job));
    try {
      const updatedJob = await api.jobs.update(id, { current_position_status });
      setJobs((items) => items.map((job) => job.id === id ? updatedJob : job));
      toast.success("Job status updated");
    } catch (error) {
      setJobs(previousJobs);
      toast.error(error instanceof Error ? error.message : "Failed to update job status");
    } finally {
      setUpdatingJobStatus(null);
    }
  }

  function downloadJob(job: Job) {
    const safeTitle = job.title.replace(/[^a-zA-Z0-9._-]/g, "_") || "job-description";
    const content = `${job.title}\n\n${job.description}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage all jobs and candidates in one place</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Jobs" value={stats.jobs} icon={<Briefcase className="h-5 w-5" />} />
        <Stat label="Candidates" value={stats.total} icon={<Users className="h-5 w-5" />} />
        <Stat label="Accepted" value={stats.accepted} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
        <Stat label="Rejected" value={stats.rejected} icon={<XCircle className="h-5 w-5 text-red-500" />} />
        <Stat label="Scheduled" value={stats.scheduled} icon={<CalendarIcon className="h-5 w-5 text-blue-500" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Jobs</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Candidates</TableHead>
                  <TableHead>Current Position Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows rows={3} columns={5} />}
                {!loading && jobs.length === 0 && (
                  <TableRow><TableCell colSpan={5}><EmptyState title="No jobs yet" description="Create a job from the Resume Screener to start tracking candidates." /></TableCell></TableRow>
                )}
                {paginatedJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.title}</TableCell>
                    <TableCell className="text-center">{jobCandidateCount(j.id)}</TableCell>
                    <TableCell>
                      <Select
                        value={j.current_position_status || "ongoing"}
                        onValueChange={(value) => updateJobStatus(j.id, value as JobPositionStatus)}
                        disabled={!canEdit || updatingJobStatus === j.id}
                      >
                        <SelectTrigger className={`h-9 w-[170px] font-medium ${jobStatusStyles[j.current_position_status || "ongoing"]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {jobPositionStatuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(j.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setViewJob(j)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadJob(j)}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => deleteJob(j.id)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {jobs.length > jobPageSize && (
            <div className="flex items-center justify-between gap-3 pt-3">
              <div className="text-sm text-muted-foreground">
                Page {currentJobPage} of {jobTotalPages} · {jobs.length} job{jobs.length === 1 ? "" : "s"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentJobPage <= 1 || loading} onClick={() => setJobPage((p) => Math.max(p - 1, 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={currentJobPage >= jobTotalPages || loading} onClick={() => setJobPage((p) => Math.min(p + 1, jobTotalPages))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewJob} onOpenChange={(o) => !o && setViewJob(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {viewJob?.title || "Job Description"}
            </DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-6 border rounded-lg p-4 bg-muted/20">
            {viewJob?.description || "No description available"}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All Candidates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <Tabs value={filter} onValueChange={(v) => { setPage(1); setFilter(v as any); }}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="applied">Applied</TabsTrigger>
                <TabsTrigger value="shortlisted">Shortlisted</TabsTrigger>
                <TabsTrigger value="interview_round_1">Interview</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="hired">Hired</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={sortBy} onValueChange={(value) => { setPage(1); setSortBy(value as CandidateSortBy); }}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidateSortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(value) => { setPage(1); setSortOrder(value as SortOrder); }}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full md:w-72">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input placeholder="Search candidate, email, job…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-center">ATS Score</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows rows={6} columns={7} />}
                {!loading && candidates.length === 0 && (
                  <TableRow><TableCell colSpan={7}><EmptyState title="No candidates found" description="Try changing filters, search text, or run a new screening." /></TableCell></TableRow>
                )}
                {candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setProfileFor(c)}>
                        {c.candidate_name || "—"}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="text-sm">{jobTitle(c.job_id)}</TableCell>
                    <TableCell className="text-center font-semibold">{c.ats_score ?? 0}%</TableCell>
                    <TableCell><Badge variant="outline">{c.recommendation || "—"}</Badge></TableCell>
                    <TableCell><StageBadge status={c.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setNotesFor(c)}>
                          <FilePenLine className="h-4 w-4 mr-1" /> Notes
                        </Button>
                        {c.cv_url && (
                          <Button size="sm" variant="outline" onClick={() => setViewCv(c)}>
                            <Eye className="h-4 w-4 mr-1" /> View CV
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pagination && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} candidate{pagination.total === 1 ? "" : "s"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!pagination.hasPrev || loading} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!pagination.hasNext || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewCv} onOpenChange={(o) => !o && setViewCv(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 sm:rounded-lg">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewCv?.candidate_name || "Candidate CV"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted overflow-hidden">
            {viewCv?.cv_url ? (
              <iframe src={api.candidates.cvUrl(viewCv)} title="Candidate CV" className="w-full h-full border-0" />
            ) : (
              <div className="h-full grid place-items-center text-muted-foreground">CV file unavailable</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CandidateNotesDialog
        candidateId={notesFor?.id || null}
        candidateName={notesFor?.candidate_name}
        readOnly={!canEdit}
        onClose={() => setNotesFor(null)}
      />
      <CandidateProfileDrawer
        candidate={profileFor}
        jobTitle={profileFor ? jobTitle(profileFor.job_id) : undefined}
        onOpenChange={(open) => !open && setProfileFor(null)}
        onViewCv={(candidate) => setViewCv(candidate)}
      />
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
