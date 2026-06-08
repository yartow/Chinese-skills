import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authenticatedFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import type { Message, User } from "@shared/schema";

type SafeUser = Omit<User, "passwordHash">;

interface ConversationPreview {
  partnerId: string;
  partner: SafeUser;
  lastMessage: Message | null;
  unreadCount: number;
}

function displayName(u: SafeUser) {
  if (u.firstName) return [u.firstName, u.lastName].filter(Boolean).join(" ");
  return u.email ?? u.id;
}

function timeLabel(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function MessageBody({ body }: { body: string }) {
  const [, setLocation] = useLocation();
  const parts = body.split(/(\/checkup\/\d+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\/checkup\/\d+$/.test(part) ? (
          <button
            key={i}
            className="underline font-medium"
            onClick={() => setLocation(part)}
          >
            Open check-up
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ConversationView({
  partner,
  currentUserId,
  onBack,
}: {
  partner: SafeUser;
  currentUserId: string;
  onBack: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  const { data: msgs = [], refetch } = useQuery<Message[]>({
    queryKey: ["/api/messages/conversation", partner.id],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/messages/conversation/${partner.id}`);
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 0,
  });

  // Mark as read when conversation opens and whenever new messages arrive
  useEffect(() => {
    authenticatedFetch(`/api/messages/conversation/${partner.id}/read`, { method: "POST" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      })
      .catch(() => {});
  }, [msgs.length, partner.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest("POST", `/api/messages/conversation/${partner.id}`, { body }),
    onSuccess: () => {
      setText("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
  });

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 pb-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <p className="font-semibold">{displayName(partner)}</p>
          {partner.firstName && (
            <p className="text-xs text-muted-foreground">{partner.email}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {msgs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Say hello!
          </p>
        )}
        {msgs.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                <MessageBody body={m.body} />
                <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>
                  {timeLabel(m.sentAt!)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [openPartner, setOpenPartner] = useState<SafeUser | null>(null);

  const { data: conversations = [], isLoading } = useQuery<ConversationPreview[]>({
    queryKey: ["/api/messages/conversations"],
    queryFn: async () => {
      const res = await authenticatedFetch("/api/messages/conversations");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 0,
  });

  if (openPartner) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <ConversationView
          partner={openPartner}
          currentUserId={(user as any)?.id ?? ""}
          onBack={() => setOpenPartner(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No conversations yet.</p>
      ) : (
        <ul className="divide-y border rounded-lg overflow-hidden">
          {conversations.map((c) => (
            <li key={c.partnerId}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                onClick={() => setOpenPartner(c.partner)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("font-medium truncate", c.unreadCount > 0 && "font-semibold")}>
                      {displayName(c.partner)}
                    </span>
                    {c.lastMessage && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeLabel(c.lastMessage.sentAt!)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.lastMessage?.body ?? "No messages yet"}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
