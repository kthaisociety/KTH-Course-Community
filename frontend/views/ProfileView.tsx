import type { Review, UserLikedReview } from "@shared/types";
import { GraduationCap, Mail, Trash2, Upload } from "lucide-react";
import { ReviewPreview } from "@/components/ReviewPreviewProfile";
// import { RichTextEditor } from "@/components/RichEditor"; // re-enable with the My Goals card
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TranscriptCourse } from "@/state/user/userSlice";

const GRADE_POINTS: Record<string, number> = {
  A: 5,
  B: 4.5,
  C: 4,
  D: 3.5,
  E: 3,
};

function calculateGPA(courses: TranscriptCourse[]): number | null {
  const gradable = courses.flatMap((c) => {
    const points = c.grade ? GRADE_POINTS[c.grade] : undefined;
    return points !== undefined && c.credits
      ? [{ points, credits: c.credits }]
      : [];
  });
  const totalCredits = gradable.reduce((sum, c) => sum + c.credits, 0);
  if (totalCredits === 0) return null;
  const weightedSum = gradable.reduce(
    (sum, c) => sum + c.points * c.credits,
    0,
  );
  return weightedSum / totalCredits;
}

function formatHp(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Soft green→red tints per grade; the letter itself stays the primary signal.
 *  Keys are uppercase — look up with grade.toUpperCase() ("Fx" → "FX").
 *  Grades outside the A–F scale (P, G, …) fall back to the neutral outline. */
const GRADE_BADGE_CLASSES: Record<string, string> = {
  A: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  B: "border-lime-200 bg-lime-100 text-lime-800 dark:border-lime-900 dark:bg-lime-950 dark:text-lime-300",
  C: "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300",
  D: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  E: "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  F: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  FX: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

function GradeBadge({ grade }: { grade: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "min-w-7 justify-center",
        GRADE_BADGE_CLASSES[grade.toUpperCase()],
      )}
    >
      {grade}
    </Badge>
  );
}

function StatTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="px-6 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

type ProfileViewProps = {
  name: string;
  email: string;
  preview: string | null;
  userReviews: Review[];
  userLikedReviews: UserLikedReview[];
  transcriptCourses: TranscriptCourse[];
  courseNames: Record<string, string>;
  handleTranscriptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteAccount: () => void;
  handleDeleteCourse: (courseCode: string) => void;
  onClickReview: (courseCode: string) => void;
};

