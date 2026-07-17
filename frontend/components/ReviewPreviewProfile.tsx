"use client";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ReviewPreviewProps = {
  courseCode: string;
  courseTitle?: string;
  content: string;
  likeCount?: number;
  dislikeCount?: number;
  onClickReview?: () => void;
};

export function ReviewPreview(props: Readonly<ReviewPreviewProps>) {
  const previewText = props.content.replace(/<[^>]*>/g, " ").trim();

  const isClickable = Boolean(props.onClickReview);

  return (
    <Card
      className={
        isClickable
          ? "relative mx-auto max-w-sm rounded-sm cursor-pointer shadow-none transition-colors hover:bg-muted/40"
          : "relative mx-auto max-w-sm rounded-sm shadow-none"
      }
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={props.onClickReview}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          props.onClickReview?.();
        }
      }}
    >
      <CardHeader>
        <CardTitle className="text-sm">
          {props.courseTitle ?? props.courseCode}
        </CardTitle>
        <CardAction>
          <p className="text-muted-foreground text-sm text-right">
            {props.courseCode}
          </p>
        </CardAction>
        <CardDescription className="min-w-0 truncate">
          {previewText}
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-3 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <ThumbsUp className="size-3" />
          {props.likeCount ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown className="size-3" />
          {props.dislikeCount ?? 0}
        </span>
      </CardFooter>
    </Card>
  );
}
