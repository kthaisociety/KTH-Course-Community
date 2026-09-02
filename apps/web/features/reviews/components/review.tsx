import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating";
import { Switch } from "@/components/ui/switch";

export type ReviewFormData = {
  wouldRecommend: boolean;
  content: string;
  examinationMethods: number;
  theoreticalVsApplied: number;
  workload: number;
  learningExperience: number;
};

type ReviewProps = {
  courseCode: string;
  userId: string;
  onAddReview: (
    courseCode: string,
    userId: string,
    reviewForm: ReviewFormData,
  ) => Promise<boolean>;
  /** If true, open the editor dialog on mount (used when clicking "Write a review"). */
  openOnLoad?: boolean;
};

export function Review(props: Readonly<ReviewProps>) {
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    wouldRecommend: false,
    content: "",
    examinationMethods: 0,
    theoreticalVsApplied: 0,
    workload: 0,
    learningExperience: 0,
  });

  const [isSubmittingReviewForm, setIsSubmittingReviewForm] = useState(false);
  const [dialogIsOpen, setDialogIsOpen] = useState(Boolean(props.openOnLoad));

  const isFormInvalid =
    !reviewForm.content ||
    reviewForm.content.replace(/<[^>]*>/g, "").trim() === "" ||
    reviewForm.examinationMethods === 0 ||
    reviewForm.theoreticalVsApplied === 0 ||
    reviewForm.workload === 0 ||
    reviewForm.learningExperience === 0;

  const handleAddReview = async (
    courseCode: string,
    userId: string,
    reviewForm: ReviewFormData,
  ) => {
    setIsSubmittingReviewForm(true);
    try {
      const success = await props.onAddReview(courseCode, userId, reviewForm);
      if (success) {
        setDialogIsOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to add review", {
        description: "Try again later",
      });
      setIsSubmittingReviewForm(false);
    } finally {
      setIsSubmittingReviewForm(false);
    }
  };

  // If we navigated here with `?writeReview=1`, immediately open the editor.
  useEffect(() => {
    if (props.openOnLoad) setDialogIsOpen(true);
  }, [props.openOnLoad]);

  return (
    <Dialog open={dialogIsOpen} onOpenChange={setDialogIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1" type="button" aria-label="Add review">
          Add Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl min-w-3xl max-h-[100vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Your Experience</DialogTitle>
          <DialogDescription>
            Help other students by sharing your thoughts about this course.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-6">
          {/* Rating Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Rate the Course</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Examination methods
                </Label>
                <Rating
                  value={reviewForm.examinationMethods}
                  onValueChange={(value) =>
                    setReviewForm({
                      ...reviewForm,
                      examinationMethods: value,
                    })
                  }
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <RatingButton key={`difficulty-star-${i + 1}`} />
                  ))}
                </Rating>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Theory vs applied</Label>
                <Rating
                  value={reviewForm.theoreticalVsApplied}
                  onValueChange={(value) =>
                    setReviewForm({
                      ...reviewForm,
                      theoreticalVsApplied: value,
                    })
                  }
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <RatingButton key={`usefulness-star-${i + 1}`} />
                  ))}
                </Rating>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Workload</Label>
                <Rating
                  value={reviewForm.workload}
                  onValueChange={(value) =>
                    setReviewForm({
                      ...reviewForm,
                      workload: value,
                    })
                  }
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <RatingButton key={`workload-star-${i + 1}`} />
                  ))}
                </Rating>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Learning experience
                </Label>
                <Rating
                  value={reviewForm.learningExperience}
                  onValueChange={(value) =>
                    setReviewForm({
                      ...reviewForm,
                      learningExperience: value,
                    })
                  }
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <RatingButton key={`learning-star-${i + 1}`} />
                  ))}
                </Rating>
              </div>
            </div>
          </div>

          {/* Recommendation Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Recommendation</h3>
            <div className="flex items-center space-x-3">
              <Switch
                checked={reviewForm.wouldRecommend}
                onCheckedChange={(checked) =>
                  setReviewForm({
                    ...reviewForm,
                    wouldRecommend: checked,
                  })
                }
              />
              <Label htmlFor="recommendation" className="text-sm">
                I would recommend this course
              </Label>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Review</h3>
            <div className="space-y-2">
              {/* <Textarea
                id="review-content"
                placeholder="Share your experience, what you learned, and any tips for future students..."
                value={reviewForm.content}
                onChange={(e) =>
                  setReviewForm({
                    ...reviewForm,
                    content: e.target.value,
                  })
                }
                className="min-h-[120px] resize-none"
              /> */}
              <div>
                <RichTextEditor
                  onContentChange={(content) =>
                    setReviewForm({
                      ...reviewForm,
                      content: content,
                    })
                  }
                />
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Be constructive and respectful</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-3 pt-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingReviewForm}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() =>
              handleAddReview(props.courseCode, props.userId, reviewForm)
            }
            disabled={isFormInvalid || isSubmittingReviewForm}
          >
            {isSubmittingReviewForm ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
