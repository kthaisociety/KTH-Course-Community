"use client";
import parse from "html-react-parser";
import DOMPurify from "isomorphic-dompurify";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useReviewVotes } from "../hooks/use-review-votes";
import PostActionBar from "./post-action-bar";

const MAX_COLLAPSED_CHARS = 280;

function truncateHtmlAtWord(html: string, max: number) {
  if (html.length <= max) return html;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  const textContent = tempDiv.textContent || "";
  if (textContent.length <= max) return html;

  const slice = textContent.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const truncateAt = lastSpace > 0 ? lastSpace : max;

  let currentLength = 0;
  let result = "";

  function processNode(node: Node): boolean {
    if (currentLength >= truncateAt) return false;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (currentLength + text.length <= truncateAt) {
        result += text;
        currentLength += text.length;
        return true;
      }
      const remaining = truncateAt - currentLength;
      result += text.slice(0, remaining);
      currentLength = truncateAt;
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      result += `<${tagName}`;

      for (const attr of Array.from(element.attributes)) {
        result += ` ${attr.name}="${attr.value}"`;
      }
      result += ">";

      for (const child of Array.from(element.childNodes)) {
        if (!processNode(child)) {
          break;
        }
      }

      result += `</${tagName}>`;
      return currentLength < truncateAt;
    }

    return true;
  }

  for (const child of Array.from(tempDiv.childNodes)) {
    if (!processNode(child)) {
      break;
    }
  }

  return result;
}

function normalizeRating(r: number | undefined | null) {
  if (typeof r !== "number" || Number.isNaN(r)) return null;
  return Math.min(5, Math.max(0, Math.round(r)));
}

function ratingLabel(rating: number | null) {
  if (rating === null) return "N/A";
  if (rating >= 5) return "Excellent";
  if (rating >= 4) return "Good";
  if (rating >= 3) return "Average";
  if (rating >= 2) return "Poor";
  if (rating >= 1) return "Bad";
  return "Terrible";
}

function ratingVariant(rating: number | null) {
  if (rating === null) return "secondary" as const;
  if (rating >= 4) return "default" as const;
  if (rating >= 3) return "outline" as const;
  return "destructive" as const;
}

type RatingPillProps = {
  name: string;
  rating: number | null;
};

function RatingPill({ name, rating }: Readonly<RatingPillProps>) {
  const label = ratingLabel(rating);
  const value = rating ?? "-";
  const aria =
    rating === null
      ? `${name}: not available`
      : `${name}: ${value} out of 5 (${label})`;

  return (
    <div className="flex items-center gap-2" title={aria}>
      <span className="w-20 text-sm text-muted-foreground">{name}</span>
      <Badge variant={ratingVariant(rating)}>{value}</Badge>
    </div>
  );
}

type RecommendChipProps = {
  wouldRecommend: boolean;
};

function RecommendChip(props: Readonly<RecommendChipProps>) {
  const label = props.wouldRecommend ? "Yes" : "No";
  const aria = `Would recommend: ${label}`;
  return (
    <div className="flex items-center gap-2" title={aria}>
      <span className="w-20 text-sm text-muted-foreground">Recommend</span>
      <Badge variant={props.wouldRecommend ? "default" : "secondary"}>
        {label}
      </Badge>
    </div>
  );
}

export type PostProps = {
  courseCode: string;
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  content: string;
  likeCount?: number;
  dislikeCount?: number;
  userVote?: "like" | "dislike" | null;
  postId?: string;
  /** Merged onto the outer `Card` (e.g. full-width on course detail). */
  className?: string;
};

export function Post(props: Readonly<PostProps>) {
  const examinationMethods = normalizeRating(props.examinationMethods);
  const theoreticalVsApplied = normalizeRating(props.theoreticalVsApplied);
  const workload = normalizeRating(props.workload);
  const learningExperience = normalizeRating(props.learningExperience);
  const { like, dislike } = useReviewVotes(props.courseCode);

  const [expanded, setExpanded] = useState(false);
  const content = props.content ?? "";
  const isLong = content.length > MAX_COLLAPSED_CHARS;
  const displayContent =
    expanded || !isLong
      ? content
      : `${truncateHtmlAtWord(content, MAX_COLLAPSED_CHARS)}…`;

  return (
    <Card className={cn("w-[48rem] max-w-full", props.className)}>
      <CardHeader>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
          <RatingPill name="Exam methods" rating={examinationMethods} />
          <RatingPill name="Theory vs applied" rating={theoreticalVsApplied} />
          <RatingPill name="Workload" rating={workload} />
          <RatingPill name="Learning exp." rating={learningExperience} />
          <RecommendChip wouldRecommend={props.wouldRecommend} />
        </div>
      </CardHeader>

      <Separator />

      <CardContent>
        <div className="prose prose-sm max-w-none md:prose-base">
          <div>{parse(DOMPurify.sanitize(displayContent))}</div>
          {isLong && (
            <Button
              variant="link"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Read more"}
            </Button>
          )}
        </div>
      </CardContent>

      {props.postId && (
        <CardFooter className="justify-end">
          <PostActionBar
            postId={props.postId}
            likeCount={props.likeCount || 0}
            dislikeCount={props.dislikeCount || 0}
            userVote={props.userVote || null}
            onPostLike={like}
            onPostDislike={dislike}
          />
        </CardFooter>
      )}
    </Card>
  );
}
