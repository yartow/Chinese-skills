// Replit Auth integration - blueprint:javascript_log_in_with_replit
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "./pages/landing";
import Home from "./pages/home-connected";
import CharacterDetail from "./pages/character-detail";
import TestModePage from "./pages/test-mode-page";
import NotFound from "./pages/not-found";
import { Button } from "./components/ui/button";
import { Home as HomeIcon, FlaskConical } from "lucide-react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/character/:id" component={CharacterDetail} />
        <Route path="/test" component={TestModePage} />
        <Route component={NotFound} />
      </Switch>

      <nav className="border-t mt-auto">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-center gap-2">
          <Button
            variant={location === "/" ? "default" : "ghost"}
            onClick={() => setLocation("/")}
            className="gap-2"
            data-testid="nav-home"
          >
            <HomeIcon className="w-4 h-4" />
            Home
          </Button>
          <Button
            variant={location === "/test" ? "default" : "ghost"}
            onClick={() => setLocation("/test")}
            className="gap-2"
            data-testid="nav-test"
          >
            <FlaskConical className="w-4 h-4" />
            Test Mode
          </Button>
        </div>
      </nav>
    </div>
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
