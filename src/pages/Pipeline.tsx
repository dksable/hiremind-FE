import { useEffect, useMemo, useState } from "react";
import { api, type CalendarIntegrationStatus, type CalendarProvider, type Candidate, type Job } from "@/lib/api";
import { PIPELINE_STAGES, isInterviewStage, normalizeStage, StageBadge, stageLabel, type PipelineStage } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CandidateNotesDialog } from "@/components/CandidateNotes";
import { CandidateReviewsDialog } from "@/components/CandidateReviews";
import { CandidateProfileDrawer } from "@/components/CandidateProfileDrawer";
import { EmptyState } from "@/components/StateViews";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Briefcase, CalendarClock, FilePenLine, GripVertical, Loader2, MessageSquare, Plus, Search, Trash2, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";

type PipelineBoardStage = Exclude<PipelineStage, "screening">;

const PIPELINE_BOARD_STAGES = PIPELINE_STAGES.filter(
  (stage): stage is { id: PipelineBoardStage; label: string } => stage.id !== "screening",
);

const REJECTABLE_STAGES: PipelineStage[] = [
  "applied",
  "shortlisted",
  "interview_round_1",
  "interview_round_2",
  "technical_round",
  "hr_round",
];

type SchedulePanelMember = { name: string; email: string };

function normalizeBoardStage(status?: string | null): PipelineBoardStage {
  const stage = normalizeStage(status);
  return stage === "screening" ? "applied" : stage;
}

function canRejectCandidate(status?: string | null) {
  return REJECTABLE_STAGES.includes(normalizeStage(status));
}

