"use client";
import RatingDistributionChart from "@/components/RatingDistributionChart";
import { Review, type ReviewFormData } from "@/components/review";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CourseHeaderProps = {
  courseCode: string;
  courseName: string;
  courseRating: number | null;
  credits: number | null;
  easyScoreDistribution: number[];
  usefulScoreDistribution: number[];
  interestingScoreDistribution: number[];
  ratingDistribution: number[];
  syllabus: string;
  percentageWouldRecommend: number | null;
  userId: string;
  onAddReview: (
    courseCode: string,
    userId: string,
    reviewForm: ReviewFormData,
  ) => Promise<boolean>;
  /** Optional class on the outer card (layout on course detail page). */
  className?: string;
  /** When true, opens the review editor dialog immediately. */
  openReview?: boolean;
};

export default function CourseHeader(props: Readonly<CourseHeaderProps>) {
  const rating = props.courseRating
    ? Math.min(5, Math.max(0, props.courseRating))
    : null;
  const ratingLabel = `Avg: ${rating ? rating.toFixed(1) : "__ "}/5.0`;
  const creditsLabel =
    props.credits == null ? "— credits" : `${props.credits} credits`;
  const recommendPct = props.percentageWouldRecommend
    ? Math.min(100, Math.max(0, props.percentageWouldRecommend))
    : null;
  const recommendLabel = `${recommendPct ? `${recommendPct.toFixed(0)}%` : "__"} would recommend`;

  // Function to strip HTML tags from text
  const stripHtmlTags = (html: string): string => {
    return html.replace(/<[^>]*>/g, " ");
  };

  return (
    <Card
      className={cn(
        "w-full grid gap-4 border-border bg-card p-4 shadow-sm md:grid-cols-2 md:gap-x-40 md:gap-y-4 md:p-6",
        props.className,
      )}
    >
      {/* Left */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-2xl">{props.courseCode}</h1>
            <h2 className="text-xl truncate">{props.courseName}</h2>
          </div>
          <div className="text-2xl font-bold shrink-0 w-36 h-24 grid place-items-center rounded-md">
            {ratingLabel}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-lg">
          <div className="grid place-items-center rounded-md text-center p-2">
            <p>{creditsLabel}</p>
          </div>
          <div className="grid place-items-center rounded-md text-center p-2">
            <p>{recommendLabel}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Review
            courseCode={props.courseCode}
            userId={props.userId}
            onAddReview={props.onAddReview}
            openOnLoad={props.openReview}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                className="flex-1"
                type="button"
                aria-label="Read course syllabus"
              >
                Read course syllabus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Course Syllabus</DialogTitle>
                <DialogDescription>
                  {stripHtmlTags(props.syllabus)}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Right */}

      {/* Overall distribution — match PostActionBar height (~40-48px) */}
      <Card className="flex flex-col gap-2 w-80 h-56 p-2 md:p-0 items-center justify-center text-center text-secondary-foreground">
        <RatingDistributionChart
          distribution={props.ratingDistribution || [0, 0, 0, 0, 0]}
          title="Overall rating distribution"
        />
      </Card>

      {/* Other score distributions */}
      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card className="p-1 flex items-center justify-center">
          <RatingDistributionChart
            distribution={props.easyScoreDistribution || [0, 0, 0, 0, 0]}
            title="Easy score distribution"
          />
        </Card>
        <Card className="p-1 flex items-center justify-center">
          <RatingDistributionChart
            distribution={props.usefulScoreDistribution || [0, 0, 0, 0, 0]}
            title="Useful score distribution"
          />
        </Card>
        <Card className="p-1 flex items-center justify-center">
          <RatingDistributionChart
            distribution={props.interestingScoreDistribution || [0, 0, 0, 0, 0]}
            title="Interesting score distribution"
          />
        </Card>
      </div>
    </Card>
  );
}
