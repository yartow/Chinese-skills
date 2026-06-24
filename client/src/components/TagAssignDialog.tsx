import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Check, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CharacterTag {
  id: number;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIndices: number[];
}

export default function TagAssignDialog({ open, onOpenChange, selectedIndices }: Props) {
  const [newTagName, setNewTagName] = useState("");
  const [assignedTagIds, setAssignedTagIds] = useState<Set<number>>(new Set());

  const { data: tags = [] } = useQuery<CharacterTag[]>({
    queryKey: ["/api/tags"],
  });

  const createAndAssignMutation = useMutation({
    mutationFn: async (name: string) => {
      const tag: CharacterTag = await apiRequest("POST", "/api/tags", { name }).then(r => r.json());
      await apiRequest("POST", `/api/tags/${tag.id}/characters`, { characterIndices: selectedIndices });
      return tag;
    },
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setAssignedTagIds(prev => new Set([...prev, tag.id]));
      setNewTagName("");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (tagId: number) => {
      await apiRequest("POST", `/api/tags/${tagId}/characters`, { characterIndices: selectedIndices });
      return tagId;
    },
    onSuccess: (tagId) => {
      setAssignedTagIds(prev => new Set([...prev, tagId]));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tagId: number) => {
      await apiRequest("DELETE", `/api/tags/${tagId}`);
      return tagId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
  });

  function handleCreateAndAssign() {
    const name = newTagName.trim();
    if (!name) return;
    createAndAssignMutation.mutate(name);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign tag to {selectedIndices.length} character{selectedIndices.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Create new tag:</p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Difficult, Rare…"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateAndAssign()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleCreateAndAssign}
                disabled={!newTagName.trim() || createAndAssignMutation.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Existing tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Assign to existing tag:</p>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const assigned = assignedTagIds.has(tag.id);
                  return (
                    <div key={tag.id} className="flex items-center gap-1">
                      <button
                        onClick={() => !assigned && assignMutation.mutate(tag.id)}
                        disabled={assigned || assignMutation.isPending}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                          ${assigned
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary hover:text-primary"
                          }`}
                      >
                        {assigned && <Check className="w-3 h-3" />}
                        {tag.name}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(tag.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                        title={`Delete tag "${tag.name}"`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags yet. Create one above.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
