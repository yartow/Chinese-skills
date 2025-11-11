import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthPage from "./pages/auth";
import HomePage from "./pages/home";
import CharacterDetailView from "./components/CharacterDetailView";
import TestMode from "./components/TestMode";
import NotFound from "./pages/not-found";
import { Button } from "./components/ui/button";
import { Home, FlaskConical, BookOpen } from "lucide-react";

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTraditional, setIsTraditional] = useState(false);
  const [location, setLocation] = useLocation();

  const mockCharacterData = {
    simplified: "学",
    traditional: "學",
    pinyin: "xué",
    radical: "子",
    radicalPinyin: "zǐ",
    definition: ["to study", "to learn", "school", "knowledge"],
    examples: [
      { chinese: "我在学习中文。", english: "I am studying Chinese." },
      { chinese: "他是一个好学生。", english: "He is a good student." },
      { chinese: "这所学校很大。", english: "This school is very large." },
      { chinese: "学无止境。", english: "Learning is endless." },
      { chinese: "我们要好好学习。", english: "We should study hard." },
    ],
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Switch>
        <Route path="/">
          <HomePage
            onCharacterClick={(id) => setLocation(`/character/${id}`)}
            onLogout={() => setIsAuthenticated(false)}
          />
        </Route>
        <Route path="/character/:id">
          <CharacterDetailView
            character={mockCharacterData}
            onBack={() => setLocation("/")}
            isTraditional={isTraditional}
            onToggleScript={setIsTraditional}
          />
        </Route>
        <Route path="/test">
          <TestMode onStartTest={(type, index) => console.log(`Test: ${type} at ${index}`)} />
        </Route>
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
            <Home className="w-4 h-4" />
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
