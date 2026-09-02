"use client";

import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { z } from "zod";
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
  FieldError,
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

const ratingSchema = z.number().int().min(1, "Select a rating.");

const formSchema = z.object({
  wouldRecommend: z.boolean(),
  content: z
    .string()
    .refine(
      (html) => html.replace(/<[^>]*>/g, "").trim().length > 0,
      "Write a review.",
    ),
  examinationMethods: ratingSchema,
  theoreticalVsApplied: ratingSchema,
  workload: ratingSchema,
  learningExperience: ratingSchema,
});

const defaultValues: ReviewFormData = {
  wouldRecommend: false,
  content: "",
  examinationMethods: 0,
  theoreticalVsApplied: 0,
  workload: 0,
  learningExperience: 0,
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
  const [dialogIsOpen, setDialogIsOpen] = useState(openOnLoad);
  const form = useForm({
    defaultValues,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const success = await addReview(courseCode, value);
      if (success) {
        setDialogIsOpen(false);
        form.reset();
      }
    },
  });

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
      <Dialog
        open={dialogIsOpen}
        onOpenChange={(open) => {
          setDialogIsOpen(open);
          if (!open) form.reset();
        }}
      >
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

          <form
            id="add-review-form"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="py-6">
              <FieldSet>
                <FieldLegend>Rate the Course</FieldLegend>
                <FieldGroup>
                  <form.Field name="examinationMethods">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field
                          orientation="horizontal"
                          data-invalid={isInvalid}
                        >
                          <FieldLabel>Examination methods</FieldLabel>
                          <Rating
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <RatingButton key={`difficulty-star-${i + 1}`} />
                            ))}
                          </Rating>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="theoreticalVsApplied">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field
                          orientation="horizontal"
                          data-invalid={isInvalid}
                        >
                          <FieldLabel>Theory vs applied</FieldLabel>
                          <Rating
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <RatingButton key={`usefulness-star-${i + 1}`} />
                            ))}
                          </Rating>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="workload">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field
                          orientation="horizontal"
                          data-invalid={isInvalid}
                        >
                          <FieldLabel>Workload</FieldLabel>
                          <Rating
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <RatingButton key={`workload-star-${i + 1}`} />
                            ))}
                          </Rating>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="learningExperience">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field
                          orientation="horizontal"
                          data-invalid={isInvalid}
                        >
                          <FieldLabel>Learning experience</FieldLabel>
                          <Rating
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <RatingButton key={`learning-star-${i + 1}`} />
                            ))}
                          </Rating>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Recommendation</FieldLegend>
                <form.Field name="wouldRecommend">
                  {(field) => (
                    <Field orientation="horizontal">
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                      />
                      <FieldLabel htmlFor={field.name}>
                        I would recommend this course
                      </FieldLabel>
                    </Field>
                  )}
                </form.Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Your Review</FieldLegend>
                <form.Field name="content">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <RichTextEditor
                          onContentChange={(content) =>
                            field.handleChange(content)
                          }
                        />
                        <FieldDescription>
                          Be constructive and respectful
                        </FieldDescription>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldSet>
            </FieldGroup>
          </form>

          <DialogFooter>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    form="add-review-form"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                    Submit Review
                  </Button>
                </>
              )}
            </form.Subscribe>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
