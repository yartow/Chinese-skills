import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SettingsPanel from "@/components/SettingsPanel";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";

type UserSettingsResponse = Omit<UserSettings, "anthropicApiKey"> & { anthropicApiKeySet: boolean };

export default function SettingsPage() {
  const { user } = useAuth();
  const typedUser = user as { id?: string; firstName?: string; lastName?: string; email?: string; profileImageUrl?: string; role?: string } | null | undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFirstName(typedUser?.firstName ?? "");
    setLastName(typedUser?.lastName ?? "");
    setEmail(typedUser?.email ?? "");
  }, [typedUser?.firstName, typedUser?.lastName, typedUser?.email]);

  const { data: settings } = useQuery<UserSettingsResponse>({ queryKey: ["/api/settings"] });
  const { data: appConfig } = useQuery<{ autoReloadDatabase: boolean }>({ queryKey: ["/api/app-config"] });

  const updateSettingsMutation = useMutation({
    mutationFn: (s: Partial<UserSettings>) => apiRequest("PATCH", "/api/settings", s),
    onMutate: (variables) => {
      const { anthropicApiKey, ...safeVars } = variables as Record<string, unknown>;
      queryClient.setQueryData<UserSettingsResponse>(["/api/settings"], (old) => {
        if (!old) return old;
        return { ...old, ...safeVars, ...(anthropicApiKey !== undefined ? { anthropicApiKeySet: true } : {}) };
      });
    },
  });

  const updateAppConfigMutation = useMutation({
    mutationFn: (c: { autoReloadDatabase: boolean }) => apiRequest("PATCH", "/api/app-config", c),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/app-config"] }),
  });

  const profileMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; email: string }) =>
      apiRequest("PATCH", "/api/user/profile", data),
    onSuccess: () => {
      setProfileSuccess(true);
      setProfileError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setProfileError(err.message.includes("409") ? "Email already in use by another account." : "Failed to save profile. Please try again.");
      setProfileSuccess(false);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const avatarUrl = typedUser?.profileImageUrl;
  const displayInitial = (typedUser?.firstName ?? typedUser?.email ?? "U")[0]?.toUpperCase();
  const isAdmin = typedUser?.role === "admin";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* ── Profile ── */}
      <Card className="p-6 space-y-5">
        <h2 className="text-base font-semibold">Profile</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center hover:opacity-80 transition-opacity group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="Upload profile photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold text-muted-foreground">{displayInitial}</span>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            {avatarMutation.isPending && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Profile photo</p>
            <p className="text-xs text-muted-foreground">Click to upload. Any image format accepted — resized to 256×256 on the server.</p>
            {avatarMutation.isError && (
              <p className="text-xs text-destructive">{(avatarMutation.error as Error).message}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                avatarMutation.mutate(file);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setProfileSuccess(false); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setProfileSuccess(false); }}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setProfileSuccess(false); }}
          />
        </div>

        {profileError && <p className="text-sm text-destructive">{profileError}</p>}
        {profileSuccess && <p className="text-sm text-green-600">Profile saved.</p>}

        <Button
          onClick={() => {
            setProfileError(null);
            profileMutation.mutate({ firstName, lastName, email });
          }}
          disabled={profileMutation.isPending}
        >
          {profileMutation.isPending ? "Saving…" : "Save profile"}
        </Button>
      </Card>

      {/* ── App settings ── */}
      <Card className="p-6">
        <h2 className="text-base font-semibold mb-4">App Settings</h2>
        <SettingsPanel
          currentLevel={settings?.currentLevel ?? 0}
          dailyCharCount={settings?.dailyCharCount ?? 5}
          standardModePageSize={settings?.standardModePageSize}
          useAiFeedback={settings?.useAiFeedback ?? false}
          useAiSentences={settings?.useAiSentences ?? false}
          aiGenerationMode={settings?.aiGenerationMode ?? false}
          anthropicApiKeySet={settings?.anthropicApiKeySet ?? false}
          handwritingCandidates={settings?.handwritingCandidates ?? 8}
          advancedEditMode={settings?.advancedEditMode ?? false}
          maxPointsPerChar={settings?.maxPointsPerChar ?? 10}
          autoReloadDatabase={appConfig?.autoReloadDatabase ?? true}
          onLevelChange={(level) => updateSettingsMutation.mutate({ currentLevel: level })}
          onDailyCharCountChange={(count) => updateSettingsMutation.mutate({ dailyCharCount: count })}
          onStandardModePageSizeChange={(size) => updateSettingsMutation.mutate({ standardModePageSize: size })}
          onUseAiFeedbackChange={(val) => updateSettingsMutation.mutate({ useAiFeedback: val })}
          onUseAiSentencesChange={(val) => updateSettingsMutation.mutate({ useAiSentences: val })}
          onAiGenerationModeChange={(val) => updateSettingsMutation.mutate({ aiGenerationMode: val })}
          onAnthropicApiKeyChange={(key) => updateSettingsMutation.mutate({ anthropicApiKey: key })}
          onHandwritingCandidatesChange={(val) => updateSettingsMutation.mutate({ handwritingCandidates: val })}
          onAdvancedEditModeChange={(val) => updateSettingsMutation.mutate({ advancedEditMode: val })}
          onMaxPointsPerCharChange={(val) => updateSettingsMutation.mutate({ maxPointsPerChar: val })}
          {...(isAdmin && {
            onAutoReloadDatabaseChange: (val) => updateAppConfigMutation.mutate({ autoReloadDatabase: val }),
          })}
        />
      </Card>
    </div>
  );
}
