import { Badge } from "@/components/ui/badge";

export const PIPELINE_STAGES = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interview_round_1", label: "Interview Round 1" },
  { id: "interview_round_2", label: "Interview Round 2" },
  { id: "technical_round", label: "Technical Round" },
  { id: "hr_round", label: "HR Round" },
  { id: "selected", label: "Selected" },
  { id: "rejected", label: "Rejected" },
  { id: "on_hold", label: "On Hold" },
  { id: "offer_sent", label: "Offer Sent" },
  { id: "hired", label: "Hired" },
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number]["id"];

export function normalizeStage(status?: string | null): PipelineStage {
  if (status === "pending") return "applied";
  if (status === "accepted") return "shortlisted";
  if (status === "scheduled") return "interview_round_1";
  if (PIPELINE_STAGES.some((stage) => stage.id === status)) return status as PipelineStage;
  return "applied";
}

export function stageLabel(status?: string | null) {
  return PIPELINE_STAGES.find((stage) => stage.id === normalizeStage(status))?.label || "Applied";
}

export function isInterviewStage(status?: string | null) {
  return ["interview_round_1", "interview_round_2", "technical_round", "hr_round"].includes(normalizeStage(status));
}

export function isHiredStage(status?: string | null) {
  return ["selected", "offer_sent", "hired"].includes(normalizeStage(status));
}

export function StageBadge({ status }: { status: string }) {
  const stage = normalizeStage(status);
  if (stage === "applied" || stage === "screening") return <Badge className="border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">Applied</Badge>;
  if (stage === "shortlisted") return <Badge className="border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-100">Shortlisted</Badge>;
  if (isInterviewStage(stage)) return <Badge className="border-purple-200 bg-purple-100 text-purple-700 hover:bg-purple-100">{stageLabel(stage)}</Badge>;
  if (stage === "selected" || stage === "offer_sent" || stage === "hired") return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{stageLabel(stage)}</Badge>;
  if (stage === "rejected") return <Badge className="border-red-200 bg-red-100 text-red-700 hover:bg-red-100">Rejected</Badge>;
  if (stage === "on_hold") return <Badge className="border-yellow-200 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">On Hold</Badge>;
  return <Badge variant="secondary">{stageLabel(stage)}</Badge>;
}
