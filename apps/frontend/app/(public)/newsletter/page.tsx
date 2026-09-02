"use client";

import { BookOpen, Briefcase, CalendarDays, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const issues = [
  {
    id: 1,
    title: "May 2025 – Course Tips & Exam Season",
    date: "May 1, 2025",
    category: "Study",
    description:
      "Top-rated courses this semester, exam preparation strategies shared by seniors, and a roundup of the best study spots on campus.",
    icon: BookOpen,
    highlight: true,
  },
  {
    id: 2,
    title: "April 2025 – Career Edition",
    date: "April 1, 2025",
    category: "Career",
    description:
      "Exclusive interviews with recent KTH graduates at top tech companies, summer internship deadlines, and CV workshop recap.",
    icon: Briefcase,
    highlight: false,
  },
  {
    id: 3,
    title: "March 2025 – Research Spotlight",
    date: "March 1, 2025",
    category: "Research",
    description:
      "Highlights from KTH's latest publications, a profile on the robotics lab, and thesis writing tips from PhD students.",
    icon: Lightbulb,
    highlight: false,
  },
  {
    id: 4,
    title: "February 2025 – Events & Community",
    date: "February 1, 2025",
    category: "Events",
    description:
      "Recap of the winter hackathon, upcoming spring events, and a spotlight on student nations and clubs.",
    icon: CalendarDays,
    highlight: false,
  },
];

export default function NewsletterPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-12 pt-32">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-4xl md:text-5xl font-bold">
                Newsletter
              </CardTitle>
              <CardDescription className="text-lg">
                Monthly updates on courses, careers, research, and community
                life at KTH.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-8">
              <Separator />

              {/* Subscribe section */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle>Subscribe to the newsletter</CardTitle>
                  <CardDescription>
                    Get the latest issue delivered to your inbox on the first of
                    every month. No spam, unsubscribe any time.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="flex flex-col sm:flex-row gap-3"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <Input
                      type="email"
                      placeholder="your@kth.se"
                      className="flex-1"
                    />
                    <Button type="submit">Subscribe</Button>
                  </form>
                </CardContent>
              </Card>

              {/* Past issues */}
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-6">
                  Past Issues
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  {issues.map((issue) => {
                    const Icon = issue.icon;
                    return (
                      <Card
                        key={issue.id}
                        className={
                          issue.highlight ? "border-primary/40 shadow-md" : ""
                        }
                      >
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                              <Icon className="size-5" />
                            </span>
                            <div className="flex flex-col gap-1">
                              <CardTitle className="text-base leading-snug">
                                {issue.title}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {issue.date}
                                </span>
                                <Badge variant="secondary">
                                  {issue.category}
                                </Badge>
                                {issue.highlight && (
                                  <Badge variant="default">Latest</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <CardDescription className="mt-2">
                            {issue.description}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter>
                          <Button variant="outline" size="sm">
                            Read issue
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
