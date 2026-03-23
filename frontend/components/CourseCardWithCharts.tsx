"use client";

import {
  MessageSquare,
  Heart,
  CheckCircle,
  Sparkles,
  Bookmark,
  Star,
} from "lucide-react";
import {
  getFallbackSummary,
  getFallbackTitle,
} from "@/data/courseCardMockData";
import type {
  CourseCardChartData,
  CourseCardStats,
} from "@/data/courseCardMockData";
import { Button } from "@/components/ui/button";
import { CourseCardCharts } from "@/components/CourseCardCharts";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxLength: number): string {
  const t = text.trim();
  if (t.length <= maxLength) return t;
  return t.slice(0, maxLength) + "…";
}

export type CourseCardWithChartsProps = {
  title: string;
  goals: string;
  /** Full course text (kept for detail flows; not shown on the card). */
  content: string;
  /** Short summary shown on the card under “Summary”. */
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
  onSeeReviews: () => void;
  onWriteReview: () => void;
  onToggleFavorite: () => void;
  onAddToComparison: () => void;
  onRecommend?: () => void;
  onMarkAsTaken?: () => void;
};

export function CourseCardWithCharts({
  title,
  goals,
  content: _content,
  summary,
  courseCode,
  department,
  hp,
  keywords,
  prerequisites,
  chartData,
  stats,
  isUserFavorite,
  onSeeReviews,
  onToggleFavorite,
  onAddToComparison,
  onWriteReview,
  onRecommend,
  onMarkAsTaken,
}: CourseCardWithChartsProps) {
  const displayTitle = title?.trim() || getFallbackTitle(courseCode);
  const displayDepartment = department?.trim() || "—";
  const displayHp =
    typeof hp === "number" && Number.isFinite(hp) ? hp : null;
  const displayHpText =
    displayHp === null
      ? "—"
      : Number.isInteger(displayHp)
        ? String(displayHp)
        : displayHp.toFixed(1);
  const displayKeywords = keywords?.trim() || "—";
  const displayPrerequisites = Array.isArray(prerequisites) && prerequisites.length > 0 ? prerequisites : ["None"];
  const displayAverageRating = Math.min(
    5,
    Math.max(0, Number(stats.averageRating) || 0),
  );
  const displaySummary = summary?.trim()
    ? truncate(stripHtml(summary), 180)
    : getFallbackSummary();

  return (
    <div className="flex h-[280px] min-h-[280px] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Left: title, keywords+prerequisites area, summary, see details */}
      <div className="flex flex-1 min-w-0 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-tight capitalize">
              {displayTitle}
            </h3>
            <p className="text-muted-foreground text-sm mt-0.5">
              {displayHpText} hp · {courseCode}
              {displayDepartment !== "—" && ` · ${displayDepartment}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Course actions">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRecommend}
              className="h-9 w-9 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label="Recommend this course"
              title="Recommend this course"
            >
              <Heart className="h-6 w-6 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMarkAsTaken}
              className="h-9 w-9 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label="Mark as taken"
              title="Mark as taken"
            >
              <CheckCircle className="h-6 w-6 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className="h-9 w-9 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label={isUserFavorite ? "Remove from saved" : "Save course"}
              title={isUserFavorite ? "Remove from saved" : "Save course"}
            >
              <Bookmark
                className={`h-6 w-6 shrink-0 ${Boolean(isUserFavorite) ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </Button>
          </div>
        </div>

        {/* Dedicated area: two columns — keywords | prerequisites (both horizontal) */}
        <div className="flex shrink-0 gap-4 px-0 py-1.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Keywords
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0 text-muted-foreground text-sm leading-snug">
              {displayKeywords.split(/,\s*/).filter(Boolean).map((kw) => (
                <span key={kw} className="shrink-0" title={kw.trim()}>
                  {kw.trim()}
                </span>
              ))}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col border-l border-border/60 pl-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Prerequisites
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-sm">
              {displayPrerequisites.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 shrink-0"
                  title={item}
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Summary (same typography as keywords/prerequisites); full content lives in props for detail views */}
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Summary
          </p>
          <p className="text-muted-foreground text-sm leading-snug line-clamp-2 min-h-0">
            {displaySummary}
          </p>
        </div>
        <div className="mt-auto flex shrink-0 flex-wrap items-center gap-2 pt-2.5">
          <Button
            size="sm"
            className="h-9 w-fit gap-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onWriteReview}
          >
            <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
            Write a review
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-fit text-sm"
            onClick={onSeeReviews}
          >
            See Course Details
          </Button>
        </div>
      </div>

      {/* Right: charts, stats, compare — padding matches card (p-4); space distributed evenly */}
      <div className="flex h-full min-h-0 w-[232px] shrink-0 flex-col justify-between border-l border-border bg-muted/30 px-5 py-5">
        <div className="shrink-0">
          <CourseCardCharts data={chartData} />
        </div>
        <div
          className="flex shrink-0 flex-nowrap items-center justify-center gap-x-3.5 gap-y-0 text-muted-foreground text-xs leading-none cursor-default select-none"
          role="status"
          aria-label="Course stats: reviews, recommendations, students taken, average rating"
        >
          <span className="flex shrink-0 items-center gap-0.5" title="Number of reviews">
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{stats.reviewCount}</span>
          </span>
          <span
            className="flex shrink-0 items-center gap-0.5"
            title="Recommended by"
          >
            <Heart className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{stats.recommendCount}</span>
          </span>
          <span
            className="flex shrink-0 items-center gap-0.5"
            title="Students taken"
          >
            <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{stats.studentsTaken}</span>
          </span>
          <span
            className="flex shrink-0 items-center gap-0.5"
            title="Average rating"
          >
            <Star className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{displayAverageRating.toFixed(1)}/5</span>
          </span>
        </div>
        <div className="flex shrink-0 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddToComparison}
            className="h-9 gap-1.5 text-sm"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Compare
          </Button>
        </div>
      </div>
    </div>
  );
}
