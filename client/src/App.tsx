// Replit Auth integration - blueprint:javascript_log_in_with_replit
import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "./pages/landing";
import AuthPage from "./pages/auth";
import Home from "./pages/home-connected";
import CharacterDetail from "./pages/character-detail";
import TestModePage from "./pages/test-mode-page";
import StandardMode from "./pages/standard-mode";
import WordsMode from "./pages/words-mode";
import Search from "./pages/search";
import CharacterBrowserPage from "./pages/character-browser-page";
import Saved from "./pages/saved";
import NotFound from "./pages/not-found";
import TeacherPage from "./pages/teacher";
import MessagesPage from "./pages/messages";
import OnboardingPage from "./pages/onboarding";
import CustomizePage from "./pages/customize";
import CustomizeMatchPage from "./pages/customize-match";
import CheckupPage from "./pages/checkup";
import CheckupCreatePage from "./pages/checkup-create";
import SettingsPage from "./pages/settings";
import AppShell from "./components/layout/AppShell";
import CommandPalette from "./components/CommandPalette";
import TutorialOverlay from "./components/TutorialOverlay";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "./lib/queryClient";

function useIsOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return isOnline;
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const isOnline = useIsOnline();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: relationships = [] } = useQuery<{ id: number }[]>({
    queryKey: ["/api/relationships"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });
  const [tutorialVisible, setTutorialVisible] = useState(
    () => localStorage.getItem("tutorialSeen") !== "1"
  );

  useEffect(() => {
    const handler = () => setTutorialVisible(true);
    window.addEventListener("replayTutorial", handler);
    return () => window.removeEventListener("replayTutorial", handler);
  }, []);

  const role = (user as any)?.role;

  useEffect(() => {
    if (!isLoading && isAuthenticated && location === '/auth') {
      setLocation('/');
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && role === 'user' && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [isLoading, isAuthenticated, role, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return location === '/auth' ? <AuthPage /> : <Landing />;
  }

  if (location === '/auth' || (role === 'user' && location !== '/onboarding')) {
    return null;
  }

  if (location === '/onboarding') {
    return <OnboardingPage />;
  }

  const studentHasTeacher = role === 'student' && relationships.length > 0;
  const showCustomize = role === 'teacher' || role === 'solo' || role === 'admin' || studentHasTeacher;

  return (
    <AppShell role={role} unreadCount={unreadCount} showCustomize={showCustomize} user={user}>
      <CommandPalette />
      {!isOnline && (
        <div className="bg-yellow-500 text-yellow-950 text-center text-sm py-1.5 px-4 font-medium">
          You are offline — changes may not be saved until you reconnect.
        </div>
      )}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/standard" component={StandardMode} />
        <Route path="/words" component={WordsMode} />
        <Route path="/search" component={Search} />
        <Route path="/character/:id" component={CharacterDetail} />
        <Route path="/test" component={TestModePage} />
        <Route path="/browse" component={CharacterBrowserPage} />
        <Route path="/saved" component={Saved} />
        <Route path="/teacher" component={TeacherPage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/checkup/create" component={CheckupCreatePage} />
        <Route path="/checkup/:id" component={CheckupPage} />
        <Route path="/customize/match" component={CustomizeMatchPage} />
        <Route path="/customize" component={CustomizePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
      <TutorialOverlay
        visible={tutorialVisible}
        onDismiss={() => setTutorialVisible(false)}
      />
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
