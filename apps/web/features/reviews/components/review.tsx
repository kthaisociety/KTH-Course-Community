"use client";

import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { z } from "zod";
import { RichTextEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/features/auth";
import type { ExaminationDistribution } from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
  examinationDistributionSchema,
  MAX_REVIEW_SCORE,
  percentSchema,
  reviewScoreSchema,
} from "@/types";
import { useAddReview } from "../hooks/use-add-review";

export type ReviewFormData = {
  happyTook: boolean;
  message: string;
  /** `null` is the stored answer for "I don't remember". */
  examinationDistribution: ExaminationDistribution | null;
  /** `null` is the stored answer for "I don't remember". */
  approachTheoryPercent: number | null;
  workloadScore: number;
  learningScore: number;
};

const EMPTY_DISTRIBUTION: ExaminationDistribution = {
  exam: 0,
  assignments: 0,
  labs: 0,
  projects: 0,
  seminars: 0,
  other: 0,
};

// The form shares the wire contract from `@/types` and adds only what is
// specific to writing a review in a dialog: a message that is not just markup.
const formSchema = z.object({
  happyTook: z.boolean(),
  message: z
    .string()
    .refine(
      (html) => html.replace(/<[^>]*>/g, "").trim().length > 0,
      "Write a review.",
    ),
  examinationDistribution: examinationDistributionSchema.nullable(),
  approachTheoryPercent: percentSchema.nullable(),
  workloadScore: reviewScoreSchema,
  learningScore: reviewScoreSchema,
});

const defaultValues: ReviewFormData = {
  happyTook: false,
  message: "",
  examinationDistribution: null,
  approachTheoryPercent: null,
  workloadScore: 0,
  learningScore: 0,
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
                <FieldDescription>
                  Two separate axes, each from 1 to {MAX_REVIEW_SCORE}. Neither
                  is an overall verdict.
                </FieldDescription>
                <FieldGroup>
                  <form.Field name="workloadScore">
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
                            {Array.from(
                              { length: MAX_REVIEW_SCORE },
                              (_, i) => (
                                <RatingButton key={`workload-star-${i + 1}`} />
                              ),
                            )}
                          </Rating>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="learningScore">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field
                          orientation="horizontal"
                          data-invalid={isInvalid}
                        >
                          <FieldLabel>Learning</FieldLabel>
                          <Rating
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                          >
                            {Array.from(
                              { length: MAX_REVIEW_SCORE },
                              (_, i) => (
                                <RatingButton key={`learning-star-${i + 1}`} />
                              ),
                            )}
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
                <FieldLegend>Examination</FieldLegend>
                <FieldDescription>
                  How was assessment split across the course? Leave "I don't
                  remember" checked if you are not sure — a guess helps nobody.
                </FieldDescription>
                <form.Field name="examinationDistribution">
                  {(field) => {
                    const distribution = field.state.value;
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    const total =
                      distribution === null
                        ? 0
                        : EXAMINATION_DISTRIBUTION_KEYS.reduce(
                            (sum, key) => sum + distribution[key],
                            0,
                          );
                    return (
                      <Field data-invalid={isInvalid}>
                        <Field orientation="horizontal">
                          <Checkbox
                            id="examination-not-remembered"
                            checked={distribution === null}
                            onCheckedChange={(checked) =>
                              field.handleChange(
                                checked === true
                                  ? null
                                  : { ...EMPTY_DISTRIBUTION },
                              )
                            }
                          />
                          <FieldLabel htmlFor="examination-not-remembered">
                            I don't remember
                          </FieldLabel>
                        </Field>

                        {distribution !== null && (
                          <>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              {EXAMINATION_DISTRIBUTION_KEYS.map((key) => (
                                <Field key={key}>
                                  <FieldLabel
                                    htmlFor={`examination-share-${key}`}
                                  >
                                    {EXAMINATION_DISTRIBUTION_LABELS[key]}
                                  </FieldLabel>
                                  <Input
                                    id={`examination-share-${key}`}
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={distribution[key]}
                                    onChange={(event) =>
                                      field.handleChange({
                                        ...distribution,
                                        [key]:
                                          Number.parseInt(
                                            event.target.value,
                                            10,
                                          ) || 0,
                                      })
                                    }
                                  />
                                </Field>
                              ))}
                            </div>
                            <FieldDescription>
                              Total: {total}% (must be 100%)
                            </FieldDescription>
                          </>
                        )}
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Approach</FieldLegend>
                <FieldDescription>
                  How theoretical rather than applied did you find the course?
                </FieldDescription>
                <form.Field name="approachTheoryPercent">
                  {(field) => {
                    const percent = field.state.value;
                    return (
                      <Field>
                        <Field orientation="horizontal">
                          <Checkbox
                            id="approach-not-remembered"
                            checked={percent === null}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked === true ? null : 50)
                            }
                          />
                          <FieldLabel htmlFor="approach-not-remembered">
                            I don't remember
                          </FieldLabel>
                        </Field>
                        {percent !== null && (
                          <>
                            <Slider
                              aria-label="Percent theory"
                              min={0}
                              max={100}
                              step={1}
                              value={[percent]}
                              onValueChange={([value]) =>
                                field.handleChange(value)
                              }
                            />
                            <FieldDescription>
                              {percent}% theory / {100 - percent}% applied
                            </FieldDescription>
                          </>
                        )}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Looking back</FieldLegend>
                <form.Field name="happyTook">
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
                        I'm glad I took this course
                      </FieldLabel>
                    </Field>
                  )}
                </form.Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Your Review</FieldLegend>
                <form.Field name="message">
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
