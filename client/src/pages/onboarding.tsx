import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GraduationCap, BookOpen, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const roles = [
  {
    value: "student",
    icon: BookOpen,
    label: "Student",
    description: "I'm learning Chinese. My teacher will add me to their class.",
  },
  {
    value: "teacher",
    icon: GraduationCap,
    label: "Teacher",
    description: "I teach Chinese. I'll manage students, checkups, and character lists.",
  },
  {
    value: "solo",
    icon: User,
    label: "Solo",
    description: "I'm learning on my own. I don't have a teacher.",
  },
] as const;

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  // All hooks must come before any conditional returns.
  const roleMutation = useMutation({
    mutationFn: async (role: typeof roles[number]["value"]) => {
      const res = await apiRequest("PATCH", "/api/user/role", { role });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  useEffect(() => {
    if (!isLoading && user && (user as any).role !== "user") {
      setLocation("/");
    }
  }, [isLoading, user, setLocation]);

  if (!isLoading && user && (user as any).role !== "user") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome!</h1>
          <p className="text-muted-foreground">How will you be using this app?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {roles.map(({ value, icon: Icon, label, description }) => {
            const isSpinning = roleMutation.isPending && roleMutation.variables === value;
            return (
              <button
                key={value}
                onClick={() => roleMutation.mutate(value)}
                disabled={roleMutation.isPending}
                aria-busy={isSpinning ? "true" : undefined}
                className={cn(
                  "flex flex-col items-center gap-4 p-6 rounded-xl border-2 text-left transition-all",
                  "hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  roleMutation.variables === value
                    ? "border-primary bg-muted/50"
                    : "border-border bg-card",
                )}
              >
                {isSpinning
                  ? <Loader2 className="w-10 h-10 text-primary shrink-0 animate-spin" />
                  : <Icon className="w-10 h-10 text-primary shrink-0" />
                }
                <div className="space-y-1 text-center">
                  <p className="font-semibold text-base">{label}</p>
                  <p className="text-sm text-muted-foreground leading-snug">{description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {roleMutation.isError && (
          <p className="text-center text-sm text-destructive">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
