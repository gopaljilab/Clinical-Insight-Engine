import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, User } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { AssessmentNote } from "@shared/schema";

interface NoteWithUser extends AssessmentNote {
  user: {
    fullName: string;
  };
}

interface CollaborativeNotesProps {
  assessmentId: number;
  section?: string;
}

export function CollaborativeNotes({ assessmentId, section = "general" }: CollaborativeNotesProps) {
  const [newNote, setNewNote] = useState("");
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Use a string key matching the format used in other query keys.
  // We use queryKey as an array, as required by TanStack query v5
  const queryKey = ["/api/assessments", assessmentId, "notes"];

  const { data: allNotes = [], isLoading } = useQuery<NoteWithUser[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/assessments/${assessmentId}/notes`);
      return res.json();
    },
  });

  const notes = allNotes.filter(n => n.section === section);

  useEffect(() => {
    // Scroll to bottom when notes change
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [notes.length]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/notes?assessmentId=${assessmentId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_note") {
          queryClient.setQueryData<NoteWithUser[]>(queryKey, (old) => {
            if (!old) return [data.note];
            // Check if note already exists to prevent duplicates from our own POST
            if (old.some(n => n.id === data.note.id)) return old;
            return [...old, data.note];
          });
        }
      } catch (err) {
        console.error("Error parsing WS message", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [assessmentId, queryClient, queryKey]);

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/assessments/${assessmentId}/notes`, {
        section,
        content,
      });
      return res.json();
    },
    onSuccess: (newNoteObj: NoteWithUser) => {
      setNewNote("");
      queryClient.setQueryData<NoteWithUser[]>(queryKey, (old) => {
        if (!old) return [newNoteObj];
        if (old.some(n => n.id === newNoteObj.id)) return old;
        return [...old, newNoteObj];
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || addNoteMutation.isPending) return;
    addNoteMutation.mutate(newNote.trim());
  };

  return (
    <Card className="flex flex-col h-[400px]">
      <CardHeader className="py-3 px-4 border-b bg-muted/30">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Collaborative Notes {section !== "general" && `- ${section}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No notes yet. Be the first to add a note.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm font-semibold">{note.user.fullName}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(note.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="pl-8 text-sm text-foreground/90 whitespace-pre-wrap">
                    {note.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t bg-muted/10">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a contextual note..."
              className="min-h-[40px] h-[40px] py-2 resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!newNote.trim() || addNoteMutation.isPending}
              className="shrink-0 h-[40px] w-[40px]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