export default function PipelinePage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "viewer";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);
  const [jobFilter, setJobFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [profileFor, setProfileFor] = useState<Candidate | null>(null);
  const [notesFor, setNotesFor] = useState<Candidate | null>(null);
  const [reviewsFor, setReviewsFor] = useState<Candidate | null>(null);
  const [rejectFor, setRejectFor] = useState<Candidate | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<{ candidate: Candidate; stage: PipelineStage } | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [panelMembers, setPanelMembers] = useState<SchedulePanelMember[]>([{ name: "", email: "" }]);
  const [meetingLink, setMeetingLink] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [meetingProvider, setMeetingProvider] = useState<CalendarProvider>("manual");
  const [integrationStatus, setIntegrationStatus] = useState<CalendarIntegrationStatus | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [jobsRes, candidatesRes] = await Promise.all([
        api.jobs.list(),
        api.candidates.list(),
      ]);
      setJobs(jobsRes || []);
      setCandidates(candidatesRes || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.integrations.status().then(setIntegrationStatus).catch(() => setIntegrationStatus(null));
  }, []);

  const jobTitle = (id: string) => jobs.find((job) => job.id === id)?.title || "—";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (jobFilter !== "all" && candidate.job_id !== jobFilter) return false;
      if (!term) return true;
      return [
        candidate.candidate_name,
        candidate.email,
        jobTitle(candidate.job_id),
        candidate.recommendation,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [candidates, jobFilter, search, jobs]);

  const candidatesByStage = useMemo(() => {
    return PIPELINE_BOARD_STAGES.reduce<Record<PipelineBoardStage, Candidate[]>>((acc, stage) => {
      acc[stage.id] = filtered
        .filter((candidate) => normalizeBoardStage(candidate.status) === stage.id)
        .sort((a, b) => (b.ats_score || 0) - (a.ats_score || 0));
      return acc;
    }, {} as Record<PipelineBoardStage, Candidate[]>);
  }, [filtered]);

  async function moveCandidate(candidateId: string, stage: PipelineStage, options: { showToast?: boolean } = {}) {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate || normalizeStage(candidate.status) === stage) return;

    const { showToast = true } = options;
    const previous = candidates;
    setCandidates((current) => current.map((item) => item.id === candidateId ? { ...item, status: stage } : item));
    try {
      const updated = await api.candidates.update(candidateId, { status: stage });
      setCandidates((current) => current.map((item) => item.id === candidateId ? updated : item));
      if (showToast) toast.success(`Moved ${candidate.candidate_name || "candidate"}`);
    } catch (error: any) {
      setCandidates(previous);
      toast.error(error.message || "Failed to move candidate");
      throw error;
    }
  }

  function onDrop(stage: PipelineStage) {
    if (!canEdit || !draggingId) return;
    const candidate = candidates.find((item) => item.id === draggingId);
    if (!candidate) return;
    if (isInterviewStage(stage)) {
      openScheduleDialog(candidate, stage);
    } else {
      moveCandidate(draggingId, stage);
    }
    setDraggingId(null);
    setOverStage(null);
  }

  function openScheduleDialog(candidate: Candidate, stage: PipelineStage) {
    setScheduleFor({ candidate, stage });
    setInterviewDate("");
    setInterviewTime("");
    setPanelMembers([{ name: "", email: "" }]);
    setMeetingProvider("manual");
    setMeetingLink(candidate.meeting_link || "");
    setInterviewNotes("");
  }

  function updatePanelMember(index: number, field: keyof SchedulePanelMember, value: string) {
    setPanelMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, [field]: value } : member));
  }

  function addPanelMember() {
    setPanelMembers((current) => [...current, { name: "", email: "" }]);
  }

  function removePanelMember(index: number) {
    setPanelMembers((current) => current.filter((_member, memberIndex) => memberIndex !== index));
  }

  async function submitInterviewSchedule() {
    if (!scheduleFor) return;
    if (scheduling) return;
    if (!scheduleFor.candidate.email) return toast.error("Candidate email is required before scheduling");
    if (!interviewDate || !interviewTime) return toast.error("Interview date and time are required");

    const cleanedPanel = panelMembers
      .map((member) => ({ name: member.name.trim(), email: member.email.trim() }))
      .filter((member) => member.name || member.email);
    if (cleanedPanel.length === 0) return toast.error("Add at least one interviewer or panel member");
    if (cleanedPanel.some((member) => !member.name || !member.email)) return toast.error("Each panel member needs both name and email");
    const invalidPanelEmail = cleanedPanel.find((member) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email));
    if (invalidPanelEmail) return toast.error(`Invalid panel email: ${invalidPanelEmail.email}`);
    if (meetingProvider === "manual" && !meetingLink.trim()) return toast.error("Meeting link is required");
    if (meetingProvider === "manual" && !/^https?:\/\/\S+$/i.test(meetingLink.trim())) return toast.error("Meeting link must start with http:// or https://");
    if (meetingProvider !== "manual" && !integrationStatus?.[meetingProvider]) {
      return toast.error(`${meetingProvider === "google" ? "Google Calendar" : "Microsoft Graph"} is not connected`);
    }

    setScheduling(true);
    const previous = candidates;
    const stage = scheduleFor.stage;
    const candidateId = scheduleFor.candidate.id;
    try {
      const interviewAt = new Date(`${interviewDate}T${interviewTime}`).toISOString();
      setCandidates((current) => current.map((candidate) => candidate.id === candidateId ? { ...candidate, status: stage } : candidate));
      const updated = await api.candidates.update(candidateId, {
        status: stage,
        interview_at: interviewAt,
        interview_type: stageLabel(stage),
        interviewer_name: cleanedPanel.map((member) => member.name).join(", "),
        interview_panel_names: cleanedPanel.map((member) => member.name),
        interview_panel_emails: cleanedPanel.map((member) => member.email),
        meeting_provider: meetingProvider,
        meeting_link: meetingProvider === "manual" ? meetingLink.trim() : undefined,
        interview_notes: interviewNotes.trim(),
      } as Partial<Candidate> & { meeting_provider: CalendarProvider });
      setCandidates((current) => current.map((candidate) => candidate.id === candidateId ? updated : candidate));
      toast.success(`${stageLabel(stage)} scheduled and invites sent`);
      setScheduleFor(null);
      if (meetingProvider !== "manual") setMeetingLink(updated.meeting_link || "");
    } catch (error: any) {
      setCandidates(previous);
      const message = String(error.message || "");
      toast.error(message.includes("email sending failed") ? message : message || "Failed to schedule interview");
    } finally {
      setScheduling(false);
    }
  }

  function openRejectDialog(candidate: Candidate) {
    setRejectFor(candidate);
    setRejectionNote("");
  }

  async function submitRejection() {
    if (!rejectFor) return;
    if (rejecting) return;
    const note = rejectionNote.trim();
    if (!note) return toast.error("Please add a rejection reason or internal comment");

    setRejecting(true);
    try {
      await api.notes.add(rejectFor.id, { note });
      await moveCandidate(rejectFor.id, "rejected", { showToast: false });
      toast.success(`Candidate rejected: ${rejectFor.candidate_name || rejectFor.email || "candidate"}`);
      setRejectFor(null);
      setRejectionNote("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject candidate");
    } finally {
      setRejecting(false);
    }
  }

  async function connectCalendar(provider: Exclude<CalendarProvider, "manual">) {
    try {
      const { url } = await api.integrations.connectUrl(provider);
      window.open(url, "_blank", "noopener,noreferrer,width=720,height=760");
      toast(`Complete ${provider === "google" ? "Google" : "Microsoft"} connection in the new tab, then click Refresh.`);
    } catch (error: any) {
      toast.error(error.message || "Failed to start calendar connection");
    }
  }

  async function refreshIntegrations() {
    try {
      setIntegrationStatus(await api.integrations.status());
      toast.success("Calendar connection status refreshed");
    } catch (error: any) {
      toast.error(error.message || "Failed to refresh calendar connections");
    }
  }

  return (
    <main className="container py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidate Pipeline</h1>
          <p className="text-muted-foreground">Drag candidates across ATS stages from applied to hired</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate, email, job..." className="pl-9" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="grid min-w-[2920px] grid-cols-11 gap-3">
            {PIPELINE_BOARD_STAGES.map((stage) => {
              const stageCandidates = candidatesByStage[stage.id];
              return (
                <section
                  key={stage.id}
                  onDragOver={(event) => {
                    if (!canEdit) return;
                    event.preventDefault();
                    setOverStage(stage.id);
                  }}
                  onDragLeave={() => setOverStage(null)}
                  onDrop={() => onDrop(stage.id)}
                  className={cn(
                    "min-h-[68vh] rounded-lg border bg-muted/30 p-3 transition-colors",
                    overStage === stage.id && "border-primary bg-primary/5",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{stage.label}</div>
                    <div className="grid h-6 min-w-6 place-items-center rounded-full bg-background px-2 text-xs font-semibold">
                      {stageCandidates.length}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {stageCandidates.map((candidate) => (
                      <Card
                        key={candidate.id}
                        draggable={canEdit}
                        onDragStart={() => canEdit && setDraggingId(candidate.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverStage(null);
                        }}
                        className={cn("cursor-default border bg-background shadow-sm", canEdit && "cursor-grab active:cursor-grabbing", draggingId === candidate.id && "opacity-50")}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div>
                                <button
                                  type="button"
                                  className="block max-w-full truncate text-left text-sm font-semibold hover:text-primary hover:underline"
                                  onClick={() => setProfileFor(candidate)}
                                >
                                  {candidate.candidate_name || "Candidate"}
                                </button>
                                <div className="truncate text-xs text-muted-foreground">{candidate.email || "No email"}</div>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Briefcase className="h-3.5 w-3.5" />
                                <span className="truncate">{jobTitle(candidate.job_id)}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <StageBadge status={candidate.status} />
                                <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{candidate.ats_score || 0}% ATS</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setNotesFor(candidate)} title="Internal Notes">
                                    <FilePenLine className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setReviewsFor(candidate)} title="Interview Feedback">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {canEdit && canRejectCandidate(candidate.status) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        onClick={() => openRejectDialog(candidate)}
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Reject</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {stageCandidates.length === 0 && (
                      <EmptyState
                        title={canEdit ? "Drop candidates here" : "No candidates"}
                        description={canEdit ? "Move a card into this stage to update the pipeline." : "This stage has no candidates yet."}
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4" />
          Viewer accounts can inspect the pipeline but cannot move candidates.
        </div>
      )}

      <CandidateNotesDialog
        candidateId={notesFor?.id || null}
        candidateName={notesFor?.candidate_name}
        readOnly={!canEdit}
        onClose={() => setNotesFor(null)}
      />
      <CandidateReviewsDialog
        candidateId={reviewsFor?.id || null}
        candidate={reviewsFor}
        candidateName={reviewsFor?.candidate_name}
        readOnly={!canEdit}
        onClose={() => setReviewsFor(null)}
      />
      <Dialog open={!!rejectFor} onOpenChange={(open) => !open && !rejecting && setRejectFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Reject Candidate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Add an internal rejection reason for {rejectFor?.candidate_name || rejectFor?.email || "this candidate"}.
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejection-note">Internal note</Label>
              <Textarea
                id="rejection-note"
                value={rejectionNote}
                onChange={(event) => setRejectionNote(event.target.value)}
                placeholder="Rejected due to skill mismatch, compensation expectations, availability, or interview feedback..."
                rows={5}
                disabled={rejecting}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={rejecting} onClick={() => setRejectFor(null)}>
                Cancel
              </Button>
              <Button disabled={rejecting} onClick={submitRejection}>
                {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!scheduleFor} onOpenChange={(open) => !open && !scheduling && setScheduleFor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Schedule {scheduleFor ? stageLabel(scheduleFor.stage) : "Interview"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Candidate</div>
                <div className="font-medium">{scheduleFor?.candidate.candidate_name || "Candidate"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="font-medium">{scheduleFor?.candidate.email || "No email"}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={interviewDate} onChange={(event) => setInterviewDate(event.target.value)} disabled={scheduling} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={interviewTime} onChange={(event) => setInterviewTime(event.target.value)} disabled={scheduling} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Interview panel</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPanelMember} disabled={scheduling}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Panel member
                </Button>
              </div>
              <div className="space-y-2">
                {panelMembers.map((member, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_36px]">
                    <Input
                      value={member.name}
                      onChange={(event) => updatePanelMember(index, "name", event.target.value)}
                      placeholder="Panel member name"
                      disabled={scheduling}
                    />
                    <Input
                      type="email"
                      value={member.email}
                      onChange={(event) => updatePanelMember(index, "email", event.target.value)}
                      placeholder="panel@company.com"
                      disabled={scheduling}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => removePanelMember(index)} disabled={scheduling || panelMembers.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Meeting provider</Label>
              <Select value={meetingProvider} onValueChange={(value) => setMeetingProvider(value as CalendarProvider)} disabled={scheduling}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual link</SelectItem>
                  <SelectItem value="google">Auto-generate Google Meet</SelectItem>
                  <SelectItem value="microsoft">Auto-generate Microsoft Teams</SelectItem>
                </SelectContent>
              </Select>
              {meetingProvider !== "manual" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {integrationStatus?.[meetingProvider]
                      ? `Connected: ${integrationStatus[meetingProvider]?.account_email || "calendar account"}`
                      : `${meetingProvider === "google" ? "Google Calendar" : "Microsoft Graph"} not connected`}
                  </span>
                  {!integrationStatus?.[meetingProvider] && (
                    <Button type="button" size="sm" variant="outline" onClick={() => connectCalendar(meetingProvider)} disabled={scheduling}>
                      Connect
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={refreshIntegrations} disabled={scheduling}>
                    Refresh
                  </Button>
                </div>
              )}
            </div>

            {meetingProvider === "manual" && (
              <div>
                <Label>Meeting link</Label>
                <Input
                  value={meetingLink}
                  onChange={(event) => setMeetingLink(event.target.value)}
                  placeholder="https://meet.google.com/... or Microsoft Teams link"
                  disabled={scheduling}
                />
              </div>
            )}

            {meetingProvider !== "manual" && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                The meeting link will be created automatically after you click Done.
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={interviewNotes}
                onChange={(event) => setInterviewNotes(event.target.value)}
                placeholder="Agenda, preparation notes, round details..."
                rows={3}
                disabled={scheduling}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={scheduling} onClick={() => setScheduleFor(null)}>
                Cancel
              </Button>
              <Button disabled={scheduling} onClick={submitInterviewSchedule}>
                {scheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CandidateProfileDrawer
        candidate={profileFor}
        jobTitle={profileFor ? jobTitle(profileFor.job_id) : undefined}
        onOpenChange={(open) => !open && setProfileFor(null)}
      />
    </main>
  );
}
