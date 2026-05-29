import { useEffect, useState } from "react";
import { api, type CandidateNote } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FilePenLine, Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  candidateId: string | null;
  candidateName?: string | null;
  readOnly?: boolean;
  onClose: () => void;
};

export function CandidateNotesDialog({ candidateId, candidateName, readOnly = false, onClose }: Props) {
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!candidateId) return;
    setLoading(true);
    try {
      setNotes(await api.notes.list(candidateId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (candidateId) {
      setNote("");
      load();
    }
  }, [candidateId]);

  async function submit() {
    if (!candidateId) return;
    if (saving) return;
    if (!note.trim()) return toast.error("Please add a note");
    setSaving(true);
    try {
      await api.notes.add(candidateId, { note: note.trim() });
      toast.success("Internal note added");
      setNote("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  async function remove(noteId: string) {
    if (!candidateId) return;
    try {
      await api.notes.remove(candidateId, noteId);
      toast.success("Internal note deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete note");
    }
  }

  return (
    <Dialog open={!!candidateId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePenLine className="h-5 w-5" />
            Internal Notes — {candidateName || "Candidate"}
          </DialogTitle>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Private HR comments for salary expectations, communication, strengths, and concerns.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {!readOnly && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <Label className="text-xs">Add internal note</Label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Good communication, weak in DSA, expected high salary..."
                  rows={4}
                />
              </div>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Note
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div className="font-medium text-sm">All internal notes</div>
            {loading && <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></div>}
            {!loading && notes.length === 0 && (
              <div className="text-center text-muted-foreground py-6 text-sm border rounded-lg">
                No internal notes yet.
              </div>
            )}
            {notes.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.author_name}</div>
                    {item.author_email && <div className="text-xs text-muted-foreground">{item.author_email}</div>}
                  </div>
                  {!readOnly && (
                    <Button size="sm" variant="ghost" onClick={() => remove(item.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{item.note}</p>
                <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
