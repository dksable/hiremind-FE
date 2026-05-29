import { useEffect, useState } from "react";
import { api, type Candidate, type Review } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  candidateId: string | null;
  candidate?: Candidate | null;
  candidateName?: string | null;
  readOnly?: boolean;
  onClose: () => void;
};

function defaultSkillRatings(candidate?: Candidate | null) {
  const candidateSkills = (candidate?.matched_skills || [])
    .map((skill) => skill.trim())
    .filter(Boolean);
  const uniqueSkills = Array.from(new Set(candidateSkills));
  return uniqueSkills.map((skill) => ({ skill, rating: 7 }));
}

export function CandidateReviewsDialog({ candidateId, candidate, candidateName, readOnly = false, onClose }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interviewRound, setInterviewRound] = useState("Interview Round 1");
  const [skillRatings, setSkillRatings] = useState(defaultSkillRatings(candidate));
  const [notes, setNotes] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  async function load() {
    if (!candidateId) return;
    setLoading(true);
    try {
      setReviews(await api.reviews.list(candidateId));
    } catch (e: any) {
      toast.error(e.message || "Failed to load interview feedback");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (candidateId) {
      setName(user?.name || "");
      setEmail(user?.email || "");
      setNotes("");
      setInterviewRound("Interview Round 1");
      setSkillRatings(defaultSkillRatings(candidate));
      load();
    }
  }, [candidateId, candidate?.matched_skills]);

  async function submit() {
    if (!candidateId) return;
    if (saving) return;
    if (!name.trim()) return toast.error("Reviewer name is required");
    if (skillRatings.length === 0) return toast.error("Please add at least one skill rating");
    if (skillRatings.some((item) => !item.skill.trim())) return toast.error("Every skill needs a name");
    if (!notes.trim()) return toast.error("Please add some notes");
    setSaving(true);
    try {
      await api.reviews.add(candidateId, {
        reviewer_name: name.trim(),
        reviewer_email: email.trim() || null,
        interview_round: interviewRound.trim() || "Interview",
        skill_ratings: skillRatings.map((item) => ({ skill: item.skill.trim(), rating: item.rating })),
        notes: notes.trim(),
      });
      toast.success("Panel feedback submitted");
      setNotes("");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to add review");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!candidateId) return;
    try {
      await api.reviews.remove(candidateId, id);
      toast.success("Panel feedback deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete panel feedback");
    }
  }

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.overall_score ?? r.rating * 2), 0) / reviews.length).toFixed(1)
    : "—";

  const panelRecommendation = reviews.length ? recommendationForScore(Number(avg)) : "—";

  function updateSkill(index: number, field: "skill" | "rating", value: string) {
    setSkillRatings((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === "skill") return { ...item, skill: value };
      return { ...item, rating: Math.min(Math.max(Number(value), 0), 10) };
    }));
  }

  function addSkill() {
    setSkillRatings((current) => [...current, { skill: "", rating: 5 }]);
  }

  function removeSkill(index: number) {
    setSkillRatings((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  return (
    <Dialog open={!!candidateId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Interview Panel Feedback — {candidateName || "Candidate"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {reviews.length} submission{reviews.length === 1 ? "" : "s"} · Overall score: <span className="font-semibold">{avg}/10</span> · Recommendation: <span className="font-semibold">{panelRecommendation}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {!readOnly && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="font-medium text-sm">Submit panel feedback</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Reviewer name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <Label className="text-xs">Email (optional)</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Interview round</Label>
                  <Input value={interviewRound} onChange={(e) => setInterviewRound(e.target.value)} placeholder="Technical Round, HR Round..." />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label className="text-xs">Skill-wise ratings</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addSkill}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Skill
                  </Button>
                </div>
                <div className="space-y-2">
                  {skillRatings.length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      No candidate skills available. Add a skill to submit panel feedback.
                    </div>
                  )}
                  {skillRatings.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_88px_32px] gap-2">
                      <Input value={item.skill} onChange={(event) => updateSkill(index, "skill", event.target.value)} placeholder="Skill" />
                      <Input type="number" min={0} max={10} value={item.rating} onChange={(event) => updateSkill(index, "rating", event.target.value)} />
                      <Button type="button" variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => removeSkill(index)} disabled={skillRatings.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Strengths, concerns, recommendation..."
                  rows={3}
                />
              </div>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Done
              </Button>
            </div>
          )}

          {/* Reviews list */}
          <div className="space-y-3">
            <div className="font-medium text-sm">All panel feedback</div>
            {loading && <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></div>}
            {!loading && reviews.length === 0 && (
              <div className="text-center text-muted-foreground py-6 text-sm border rounded-lg">
                No panel feedback yet.
              </div>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.reviewer_name}</div>
                    {r.reviewer_email && (
                      <div className="text-xs text-muted-foreground">{r.reviewer_email}</div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">{r.interview_round || "Interview"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={recommendationClass(r.recommendation)}>{r.recommendation}</Badge>
                    <Badge variant="outline">{r.overall_score ?? r.rating * 2}/10</Badge>
                    {!readOnly && (
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {r.skill_ratings?.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {r.skill_ratings.map((item) => (
                      <div key={`${r.id}-${item.skill}`} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                        <span>{item.skill}</span>
                        <span className="font-semibold">{item.rating}/10</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.notes && <p className="text-sm whitespace-pre-wrap">{r.notes}</p>}
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function recommendationForScore(score: number) {
  if (score >= 8.5) return "Strong Hire";
  if (score >= 7) return "Hire";
  if (score >= 5.5) return "Hold";
  return "Reject";
}

function recommendationClass(value?: string) {
  if (value === "Strong Hire") return "bg-emerald-700 hover:bg-emerald-700";
  if (value === "Hire") return "bg-emerald-600 hover:bg-emerald-600";
  if (value === "Hold") return "bg-amber-500 hover:bg-amber-500";
  return "bg-red-500 hover:bg-red-500";
}
