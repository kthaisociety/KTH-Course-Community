"use client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ReviewPreviewProps = {
  courseCode: string;
  content: string;
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
  wouldRecommend: boolean;
  likeCount?: number;
  dislikeCount?: number;
  onClickReview?: () => void;
};

export function ReviewPreview(props: Readonly<ReviewPreviewProps>) {
  // Function to strip HTML tags from text
  const stripHtmlTags = (html: string): string => {
    return html.replace(/<[^>]*>/g, " ");
  };

  const averageScore =
    (props.examinationMethods +
      props.theoreticalVsApplied +
      props.workload +
      props.learningExperience) /
    4;

  const isClickable = Boolean(props.onClickReview);

  return (
    <Card
      className={
        isClickable
          ? "relative mx-auto max-w-sm cursor-pointer shadow-none transition-colors hover:bg-muted/40"
          : "relative mx-auto max-w-sm shadow-none"
      }
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={props.onClickReview}
    >
      <CardHeader>
        <CardTitle>{props.courseCode}</CardTitle>
        <CardAction>
          <p className="text-muted-foreground text-sm text-right">
            {averageScore.toFixed(1) + " / 5"}
          </p>
          <p className="mt-2 text-muted-foreground text-xs text-right">
            Likes: {props.likeCount ?? 0} | Dislikes: {props.dislikeCount ?? 0}
          </p>
        </CardAction>
        <CardDescription>{stripHtmlTags(props.content)}</CardDescription>
      </CardHeader>
    </Card>
  );
}
