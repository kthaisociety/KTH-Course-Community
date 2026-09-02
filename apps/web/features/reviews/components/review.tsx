"use client";

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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/features/auth";
import { useAddReview } from "../hooks/use-add-review";

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
  openOnLoad?: boolean;
};

export function Review({
  courseCode,
  openOnLoad = false,
}: Readonly<ReviewProps>) {
  const { userId, isLoading } = useMe();
  const addReview = useAddReview();
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    wouldRecommend: false,
    content: "",
    examinationMethods: 0,
    theoreticalVsApplied: 0,
    workload: 0,
    learningExperience: 0,
  });

  const [isSubmittingReviewForm, setIsSubmittingReviewForm] = useState(false);
  const [dialogIsOpen, setDialogIsOpen] = useState(openOnLoad);

  const isFormInvalid =
    !reviewForm.content ||
    reviewForm.content.replace(/<[^>]*>/g, "").trim() === "" ||
    reviewForm.examinationMethods === 0 ||
    reviewForm.theoreticalVsApplied === 0 ||
    reviewForm.workload === 0 ||
    reviewForm.learningExperience === 0;

  const handleAddReview = async () => {
    setIsSubmittingReviewForm(true);
    try {
      const success = await addReview(courseCode, reviewForm);
      if (success) {
        setDialogIsOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to add review", {
        description: "Try again later",
      });
    } finally {
      setIsSubmittingReviewForm(false);
    }
  };

  useEffect(() => {
    if (!openOnLoad || !userId) return;
    setDialogIsOpen(true);
    document
      .getElementById("reviews-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openOnLoad, userId]);

  if (isLoading || !userId) return null;

  return (
    <div className="mb-4">
      <Dialog open={dialogIsOpen} onOpenChange={setDialogIsOpen}>
        <DialogTrigger asChild>
          <Button className="flex-1" type="button" aria-label="Add review">
            Add Review
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[100vh] max-w-4xl min-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share Your Experience</DialogTitle>
            <DialogDescription>
              Help other students by sharing your thoughts about this course.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <FieldSet>
              <FieldLegend>Rate the Course</FieldLegend>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldLabel>Examination methods</FieldLabel>
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
                </Field>

                <Field orientation="horizontal">
                  <FieldLabel>Theory vs applied</FieldLabel>
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
                </Field>

                <Field orientation="horizontal">
                  <FieldLabel>Workload</FieldLabel>
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
                </Field>

                <Field orientation="horizontal">
                  <FieldLabel>Learning experience</FieldLabel>
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
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Recommendation</FieldLegend>
              <Field orientation="horizontal">
                <Switch
                  id="recommendation"
                  checked={reviewForm.wouldRecommend}
                  onCheckedChange={(checked) =>
                    setReviewForm({
                      ...reviewForm,
                      wouldRecommend: checked,
                    })
                  }
                />
                <FieldLabel htmlFor="recommendation">
                  I would recommend this course
                </FieldLabel>
              </Field>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Your Review</FieldLegend>
              <Field>
                <RichTextEditor
                  onContentChange={(content) =>
                    setReviewForm({
                      ...reviewForm,
                      content: content,
                    })
                  }
                />
                <FieldDescription>
                  Be constructive and respectful
                </FieldDescription>
              </Field>
            </FieldSet>
          </FieldGroup>

          <DialogFooter>
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
              onClick={handleAddReview}
              disabled={isFormInvalid || isSubmittingReviewForm}
            >
              {isSubmittingReviewForm && <Spinner data-icon="inline-start" />}
              {isSubmittingReviewForm ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
