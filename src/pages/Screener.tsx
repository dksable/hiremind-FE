import { Fragment, useEffect, useMemo, useState } from "react";
import { api, type Candidate, type CandidatePagination, type CandidateSortBy, type SortOrder } from "@/lib/api";
import { extractTextFromFile } from "@/lib/fileParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, Calendar as CalendarIcon,
  Search, Sparkles, Users, ChevronDown, ChevronRight, Eye,
  AlertTriangle, FilePenLine,
} from "lucide-react";
import { CandidateNotesDialog } from "@/components/CandidateNotes";
import { CandidateProfileDrawer } from "@/components/CandidateProfileDrawer";
import { EmptyState } from "@/components/StateViews";
import { useAuth } from "@/lib/auth";
import { isInterviewStage, StageBadge } from "@/lib/pipeline";

function scoreColor(score: number) {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
}

function recColor(rec: string | null) {
  switch (rec) {
    case "Strong Fit": return "bg-emerald-600 text-white";
    case "Good Fit": return "bg-emerald-500/80 text-white";
    case "Average": return "bg-amber-500 text-white";
    case "Poor Fit": return "bg-red-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

const SCREENER_JOB_STORAGE_KEY = "hiremind_screener_job_id";
const AI_SCREENING_FALLBACK_MESSAGE = "AI screening failed. Please try again or review manually.";

const candidateSortOptions: Array<{ value: CandidateSortBy; label: string }> = [
  { value: "created_at", label: "Newest" },
  { value: "ats_score", label: "ATS Score" },
  { value: "skills_match_percent", label: "Skills Match" },
  { value: "candidate_name", label: "Candidate Name" },
  { value: "status", label: "Status" },
  { value: "recommendation", label: "Recommendation" },
];

function fallbackScreening(fileName: string, cvText: string, reason?: string) {
  const email = cvText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  return {
    candidate_name: fileName.replace(/\.[^.]+$/, ""),
    email,
    ats_score: 0,
    skills_match_percent: 0,
    matched_skills: [],
    missing_skills: [],
    experience_relevance: "AI screening failed. Manual review required.",
    education_match: "AI screening failed. Manual review required.",
    recommendation: "Needs Review",
    summary: reason ? `${AI_SCREENING_FALLBACK_MESSAGE} Error: ${reason}` : AI_SCREENING_FALLBACK_MESSAGE,
  };
}

export default function Screener() {
  const { user } = useAuth();
  const canEdit = user?.role !== "viewer";
  const [jdText, setJdText] = useState("");
  const [jdTitle, setJdTitle] = useState("");
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem(SCREENER_JOB_STORAGE_KEY));
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState<CandidateSortBy>("ats_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<CandidatePagination | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const pageSize = 10;

  // Interview dialog state
  const [schedFor, setSchedFor] = useState<Candidate | null>(null);
  const [viewCv, setViewCv] = useState<Candidate | null>(null);
  const [profileFor, setProfileFor] = useState<Candidate | null>(null);
  const [notesFor, setNotesFor] = useState<Candidate | null>(null);
  const [intDate, setIntDate] = useState("");
  const [intTime, setIntTime] = useState("");
  const [intType, setIntType] = useState("Online");
  const [intInterviewer, setIntInterviewer] = useState("");
  const [intLink, setIntLink] = useState("");
  const [intNotes, setIntNotes] = useState("");

  async function loadCandidates(jId: string, nextPage = page) {
    const result = await api.candidates.paginated({
      page: nextPage,
      limit: pageSize,
      jobId: jId,
      status: filter,
      search: debouncedSearch,
      sortBy,
      sortOrder,
    });
    setCandidates(result.data);
    setPagination(result.pagination);
  }

  useEffect(() => {
    if (jobId) loadCandidates(jobId);
  }, [jobId, page, filter, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleJdFile(file: File) {
    try {
      const text = await extractTextFromFile(file);
      setJdText(text);
      if (!jdTitle) setJdTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      toast.error("Could not read JD file");
    }
  }

  async function startScreening() {
    if (!canEdit) return toast.error("Viewer accounts are read-only");
    if (!jdText.trim()) return toast.error("Please provide a job description");
    if (cvFiles.length === 0) return toast.error("Please upload at least one CV");

    setAnalyzing(true);
    setProgress({ done: 0, total: cvFiles.length });

    try {
      // Create job
      const job = await api.jobs.create({ title: jdTitle || "Untitled Job", description: jdText });

      // Process CVs in parallel (small batches)
      const results: Candidate[] = [];
      const batchSize = 3;
      for (let i = 0; i < cvFiles.length; i += batchSize) {
        const batch = cvFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (file) => {
            try {
              const cvText = await extractTextFromFile(file);
              let analysis;
              try {
                analysis = await api.screenCV({ jobDescription: jdText, cvText });
              } catch (error: any) {
                toast.error(`${file.name}: ${AI_SCREENING_FALLBACK_MESSAGE}`);
                analysis = fallbackScreening(file.name, cvText, error?.message);
              }
              const formData = new FormData();
              formData.append("job_id", job.id);
              formData.append("candidate_name", analysis.candidate_name || file.name);
              formData.append("email", analysis.email || "");
              formData.append("cv_text", cvText.slice(0, 10000));
              formData.append("cv", file);
              formData.append("cv_mime", file.type || "");
              formData.append("ats_score", String(Math.round(analysis.ats_score || 0)));
              formData.append("skills_match_percent", String(Math.round(analysis.skills_match_percent || 0)));
              formData.append("matched_skills", JSON.stringify(analysis.matched_skills || []));
              formData.append("missing_skills", JSON.stringify(analysis.missing_skills || []));
              formData.append("experience_relevance", analysis.experience_relevance || "");
              formData.append("education_match", analysis.education_match || "");
              formData.append("recommendation", analysis.recommendation || "");
              formData.append("summary", analysis.summary || "");
              const candRow = await api.candidates.create(formData);
              if (candRow.duplicate_matches?.length) {
                const appliedElsewhere = candRow.duplicate_matches.some((match) => match.applied_for_another_job);
                toast.warning("Candidate already exists", {
                  description: appliedElsewhere ? "Applied for another job" : "Duplicate candidate found",
                });
              }
              results.push(candRow);
            } catch (e: any) {
              toast.error(`${file.name}: ${e.message}`);
            } finally {
              setProgress((p) => ({ ...p, done: p.done + 1 }));
            }
          })
        );
      }

      setPage(1);
      await loadCandidates(job.id, 1);
      setJobId(job.id);
      localStorage.setItem(SCREENER_JOB_STORAGE_KEY, job.id);
      if (results.length === 0) {
        toast.error("No candidates were saved. Please check the files and try again.");
      } else {
        toast.success(`Saved ${results.length} candidate${results.length !== 1 ? "s" : ""}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Screening failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function clearTableData() {
    setCandidates([]);
    setPagination(null);
    setJobId(null);
    setExpanded(null);
    setPage(1);
    localStorage.removeItem(SCREENER_JOB_STORAGE_KEY);
    setConfirmClearOpen(false);
    toast.success("Screener table data cleared");
  }

  async function updateStatus(c: Candidate, status: string, extra: Partial<Candidate> = {}) {
    if (!canEdit) return toast.error("Viewer accounts are read-only");
    try {
      const data = await api.candidates.update(c.id, { status, ...extra });
      setCandidates((prev) => prev.map((x) => (x.id === c.id ? data : x)));
    } catch (e: any) {
      toast.error(e.message || "Failed to update candidate");
    }
  }

  async function handleAccept(c: Candidate) {
    await updateStatus(c, "shortlisted");
    toast.success(`Acceptance email sent to ${c.email || c.candidate_name}`);
  }

  async function handleReject(c: Candidate) {
    await updateStatus(c, "rejected");
    toast(`Rejection email sent to ${c.email || c.candidate_name}`);
  }

  function openSchedule(c: Candidate) {
    setSchedFor(c);
    setIntDate("");
    setIntTime("");
    setIntType("Online");
    setIntInterviewer("");
    setIntLink("");
    setIntNotes("");
  }

  async function confirmSchedule() {
    if (!schedFor) return;
    if (!intDate || !intTime) return toast.error("Pick date and time");
    const iso = new Date(`${intDate}T${intTime}`).toISOString();
    await updateStatus(schedFor, "interview_round_1", {
      interview_at: iso,
      interview_type: intType,
      interviewer_name: intInterviewer,
      meeting_link: intLink,
      interview_notes: intNotes,
    });
    toast.success(`Interview scheduled and invite sent to ${schedFor.email || schedFor.candidate_name}`);
    setSchedFor(null);
  }

  const filtered = candidates;

  const stats = useMemo(() => ({
    total: candidates.length,
    accepted: candidates.filter((c) => ["shortlisted", "selected", "offer_sent", "hired", "accepted"].includes(c.status)).length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
    scheduled: candidates.filter((c) => isInterviewStage(c.status)).length,
  }), [candidates]);

  return (
    <>
      <main className="container py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resume Screener</h1>
          <p className="text-sm text-muted-foreground">Upload JD + CVs, let AI rank candidates instantly</p>
        </div>
        {/* Step 1: Uploads */}
        {canEdit && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Job Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Job title (e.g. Senior Frontend Engineer)"
                  value={jdTitle}
                  onChange={(e) => setJdTitle(e.target.value)}
                />
                <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-accent transition">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleJdFile(e.target.files[0])}
                  />
                  <div className="text-center text-sm text-muted-foreground">
                    <Upload className="h-6 w-6 mx-auto mb-2" />
                    Click to upload JD (PDF / DOCX / TXT)
                  </div>
                </label>
                <Textarea
                  placeholder="…or paste the job description here"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={8}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Candidate CVs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-accent transition">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => setCvFiles(Array.from(e.target.files || []))}
                  />
                  <div className="text-center text-sm text-muted-foreground">
                    <Upload className="h-6 w-6 mx-auto mb-2" />
                    Drop multiple CVs (PDF / DOCX / TXT)
                  </div>
                </label>
                {cvFiles.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {cvFiles.map((f, i) => (
                      <div key={i} className="text-sm flex items-center gap-2 p-2 bg-muted rounded">
                        <FileText className="h-4 w-4" /> {f.name}
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={startScreening} disabled={analyzing} className="w-full" size="lg">
                  {analyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing {progress.done}/{progress.total}…</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Run AI Screening</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dashboard cards */}
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Applications" value={stats.total} icon={<Users className="h-5 w-5" />} />
              <StatCard label="Accepted" value={stats.accepted} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
              <StatCard label="Rejected" value={stats.rejected} icon={<XCircle className="h-5 w-5 text-red-500" />} />
              <StatCard label="Scheduled" value={stats.scheduled} icon={<CalendarIcon className="h-5 w-5 text-blue-500" />} />
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                  <Tabs value={filter} onValueChange={(v) => { setPage(1); setFilter(v as any); }}>
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="applied">Applied</TabsTrigger>
                      <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={analyzing || candidates.length === 0}
                      onClick={() => setConfirmClearOpen(true)}
                    >
                      Clear
                    </Button>
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
                      <Input
                        placeholder="Search name, email, skills…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-center">ATS Score</TableHead>
                        <TableHead className="text-center">Skills %</TableHead>
                        <TableHead>Recommendation</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9}>
                            <EmptyState
                              title="No screening results"
                              description={jobId ? "Try changing filters or upload new resumes for this job." : "Upload a job description and resumes, then run AI screening."}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                      {filtered.map((c, idx) => {
                        const isOpen = expanded === c.id;
                        const isRejected = c.status === "rejected";
                        const duplicateMatches = c.duplicate_matches || [];
                        return (
                          <Fragment key={c.id}>
                            <TableRow className={isRejected ? "opacity-60" : ""}>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(isOpen ? null : c.id)}>
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{((pagination?.page || 1) - 1) * pageSize + idx + 1}</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                  <button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setProfileFor(c)}>
                                    {c.candidate_name || "—"}
                                  </button>
                                  {duplicateMatches.length > 0 && (
                                    <Badge variant="outline" className="w-fit border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Candidate already exists
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-semibold border ${scoreColor(c.ats_score || 0)}`}>
                                  {c.ats_score ?? 0}%
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-sm">{c.skills_match_percent ?? 0}%</TableCell>
                              <TableCell>
                                <Badge className={recColor(c.recommendation)}>{c.recommendation || "—"}</Badge>
                              </TableCell>
                              <TableCell>
                                <StageBadge status={c.status} />
                                {isInterviewStage(c.status) && c.interview_at && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {new Date(c.interview_at).toLocaleString()}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {c.cv_url && (
                                    <Button size="sm" variant="outline" onClick={() => setViewCv(c)} title="View CV">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => setNotesFor(c)} title="Internal Notes">
                                    <FilePenLine className="h-4 w-4" />
                                  </Button>
                                  {canEdit && c.status !== "rejected" && (
                                      <Button size="sm" variant="outline" onClick={() => handleReject(c)} className="text-red-600 hover:text-red-700">
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    )}
                                  {canEdit && (["shortlisted", "selected", "offer_sent", "hired", "accepted"].includes(c.status) || isInterviewStage(c.status)) && (
                                      <Button size="sm" onClick={() => openSchedule(c)}>
                                        <CalendarIcon className="h-4 w-4 mr-1" /> Schedule
                                      </Button>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={9} className="p-4">
                                  {duplicateMatches.length > 0 && (
                                    <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                                      <div className="mb-2 flex flex-wrap items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                                        <AlertTriangle className="h-4 w-4" />
                                        Candidate already exists
                                        {duplicateMatches.some((match) => match.applied_for_another_job) && (
                                          <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-300">
                                            Applied for another job
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        {duplicateMatches.map((match) => (
                                          <div key={match.candidate_id} className="rounded border bg-background/70 p-2">
                                            <div className="font-medium">{match.candidate_name || match.email || "Existing candidate"}</div>
                                            <div className="mt-1 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                                              <div>Email: {match.email || "—"}</div>
                                              <div>Job: {match.job_title || "—"}</div>
                                              <div>Status: {match.status || "—"}</div>
                                              <div>Reason: {match.reasons.join(", ")}{match.similarity ? ` (${Math.round(match.similarity * 100)}% similar)` : ""}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <div className="font-semibold mb-1">Summary</div>
                                      <p className="text-muted-foreground">{c.summary}</p>
                                      <div className="mt-3"><span className="font-semibold">Experience: </span><span className="text-muted-foreground">{c.experience_relevance}</span></div>
                                      <div className="mt-1"><span className="font-semibold">Education: </span><span className="text-muted-foreground">{c.education_match}</span></div>
                                    </div>
                                    <div>
                                      <div className="font-semibold mb-1">Matched Skills</div>
                                      <div className="flex flex-wrap gap-1 mb-3">
                                        {(c.matched_skills as string[] || []).map((s, i) => (
                                          <Badge key={i} variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{s}</Badge>
                                        ))}
                                      </div>
                                      <div className="font-semibold mb-1">Missing Skills</div>
                                      <div className="flex flex-wrap gap-1">
                                        {(c.missing_skills as string[] || []).map((s, i) => (
                                          <Badge key={i} variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400">{s}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages} · {pagination.total} candidate{pagination.total === 1 ? "" : "s"}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={!pagination.hasPrev || analyzing} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={!pagination.hasNext || analyzing} onClick={() => setPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
      </main>

      {/* Schedule dialog */}
      <Dialog open={!!schedFor} onOpenChange={(o) => !o && setSchedFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview — {schedFor?.candidate_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={intDate} onChange={(e) => setIntDate(e.target.value)} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={intTime} onChange={(e) => setIntTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Interview Type</Label>
              <Select value={intType} onValueChange={setIntType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="On-site">On-site</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Interviewer Name</Label>
              <Input value={intInterviewer} onChange={(e) => setIntInterviewer(e.target.value)} />
            </div>
            {intType === "Online" && (
              <div>
                <Label>Meeting Link</Label>
                <Input value={intLink} onChange={(e) => setIntLink(e.target.value)} placeholder="Google Meet, Outlook Teams, Zoom, or other meeting URL" />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={intNotes} onChange={(e) => setIntNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedFor(null)}>Cancel</Button>
            <Button onClick={confirmSchedule}>Confirm & Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CV viewer dialog */}
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
              <iframe
                src={api.candidates.cvUrl(viewCv)}
                title="Candidate CV"
                className="w-full h-full border-0"
              />
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
      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Candidate Screening Data</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to clear all candidate screening data?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button onClick={clearTableData}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CandidateProfileDrawer
        candidate={profileFor}
        jobTitle={jdTitle || "Current Job"}
        onOpenChange={(open) => !open && setProfileFor(null)}
        onViewCv={(candidate) => setViewCv(candidate)}
      />
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
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
