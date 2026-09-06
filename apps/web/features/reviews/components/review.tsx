"use client";

import { useForm } from "@tanstack/react-form";
import { useEffect, useMemo, useState } from "react";
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
import type { ExaminationDistribution, Review as ReviewModel } from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
  MAX_REVIEW_SCORE,
} from "@/types";
import { useAddReview } from "../hooks/use-add-review";
import { useEditReview } from "../hooks/use-edit-review";
import { reviewFormSchema } from "../lib/review-form-schema";

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

const emptyValues: ReviewFormData = {
  happyTook: false,
  message: "",
  examinationDistribution: null,
  approachTheoryPercent: null,
  workloadScore: 0,
  learningScore: 0,
};

/** A published review being rewritten, as the form needs to see it. */
export type EditableReview = ReviewFormData & { id: string };

/**
 * A stored review as the editor takes it.
 *
 * The form needs a string, so a review with no message opens empty — and goes
 * back as `null`, because the dialog only asks for prose when publishing a
 * first review and the hooks store an untyped-in editor as nothing written.
 *
 * It lives beside `EditableReview` rather than beside either list that offers
 * editing: a course page's `ReviewList` and My Page's own reviews both open the
 * same dialog, and two copies of this would be two chances for them to open it
 * differently.
 */
export function toEditableReview(review: ReviewModel): EditableReview {
  return {
    id: review.id,
    happyTook: review.happyTook,
    message: review.message ?? "",
    examinationDistribution: review.examinationDistribution,
    approachTheoryPercent: review.approachTheoryPercent,
    workloadScore: review.workloadScore,
    learningScore: review.learningScore,
  };
}

type ReviewProps = {
  courseCode: string;
  openOnLoad?: boolean;
  /**
   * The review being rewritten. Given one, the dialog edits rather than
   * creates: it opens with that review's answers, has no trigger button of its
   * own, and submits to `reviews.update`. The parent mounts it fresh (a `key`
   * on the review id) because the form and the rich-text editor both read
   * their starting values once.
   *
   * Only a review's author is offered this, and the server enforces that
   * independently — an id belonging to someone else is refused there.
   */
  editing?: EditableReview;
  /**
   * Renders no trigger button of its own, leaving the opening to `openOnLoad`.
   *
   * Taken courses (#92) walks a queue of unreviewed courses and mounts one of
   * these per course; the row the reader clicked is the trigger, so a second
   * "Add Review" button sitting under the list would open a dialog that is
   * already open. `editing` implies this — a review being rewritten is opened
   * from its own card.
   */
  triggerless?: boolean;
  /**
   * Called whenever the dialog closes, whether the review was published or
   * abandoned.
   *
   * Required alongside `editing`, where the parent owns the open state, and
   * alongside `triggerless`, where the parent is what decides whether anything
   * opens next.
   */
  onClose?: () => void;
};

export function Review({
  courseCode,
  openOnLoad = false,
  editing,
  triggerless = false,
  onClose,
}: Readonly<ReviewProps>) {
  const { userId, isLoading } = useMe();
  const addReview = useAddReview();
  const editReview = useEditReview();
  const [dialogIsOpen, setDialogIsOpen] = useState(
    openOnLoad || Boolean(editing),
  );
  // Prose is required to publish a first review, not to keep one. A review
  // already stored with no message is a valid row, and its author has to be
  // able to correct a score without inventing text to go with it.
  const isEditing = Boolean(editing);
  const formSchema = useMemo(
    () => reviewFormSchema({ requireMessage: !isEditing }),
    [isEditing],
  );
  const form = useForm({
    defaultValues: editing
      ? {
          happyTook: editing.happyTook,
          message: editing.message,
          examinationDistribution: editing.examinationDistribution,
          approachTheoryPercent: editing.approachTheoryPercent,
          workloadScore: editing.workloadScore,
          learningScore: editing.learningScore,
        }
      : emptyValues,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const success = editing
        ? await editReview(editing.id, value)
        : await addReview(courseCode, value);
      if (success) {
        setDialogIsOpen(false);
        onClose?.();
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
          if (!open) {
            form.reset();
            onClose?.();
          }
        }}
      >
        {editing || triggerless ? null : (
          <DialogTrigger asChild>
            <Button className="flex-1" type="button" aria-label="Add review">
              Add Review
            </Button>
          </DialogTrigger>
        )}
        {/*
          The width is one `max-w-*` that already carries its own viewport
          guard. It used to be `max-w-4xl min-w-3xl`, and the floor was the bug
          (#165): `min-w-3xl` is 768px, min-width beats max-width in CSS, and it
          therefore beat `DialogContent`'s own `max-w-[calc(100%-2rem)]` too — so
          on any phone the dialog was wider than the screen and the page scrolled
          sideways. This is reachable: it is the edit-review dialog, opened from
          My Page.

          `w-full` is what supplies the floor now, and it cannot fight the
          viewport the way a fixed `min-w-*` could: the element is `fixed`, so it
          takes the whole viewport and the `min()` caps it — 896px wherever there
          is room for 896px, and the viewport less a 1rem gutter wherever there
          is not. Both halves of the cap are stated here because a plain
          `max-w-*` replaces the primitive's guard rather than joining it.
        */}
        <DialogContent className="scrollbar-subtle max-h-[100vh] w-full max-w-[min(56rem,calc(100vw-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit your review" : "Share Your Experience"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Change anything you like. Your review replaces the one already published."
                : "Help other students by sharing your thoughts about this course."}
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
                          initialHtml={editing?.message}
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
                    {editing ? "Save changes" : "Submit Review"}
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
