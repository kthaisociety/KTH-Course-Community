"use client";
import parse from "html-react-parser";
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
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import type { ExaminationDistribution, ReviewVoteType } from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
  MAX_REVIEW_SCORE,
} from "@/types";
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

function scoreVariant(score: number) {
  if (score >= 8) return "default" as const;
  if (score >= 5) return "outline" as const;
  return "destructive" as const;
}

type ScorePillProps = {
  name: string;
  score: number;
};

function ScorePill({ name, score }: Readonly<ScorePillProps>) {
  const aria = `${name}: ${score} out of ${MAX_REVIEW_SCORE}`;

  return (
    <div className="flex items-center gap-2" title={aria}>
      <span className="w-24 text-sm text-muted-foreground">{name}</span>
      <Badge variant={scoreVariant(score)}>
        {score}/{MAX_REVIEW_SCORE}
      </Badge>
    </div>
  );
}

type ApproachPillProps = {
  /** `null` when the reviewer did not remember. */
  percent: number | null;
};

function ApproachPill({ percent }: Readonly<ApproachPillProps>) {
  const aria =
    percent === null
      ? "Approach: reviewer did not remember"
      : `Approach: ${percent}% theory, ${100 - percent}% applied`;

  return (
    <div className="flex items-center gap-2" title={aria}>
      <span className="w-24 text-sm text-muted-foreground">Approach</span>
      <Badge variant={percent === null ? "secondary" : "outline"}>
        {percent === null ? "Not remembered" : `${percent}% theory`}
      </Badge>
    </div>
  );
}

type HappyTookChipProps = {
  happyTook: boolean;
};

function HappyTookChip(props: Readonly<HappyTookChipProps>) {
  const label = props.happyTook ? "Yes" : "No";
  const aria = `Glad they took it: ${label}`;
  return (
    <div className="flex items-center gap-2" title={aria}>
      <span className="w-24 text-sm text-muted-foreground">Glad they took</span>
      <Badge variant={props.happyTook ? "default" : "secondary"}>{label}</Badge>
    </div>
  );
}

type ExaminationSummaryProps = {
  /** `null` when the reviewer did not remember. */
  distribution: ExaminationDistribution | null;
};

function ExaminationSummary({
  distribution,
}: Readonly<ExaminationSummaryProps>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-sm text-muted-foreground">Examination</span>
      {distribution === null ? (
        <Badge variant="secondary">Not remembered</Badge>
      ) : (
        EXAMINATION_DISTRIBUTION_KEYS.filter(
          (key) => distribution[key] > 0,
        ).map((key) => (
          <Badge key={key} variant="outline">
            {EXAMINATION_DISTRIBUTION_LABELS[key]} {distribution[key]}%
          </Badge>
        ))
      )}
    </div>
  );
}

export type PostProps = {
  courseCode: string;
  examinationDistribution: ExaminationDistribution | null;
  approachTheoryPercent: number | null;
  workloadScore: number;
  learningScore: number;
  happyTook: boolean;
  message: string | null;
  upvoteCount?: number;
  downvoteCount?: number;
  userVote?: ReviewVoteType | null;
  postId?: string;
  /** Merged onto the outer `Card` (e.g. full-width on course detail). */
  className?: string;
};

export function Post(props: Readonly<PostProps>) {
  const { vote } = useReviewVotes(props.courseCode);

  const [expanded, setExpanded] = useState(false);
  const content = props.message ?? "";
  const isLong = content.length > MAX_COLLAPSED_CHARS;
  const displayContent =
    expanded || !isLong
      ? content
      : `${truncateHtmlAtWord(content, MAX_COLLAPSED_CHARS)}…`;

  return (
    <Card className={cn("w-[48rem] max-w-full", props.className)}>
      <CardHeader>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <ScorePill name="Workload" score={props.workloadScore} />
          <ScorePill name="Learning" score={props.learningScore} />
          <HappyTookChip happyTook={props.happyTook} />
          <ApproachPill percent={props.approachTheoryPercent} />
          <div className="md:col-span-2">
            <ExaminationSummary distribution={props.examinationDistribution} />
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent>
        <div className="prose prose-sm max-w-none md:prose-base">
          <div>{parse(sanitizeHtml(displayContent))}</div>
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
            upvoteCount={props.upvoteCount ?? 0}
            downvoteCount={props.downvoteCount ?? 0}
            userVote={props.userVote ?? null}
            onVote={vote}
          />
        </CardFooter>
      )}
    </Card>
  );
}
