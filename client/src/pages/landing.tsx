import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Star, Target } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold font-chinese">汉字学习</h1>
          <p className="text-3xl text-muted-foreground">Chinese Character Learning</p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Master 2500 of the most common Chinese characters with structured learning,
            progress tracking, and intelligent testing modes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <BookOpen className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Structured Learning</CardTitle>
              <CardDescription>
                Learn characters in order of frequency with detailed stroke order,
                pinyin, radicals, and example sentences.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Star className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Track Progress</CardTitle>
              <CardDescription>
                Mark your knowledge of reading, writing, and radicals for each character.
                Your progress is saved automatically.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Target className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Test Yourself</CardTitle>
              <CardDescription>
                Practice with three test modes: pronunciation, writing, and radical recognition.
                Start from any level.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="text-center">
          <Button
            onClick={handleLogin}
            size="lg"
            className="text-lg px-8"
            data-testid="button-get-started"
          >
            Get Started
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Sign in with Google or create an account to begin your journey
          </p>
        </div>
      </div>
    </div>
  );
}
