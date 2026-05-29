import { useEffect, useMemo, useState } from "react";
import { api, type Candidate, type CandidateHiringRecommendation, type CandidateNote, type CandidateTimelineEvent, type Review } from "@/lib/api";
import { isInterviewStage, StageBadge, stageLabel } from "@/lib/pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrawerSkeleton, EmptyState } from "@/components/StateViews";
import {
  Bot, Briefcase, CalendarClock, CheckCircle2, CircleDot, FileText, Loader2, Mail, MessageSquare, NotebookPen, Send, Sparkles, Star, UserRound,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  candidate: Candidate | null;
  jobTitle?: string;
  onOpenChange: (open: boolean) => void;
  onViewCv?: (candidate: Candidate) => void;
};

export function CandidateProfileDrawer({ candidate, jobTitle, onOpenChange, onViewCv }: Props) {
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [timeline, setTimeline] = useState<CandidateTimelineEvent[]>([]);
  const [hiringRecommendation, setHiringRecommendation] = useState<CandidateHiringRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingRecommendation, setGeneratingRecommendation] = useState(false);

  useEffect(() => {
    if (!candidate) return;
    setHiringRecommendation(candidate.ai_hiring_recommendation || null);
    setLoading(true);
    Promise.all([
      api.notes.list(candidate.id).catch(() => []),
      api.reviews.list(candidate.id).catch(() => []),
      api.candidates.timeline(candidate.id).catch(() => []),
    ])
      .then(([notesRes, reviewsRes, timelineRes]) => {
        setNotes(notesRes);
        setReviews(reviewsRes);
        setTimeline(timelineRes);
      })
      .finally(() => setLoading(false));
  }, [candidate?.id]);

  async function generateRecommendation() {
    if (!candidate) return;
    setGeneratingRecommendation(true);
    try {
      const recommendation = await api.candidates.recommendation(candidate.id);
      setHiringRecommendation(recommendation);
      setTimeline((current) => [
        {
          type: "ai_recommendation_generated",
          title: "AI Recommendation Generated",
          detail: `${recommendation.recommendation} · ${recommendation.confidence_score}% confidence`,
          date: recommendation.generated_at,
        },
        ...current,
      ]);
      toast.success("AI hiring recommendation generated");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate recommendation");
    } finally {
      setGeneratingRecommendation(false);
    }
  }

  const avgRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + (review.overall_score ?? review.rating * 2), 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <Sheet open={!!candidate} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {candidate && (
          <div className="space-y-5">
            <SheetHeader className="border-b pb-4 pr-8">
              <div className="flex flex-col gap-3">
                <div>
                  <SheetTitle className="text-2xl">{candidate.candidate_name || "Candidate Profile"}</SheetTitle>
                  <SheetDescription className="mt-1">{jobTitle || "No job selected"}</SheetDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge status={candidate.status} />
                  {candidate.email && <Badge variant="outline">{candidate.email}</Badge>}
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={<Mail className="h-4 w-4" />} label="Email" value={candidate.email || "—"} />
              <Info icon={<UserRound className="h-4 w-4" />} label="Phone" value={candidate.phone || "—"} />
              <Info icon={<Briefcase className="h-4 w-4" />} label="Recommendation" value={candidate.recommendation || "—"} />
              <Info icon={<MessageSquare className="h-4 w-4" />} label="Panel Feedback" value={`${reviews.length} · Avg ${avgRating}/10`} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ScoreCard label="ATS Score" value={candidate.ats_score || 0} />
              <ScoreCard label="Skills Match" value={candidate.skills_match_percent || 0} />
            </div>

            <RecommendationCard recommendation={hiringRecommendation} loading={generatingRecommendation} onGenerate={generateRecommendation} />

            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="reviews">Feedback</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4">
                <Section title="Summary">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.summary || "No summary available."}</p>
                </Section>
                <Section title="Experience">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.experience_relevance || "No experience analysis available."}</p>
                </Section>
                <Section title="Education">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.education_match || "No education analysis available."}</p>
                </Section>
                {candidate.cv_url && onViewCv && (
                  <Button variant="outline" onClick={() => onViewCv(candidate)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View CV
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="skills" className="space-y-4">
                <SkillList title="Matched Skills" skills={candidate.matched_skills} variant="matched" />
                <SkillList title="Missing Skills" skills={candidate.missing_skills} variant="missing" />
              </TabsContent>

              <TabsContent value="notes" className="space-y-3">
                {loading && <LoadingRow />}
                {!loading && notes.length === 0 && <EmptyRow title="No internal notes yet" description="Private HR notes will appear here." />}
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-sm">{note.author_name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-3">
                {loading && <LoadingRow />}
                {!loading && reviews.length === 0 && <EmptyRow title="No interview feedback yet" description="Panel feedback and skill ratings will appear here." />}
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm">{review.reviewer_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{review.interview_round || "Interview"}</div>
                      </div>
                      <div className="text-right">
                        <Badge className={panelRecommendationClass(review.recommendation)}>{review.recommendation || "Hold"}</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">{new Date(review.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    {review.skill_ratings?.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {review.skill_ratings.map((item) => (
                          <div key={`${review.id}-${item.skill}`} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                            <span>{item.skill}</span>
                            <span className="font-semibold">{item.rating}/10</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 text-sm font-medium">Overall score: {review.overall_score ?? review.rating * 2}/10</div>
                    {review.notes && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{review.notes}</p>}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <Section title="Interview History">
                  {candidate.interview_at ? (
                    <div className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <CalendarClock className="h-4 w-4" />
                        {new Date(candidate.interview_at).toLocaleString()}
                      </div>
                      <div className="mt-2 text-muted-foreground">{candidate.interview_type || stageLabel(candidate.status)}</div>
                      {candidate.interviewer_name && <div className="text-muted-foreground">Interviewer: {candidate.interviewer_name}</div>}
                      {candidate.meeting_link && <div className="truncate text-muted-foreground">Meeting: {candidate.meeting_link}</div>}
                      {candidate.interview_notes && <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{candidate.interview_notes}</p>}
                    </div>
                  ) : (
                    <EmptyRow title={isInterviewStage(candidate.status) ? "Interview details not added yet" : "No interview scheduled"} description="Schedule an interview from the pipeline to populate this section." />
                  )}
                </Section>
                <Separator />
                <Section title="Activity Timeline">
                  <div className="space-y-3">
                    {loading && <LoadingRow />}
                    {!loading && timeline.length === 0 && <EmptyRow title="No timeline events yet" description="Candidate activity will appear here as the profile changes." />}
                    {timeline.map((item, index) => (
                      <div key={`${item.type}-${item.date}-${index}`} className="grid grid-cols-[28px_1fr] gap-3">
                        <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                          <TimelineIcon type={item.type} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{item.title}</div>
                          <div className="line-clamp-2 text-sm text-muted-foreground">{item.detail}</div>
                          {(item.actor_name || item.actor_email) && (
                            <div className="text-xs text-muted-foreground">By {item.actor_name || item.actor_email}</div>
                          )}
                          <div className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-2xl font-bold">{value}%</div>
      </div>
      <Progress value={value} className="mt-3" />
    </div>
  );
}

function RecommendationCard({
  recommendation,
  loading,
  onGenerate,
}: {
  recommendation: CandidateHiringRecommendation | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Hiring Recommendation
          </div>
          {recommendation?.generated_at && (
            <div className="mt-1 text-xs text-muted-foreground">
              Generated {new Date(recommendation.generated_at).toLocaleString()}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {recommendation ? "Regenerate" : "Generate"}
        </Button>
      </div>

      {recommendation ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={recommendationClass(recommendation.recommendation)}>{recommendation.recommendation}</Badge>
            <Badge variant="outline">{recommendation.confidence_score}% confidence</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniList title="Strengths" items={recommendation.strengths} />
            <MiniList title="Risks" items={recommendation.risks} />
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <span className="font-medium">Next action: </span>
            <span className="text-muted-foreground">{recommendation.next_action}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Generate a final AI recommendation using ATS analysis, job context, notes, reviews, and interview details.
        </div>
      )}
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{title}</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {(items.length ? items : ["—"]).map((item, index) => (
          <li key={`${item}-${index}`}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function recommendationClass(value: CandidateHiringRecommendation["recommendation"]) {
  if (value === "Strong Hire" || value === "Hire") return "bg-emerald-600 hover:bg-emerald-600";
  if (value === "Hold") return "bg-amber-500 hover:bg-amber-500";
  return "bg-red-500 hover:bg-red-500";
}

function panelRecommendationClass(value?: Review["recommendation"]) {
  if (value === "Strong Hire") return "bg-emerald-700 hover:bg-emerald-700";
  if (value === "Hire") return "bg-emerald-600 hover:bg-emerald-600";
  if (value === "Hold") return "bg-amber-500 hover:bg-amber-500";
  return "bg-red-500 hover:bg-red-500";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <NotebookPen className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function SkillList({ title, skills, variant }: { title: string; skills: string[]; variant: "matched" | "missing" }) {
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-2">
        {skills.length === 0 && <EmptyRow title={`No ${title.toLowerCase()} listed`} />}
        {skills.map((skill) => (
          <Badge key={skill} variant={variant === "matched" ? "secondary" : "outline"} className={variant === "matched" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 text-red-600 dark:text-red-400"}>
            {skill}
          </Badge>
        ))}
      </div>
    </Section>
  );
}

function LoadingRow() {
  return <DrawerSkeleton />;
}

function EmptyRow({ title, description }: { title: string; description?: string }) {
  return <EmptyState title={title} description={description} />;
}

function TimelineIcon({ type }: { type: string }) {
  if (type === "ai_screened") return <Bot className="h-4 w-4" />;
  if (type === "interview_scheduled") return <CalendarClock className="h-4 w-4" />;
  if (type === "review_added") return <Star className="h-4 w-4" />;
  if (type === "note_added") return <NotebookPen className="h-4 w-4" />;
  if (type === "offer_sent") return <Send className="h-4 w-4" />;
  if (type === "candidate_hired") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "candidate_applied") return <UserRound className="h-4 w-4" />;
  if (type === "ai_recommendation_generated") return <Sparkles className="h-4 w-4" />;
  return <CircleDot className="h-4 w-4" />;
}
