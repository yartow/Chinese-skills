import { useQuery, useMutation } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SavedItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Saved() {
  const { data: savedItems = [], isLoading } = useQuery<SavedItem[]>({
    queryKey: ["/api/saved"],
  });

  const toggleSaveMutation = useMutation({
    mutationFn: (item: { type: string; chinese: string; pinyin: string; english: string }) =>
      apiRequest("POST", "/api/saved/toggle", item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Saved</h1>

      {savedItems.length === 0 ? (
        <p className="text-muted-foreground">
          No saved items yet. Tap the <Heart className="inline w-4 h-4" /> next to any word or sentence to save it here.
        </p>
      ) : (
        <div className="space-y-3">
          {savedItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1">
                  <p className="text-lg font-chinese break-all">{item.chinese}</p>
                  {item.pinyin && (
                    <p className="text-sm text-muted-foreground">{item.pinyin}</p>
                  )}
                  <p className="text-sm">{item.english}</p>
                </div>
                <button
                  onClick={() =>
                    toggleSaveMutation.mutate({
                      type: item.type,
                      chinese: item.chinese,
                      pinyin: item.pinyin,
                      english: item.english,
                    })
                  }
                  className="shrink-0 p-1 rounded hover:bg-muted"
                  aria-label="Unsave"
                >
                  <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
