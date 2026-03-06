"use client";

import { MessageSquare, Heart, CheckCircle, Sparkles, Bookmark } from "lucide-react";
import {
  getFallbackContent,
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
  content: string;
  courseCode: string;
  department: string;
  keywords: string;
  prerequisites: string[];
  chartData: CourseCardChartData;
  stats: CourseCardStats;
  isUserFavorite: boolean;
  onSeeReviews: () => void;
  onToggleFavorite: () => void;
  onAddToComparison: () => void;
  onWriteReview?: () => void;
  onRecommend?: () => void;
  onMarkAsTaken?: () => void;
};

export function CourseCardWithCharts({
  title,
  goals,
  content,
  courseCode,
  department,
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
  const displayKeywords = keywords?.trim() || "—";
  const displayPrerequisites = Array.isArray(prerequisites) && prerequisites.length > 0 ? prerequisites : ["None"];
  const displayContent = content?.trim()
    ? truncate(stripHtml(content), 180)
    : getFallbackContent();

  return (
    <div className="flex h-[250px] min-h-[250px] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Left: title, keywords+prerequisites area, content, see details */}
      <div className="flex flex-1 min-w-0 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">
              {displayTitle}
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              {courseCode}
              {displayDepartment !== "—" && ` · ${displayDepartment}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Course actions">
            <Button
              variant="ghost"
              size="icon"
              onClick={onWriteReview}
              className="h-8 w-8 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label="Write review"
              title="Write review"
            >
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRecommend}
              className="h-8 w-8 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label="Recommend this course"
              title="Recommend this course"
            >
              <Heart className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMarkAsTaken}
              className="h-8 w-8 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label="Mark as taken"
              title="Mark as taken"
            >
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className="h-8 w-8 shrink-0 rounded-md transition-transform hover:scale-110 hover:bg-muted/70 hover:cursor-pointer"
              aria-label={isUserFavorite ? "Remove from saved" : "Save course"}
              title={isUserFavorite ? "Remove from saved" : "Save course"}
            >
              <Bookmark
                className={`h-5 w-5 shrink-0 ${Boolean(isUserFavorite) ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </Button>
          </div>
        </div>

        {/* Dedicated area: two columns — keywords | prerequisites (both horizontal) */}
        <div className="flex shrink-0 gap-4 px-0 py-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">
              Keywords
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0 text-muted-foreground text-xs leading-snug">
              {displayKeywords.split(/,\s*/).filter(Boolean).map((kw) => (
                <span key={kw} className="shrink-0" title={kw.trim()}>
                  {kw.trim()}
                </span>
              ))}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col border-l border-border/60 pl-3">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">
              Prerequisites
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
              {displayPrerequisites.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 shrink-0"
                  title={item}
                >
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Content (same typography as keywords/prerequisites) */}
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">
            Content
          </p>
          <p className="text-muted-foreground text-xs leading-snug line-clamp-2 min-h-0">
            {displayContent}
          </p>
        </div>
        <div className="mt-auto shrink-0 pt-1.5">
          <Button
            size="sm"
            className="h-8 w-fit text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onSeeReviews}
          >
            See Course Details
          </Button>
        </div>
      </div>

      {/* Right: 4 diagrams, stats, add to comparison */}
      <div className="flex h-full w-[200px] shrink-0 flex-col gap-5 border-l border-border bg-muted/30 p-4">
        <CourseCardCharts data={chartData} />
        <div
          className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground text-xs cursor-default select-none"
          role="status"
          aria-label="Course stats: reviews, recommendations, students taken"
        >
          <span className="flex items-center gap-1.5 opacity-90" title="Number of reviews">
            <MessageSquare className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>{stats.reviewCount}</span>
          </span>
          <span
            className="flex items-center gap-1.5 opacity-90"
            title="Recommended by"
          >
            <Heart className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>{stats.recommendCount}</span>
          </span>
          <span
            className="flex items-center gap-1.5 opacity-90"
            title="Students taken"
          >
            <CheckCircle className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>{stats.studentsTaken}</span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddToComparison}
          className="h-8 shrink-0 self-center text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Compare
        </Button>
      </div>
    </div>
  );
}