export default function ProfileView({
  name,
  email,
  preview,
  userReviews,
  userLikedReviews,
  transcriptCourses,
  courseNames,
  handleTranscriptUpload,
  handleDeleteAccount,
  handleDeleteCourse,
  onClickReview,
}: ProfileViewProps) {
  const gpa = calculateGPA(transcriptCourses);
  const totalCredits = transcriptCourses.reduce(
    (sum, c) => sum + (c.credits ?? 0),
    0,
  );

  const sortedReviews = [...userReviews].sort(
    (a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0),
  );
  const sortedLikedReviews = [...userLikedReviews].sort(
    (a, b) => (b.review.likeCount ?? 0) - (a.review.likeCount ?? 0),
  );

  const formatCredits = (credits: number | null) =>
    credits !== null ? credits.toFixed(1) : "—";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 md:px-6">
      {/* Dashboard — generous fixed-height panels on desktop, each scrolling
          internally; the page itself scrolls normally. */}
      <section className="flex flex-col gap-6 pb-6 pt-6">
        {/* Hero: identity + headline stats */}
        <section className="shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            {/* Profile picture upload is disabled for now. To re-enable, wrap
                the avatar in a <label htmlFor="profile-upload">, render a
                hidden <Input id="profile-upload" type="file" accept="image/*"
                onChange={handleFileChange} /> and restore the
                handleFileChange wiring in ProfileController (see git
                history). */}
            <div className="shrink-0">
              <Avatar className="size-20 border-4">
                {preview ? (
                  <AvatarImage
                    src={preview}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-primary text-xl text-primary-foreground dark:bg-(--primary-button)">
                    {getInitials(name || email)}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold leading-tight text-foreground">
                {name || email}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{email}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-border bg-muted/30 sm:grid-cols-4 sm:divide-x sm:divide-border">
            <StatTile
              label="Reviews written"
              value={String(userReviews.length)}
            />
            <StatTile
              label="Courses Taken"
              value={String(transcriptCourses.length)}
            />
            <StatTile
              label="Credits earned"
              value={formatHp(totalCredits)}
              suffix="hp"
            />
            <StatTile
              label="GPA"
              value={gpa !== null ? gpa.toFixed(2) : "—"}
              suffix={gpa !== null ? "/ 5.00" : undefined}
            />
          </div>
        </section>

        {/* Panels — fixed 36rem/32rem rows on desktop; the liked-reviews card
            spans both rows, so its height is capped by the tracks and its
            content scrolls instead of extending the page. */}
        <div className="grid gap-6 lg:grid-cols-5 lg:grid-rows-[36rem_32rem]">
          {/* Courses Taken */}
          <Card className="min-w-0 lg:col-span-3 lg:overflow-hidden">
            <CardHeader>
              <CardTitle>Courses taken</CardTitle>
              <CardDescription>
                Imported from your KTH transcript.
              </CardDescription>
              {transcriptCourses.length > 0 && (
                <CardAction>
                  {/* Re-uploading merges: new courses are added, existing
                      ones get their grade/credits refreshed. */}
                  <label htmlFor="transcript-upload" className="cursor-pointer">
                    <Button variant="secondary" size="sm" asChild>
                      <span>
                        <Upload className="size-4" />
                        Update transcript
                      </span>
                    </Button>
                  </label>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col lg:min-h-0 lg:flex-1">
              <Input
                id="transcript-upload"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleTranscriptUpload}
                className="hidden"
              />
              {transcriptCourses.length > 0 ? (
                <div className="scrollbar-subtle max-h-120 overflow-auto rounded-lg border border-border lg:max-h-none lg:min-h-0">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="sticky top-0 z-10 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="bg-muted px-4 py-2.5 text-left font-medium shadow-[inset_0_-1px_0_var(--border)]">
                          Code
                        </th>
                        <th className="bg-muted px-4 py-2.5 text-left font-medium shadow-[inset_0_-1px_0_var(--border)]">
                          Course
                        </th>
                        <th className="bg-muted px-4 py-2.5 text-right font-medium shadow-[inset_0_-1px_0_var(--border)]">
                          Credits
                        </th>
                        <th className="bg-muted px-4 py-2.5 text-left font-medium shadow-[inset_0_-1px_0_var(--border)]">
                          Grade
                        </th>
                        <th className="bg-muted px-4 py-2.5 shadow-[inset_0_-1px_0_var(--border)]">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transcriptCourses.map((c) => (
                        <tr key={c.courseCode} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => onClickReview(c.courseCode)}
                              title={courseNames[c.courseCode]}
                              className="font-medium text-primary hover:underline dark:text-primary-light"
                            >
                              {c.courseCode}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {courseNames[c.courseCode] ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                            {formatCredits(c.credits)}
                          </td>
                          <td className="px-4 py-2.5">
                            {c.grade ? (
                              <GradeBadge grade={c.grade} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              title={`Remove ${c.courseCode}`}
                              onClick={() => handleDeleteCourse(c.courseCode)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">
                                Remove {c.courseCode}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center lg:flex-1">
                  <GraduationCap
                    className="size-8 text-muted-foreground"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No courses yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upload your KTH transcript (PDF) to import your courses
                      and grades.
                    </p>
                  </div>
                  <label htmlFor="transcript-upload" className="cursor-pointer">
                    <Button variant="secondary" size="sm" asChild>
                      <span>
                        <Upload className="size-4" />
                        Upload transcript
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </CardContent>
            {transcriptCourses.length > 0 && (
              <CardFooter className="justify-between border-t text-sm">
                <span className="text-muted-foreground">
                  {transcriptCourses.length}{" "}
                  {transcriptCourses.length === 1 ? "course" : "courses"} ·{" "}
                  {formatHp(totalCredits)} hp
                </span>
                {gpa !== null && (
                  <span className="font-medium">
                    GPA {gpa.toFixed(2)}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      / 5.00
                    </span>
                  </span>
                )}
              </CardFooter>
            )}
          </Card>

          {/* My Reviews */}
          <Card className="min-w-0 lg:col-span-3 lg:overflow-hidden">
            <CardHeader>
              <CardTitle>My reviews</CardTitle>
              <CardDescription>
                Reviews you've written, sorted by likes.
              </CardDescription>
              {userReviews.length > 0 && (
                <CardAction>
                  <Badge variant="secondary">{userReviews.length}</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="scrollbar-subtle max-h-120 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
              {sortedReviews.length > 0 ? (
                <ul className="space-y-3">
                  {sortedReviews.map((review) => (
                    <li key={review.id}>
                      <ReviewPreview
                        courseCode={review.courseCode}
                        courseTitle={courseNames[review.courseCode]}
                        content={review.content}
                        likeCount={review.likeCount}
                        dislikeCount={review.dislikeCount}
                        onClickReview={() => onClickReview(review.courseCode)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground lg:h-full">
                  You haven't written any reviews yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liked reviews — right column, spanning both rows */}
          <Card className="min-w-0 lg:col-span-2 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:overflow-hidden">
            <CardHeader>
              <CardTitle>Liked reviews</CardTitle>
              <CardDescription>Reviews you've found helpful.</CardDescription>
              {userLikedReviews.length > 0 && (
                <CardAction>
                  <Badge variant="secondary">{userLikedReviews.length}</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="scrollbar-subtle max-h-96 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
              {sortedLikedReviews.length > 0 ? (
                <ul className="space-y-3">
                  {sortedLikedReviews.map((liked) => (
                    <li key={liked.reviewId}>
                      <ReviewPreview
                        courseCode={liked.review.courseCode}
                        courseTitle={courseNames[liked.review.courseCode]}
                        content={liked.review.content}
                        likeCount={liked.review.likeCount}
                        dislikeCount={liked.review.dislikeCount}
                        onClickReview={() =>
                          onClickReview(liked.review.courseCode)
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground lg:h-full">
                  You haven't liked any reviews yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Goals — hidden for now; re-enable together with the
              RichTextEditor import above.
          <Card>
            <CardHeader>
              <CardTitle>My goals</CardTitle>
              <CardDescription>
                Notes about what you want out of your studies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor />
            </CardContent>
          </Card>
          */}
        </div>
      </section>

      {/* Delete Account */}
      <section className="mb-16 rounded-xl border border-destructive/40 bg-card shadow-sm">
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-destructive">
              Delete account
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently removes your account, reviews and imported courses.
              This can't be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={handleDeleteAccount}
          >
            Delete account
          </Button>
        </div>
      </section>
    </div>
  );
}
