"use client";

import {
  Bookmark,
  CheckCircle,
  FolderPlus,
  Heart,
  MessageSquare,
} from "lucide-react";
import type { MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  CourseCardChartData,
  CourseCardStats,
} from "@/data/courseCardMockData";
import {
  getFallbackSummary,
  getFallbackTitle,
} from "@/data/courseCardMockData";
import { cn } from "@/lib/utils";
import { CourseCardCharts } from "./course-card-charts";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  const t = text.trim();
  if (t.length <= maxLength) return t;
  return `${t.slice(0, maxLength)}…`;
}

export type CourseCardWithChartsProps = {
  title: string;
  summary: string;
  courseCode: string;
  department: string;
  /** Högskolepoäng (credits), shown before course code on the subtitle line */
  hp: number | null;
  keywords: string;
  prerequisites: string[];
  chartData: CourseCardChartData;
  stats: CourseCardStats;
  isUserFavorite: boolean;
  isSelected?: boolean;
  onCardClick: () => void;
  onWriteReview: () => void;
  onToggleFavorite: () => void;
  onAddToCollection: () => void;
  onRecommend?: () => void;
  onMarkAsTaken?: () => void;
};

/** Keep action buttons' clicks from bubbling up to the card's onClick. */
function stop<T>(handler: () => T) {
  return (e: MouseEvent) => {
    e.stopPropagation();
    handler();
  };
}

export function CourseCardWithCharts({
  title,
  summary,
  courseCode,
  department,
  hp,
  keywords,
  prerequisites,
  chartData,
  stats,
  isUserFavorite,
  isSelected = false,
  onCardClick,
  onToggleFavorite,
  onAddToCollection,
  onWriteReview,
  onRecommend,
  onMarkAsTaken,
}: CourseCardWithChartsProps) {
  const displayTitle = title?.trim() || getFallbackTitle(courseCode);
  const displayDepartment = department?.trim() || "—";
  const displayHp = typeof hp === "number" && Number.isFinite(hp) ? hp : null;
  const displayHpText =
    displayHp === null
      ? "—"
      : Number.isInteger(displayHp)
        ? String(displayHp)
        : displayHp.toFixed(1);
  const displayKeywords = keywords?.trim() || "—";
  const displayPrerequisites =
    Array.isArray(prerequisites) && prerequisites.length > 0
      ? prerequisites
      : ["None"];
  const displaySummary = summary?.trim()
    ? truncate(stripHtml(summary), 180)
    : getFallbackSummary();

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      aria-pressed={isSelected}
      className={cn(
        "h-[280px] min-h-[280px] cursor-pointer flex-row gap-0 p-0 hover:bg-muted/20",
        isSelected && "ring-primary",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <CardHeader className="p-0">
          <CardTitle className="capitalize">{displayTitle}</CardTitle>
          <CardDescription>
            {displayHpText} hp · {courseCode}
            {displayDepartment !== "—" && ` · ${displayDepartment}`}
          </CardDescription>
          <CardAction>
            <ButtonGroup>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRecommend ? stop(onRecommend) : undefined}
                aria-label="Recommend this course"
                title="Recommend this course"
              >
                <Heart />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMarkAsTaken ? stop(onMarkAsTaken) : undefined}
                aria-label="Mark as taken"
                title="Mark as taken"
              >
                <CheckCircle />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={stop(onToggleFavorite)}
                aria-label={
                  isUserFavorite ? "Remove from saved" : "Save course"
                }
                title={isUserFavorite ? "Remove from saved" : "Save course"}
              >
                <Bookmark className={cn(isUserFavorite && "fill-primary")} />
              </Button>
            </ButtonGroup>
          </CardAction>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
          <div className="flex shrink-0 gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Keywords
              </p>
              <div className="flex flex-wrap gap-1">
                {displayKeywords
                  .split(/,\s*/)
                  .filter(Boolean)
                  .map((kw) => (
                    <Badge key={kw} variant="secondary">
                      {kw.trim()}
                    </Badge>
                  ))}
              </div>
            </div>
            <Separator orientation="vertical" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Prerequisites
              </p>
              <div className="flex flex-wrap gap-1">
                {displayPrerequisites.map((item) => (
                  <Badge key={item} variant="outline">
                    <CheckCircle data-icon="inline-start" />
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {displaySummary}
            </p>
          </div>

          <Button
            size="sm"
            className="mt-auto w-fit"
            onClick={stop(onWriteReview)}
          >
            <MessageSquare data-icon="inline-start" />
            Write a review
          </Button>
        </CardContent>
      </div>

      <Separator orientation="vertical" />

      <div className="flex h-full min-h-0 w-[232px] shrink-0 flex-col justify-between bg-muted/30 px-5 py-5">
        <div className="shrink-0">
          <CourseCardCharts data={chartData} />
        </div>
        <div className="flex w-full shrink-0 items-center justify-center gap-x-4 text-xs leading-none text-muted-foreground">
          <span
            className="flex shrink-0 items-center gap-0.5"
            title="Recommended by"
          >
            <Heart className="size-4" aria-hidden />
            <span>{stats.recommendCount}</span>
          </span>
          <span
            className="flex shrink-0 items-center gap-0.5"
            title="Students taken"
          >
            <CheckCircle className="size-4" aria-hidden />
            <span>{stats.studentsTaken}</span>
          </span>
          <span
            className="flex shrink-0 items-center gap-0.5"
            title="Number of reviews"
          >
            <MessageSquare className="size-4" aria-hidden />
            <span>{stats.reviewCount}</span>
          </span>
        </div>
        <div className="flex shrink-0 justify-center">
          <Button variant="outline" size="sm" onClick={stop(onAddToCollection)}>
            <FolderPlus data-icon="inline-start" />
            Add to collection
          </Button>
        </div>
      </div>
    </Card>
  );
}
