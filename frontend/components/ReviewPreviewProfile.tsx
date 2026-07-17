"use client";
import { ArrowUpRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    // biome-ignore lint/a11y/noStaticElementInteractions: role="button" and tabIndex are set whenever handlers are attached
    <div
      className={cn(
        "group flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left",
        isClickable &&
          "cursor-pointer outline-none transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:border-primary-light/40",
      )}
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
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium capitalize text-foreground">
          {props.courseTitle ?? props.courseCode}
        </span>
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          {props.courseCode}
        </Badge>
      </div>
      {previewText && (
        <p className="line-clamp-2 wrap-break-word text-sm text-muted-foreground">
          {previewText}
        </p>
      )}
      <div className="mt-1 flex items-center gap-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ThumbsUp
            className="size-3.5 text-green-600 dark:text-green-400"
            aria-hidden
          />
          {props.likeCount ?? 0}
          <span className="sr-only">likes</span>
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown
            className="size-3.5 text-red-600 dark:text-red-400"
            aria-hidden
          />
          {props.dislikeCount ?? 0}
          <span className="sr-only">dislikes</span>
        </span>
        {isClickable && (
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-primary-light">
            View course
            <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}
