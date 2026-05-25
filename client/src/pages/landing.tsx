import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, PenLine, Star } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="樂吃玩 — Learn Chinese with Andrew" className="h-28 w-auto mx-auto" />
          <h1 className="text-3xl font-bold">樂吃玩</h1>
          <p className="text-xl text-muted-foreground">Learn Chinese with Andrew</p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build your Chinese vocabulary by browsing 2500 characters, practising with
            five quiz modes, and tracking your reading, writing, and radical mastery —
            in simplified or traditional script.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <BookOpen className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Browse Characters & Words</CardTitle>
              <CardDescription>
                Explore 2500 characters with pinyin, stroke order, radicals, and
                example sentences. Switch between simplified and traditional at any time.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <PenLine className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Five Quiz Modes</CardTitle>
              <CardDescription>
                Test yourself with multiple choice, fill-in-blank, handwriting,
                stroke order, and vocabulary quizzes — at whatever level you're at.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Star className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Track Your Mastery</CardTitle>
              <CardDescription>
                Mark reading, writing, and radical knowledge separately for each
                character. Filter and focus on exactly what you still need to learn.
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
            Sign in or create an account to begin your journey
          </p>
        </div>
      </div>
    </div>
  );
}
