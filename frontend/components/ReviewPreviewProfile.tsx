"use client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

type ReviewPreviewProps = {
  courseCode: string;
  content: string;
  easyScore: number;
  usefulScore: number;
  interestingScore: number;
  wouldRecommend: boolean;
};

export function ReviewPreview(props: Readonly<ReviewPreviewProps>) {
  // Function to strip HTML tags from text
  const stripHtmlTags = (html: string): string => {
    return html.replace(/<[^>]*>/g, " ");
  };

  const averageScore =
    (props.easyScore + props.usefulScore + props.interestingScore) / 3;

  return (
    <Card className="relative mx-auto w-full max-w-sm shadow-none">
      <CardHeader>
        <CardTitle>{props.courseCode}</CardTitle>
        <CardAction>
          <p className="text-muted-foreground text-sm">
            {averageScore.toFixed(1) + " / 5"}
          </p>
        </CardAction>
        <CardDescription>{stripHtmlTags(props.content)}</CardDescription>
      </CardHeader>
    </Card>
  );
}
