"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/features/auth";
import {
  type PostProps,
  Review,
  useAddReview,
  useReviewQueries,
} from "@/features/reviews";
import { useCourseQueries } from "../api/queries";
import { CoursePageSkeleton } from "./course-page-skeleton";
import { CourseView } from "./course-view";

export function CourseScreen() {
  const params = useParams<{ courseCode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useMe();
  const fromSaved = searchParams.get("from") === "saved";
  const openReviewOnLoad = searchParams.get("writeReview") === "1";
  const addReview = useAddReview();
  const courses = useCourseQueries();
  const reviewsApi = useReviewQueries();
  const backHref = fromSaved ? "/favorites" : "/search";
  const backLabel = fromSaved ? "Back to saved courses" : "Back to explore";

  const courseCode = params?.courseCode;
  const {
    data: courseDetails,
    isLoading: courseLoading,
    error: courseQueryError,
  } = useQuery({
    ...courses.details(courseCode ?? ""),
    enabled: Boolean(courseCode),
  });
  const {
    data: reviews,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useQuery({
    ...reviewsApi.list(courseCode ?? ""),
    enabled: Boolean(courseCode),
  });
  const courseError = courseQueryError
    ? courseQueryError instanceof Error
      ? courseQueryError.message
      : "Failed to load course"
    : null;

  useEffect(() => {
    if (!params?.courseCode) router.push("/search");
  }, [params?.courseCode, router]);

  const posts: (PostProps & { postId: string })[] = Array.isArray(reviews)
    ? reviews.map((review) => ({ ...review, postId: review.id }))
    : [];

  if (!params.courseCode) {
    return <CoursePageSkeleton backHref={backHref} backLabel={backLabel} />;
  }

  if (courseError && !courseLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-destructive text-lg font-medium">
          Could not load this course.
        </p>
        <p className="mt-2 text-muted-foreground text-sm">{courseError}</p>
        <button
          type="button"
          className="mt-6 text-primary text-sm underline"
          onClick={() => router.push(backHref)}
        >
          {backLabel}
        </button>
      </div>
    );
  }

  if (
    courseLoading ||
    !courseDetails ||
    (reviewsLoading && reviews == null && !reviewsError)
  ) {
    return (
      <CoursePageSkeleton
        courseCode={params.courseCode}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  return (
    <CourseView
      courseCode={courseDetails.courseCode}
      courseTitle={courseDetails.titleEng}
      credits={courseDetails.credits}
      department={courseDetails.department}
      goalsHtml={courseDetails.goals ?? ""}
      contentHtml={courseDetails.content ?? ""}
      rounds={courseDetails.rounds}
      examinations={courseDetails.examinations}
      posts={posts}
      openReviewOnLoad={openReviewOnLoad}
      reviewComposer={
        userId ? (
          <Review
            courseCode={courseDetails.courseCode}
            userId={userId}
            onAddReview={addReview}
            openOnLoad={openReviewOnLoad}
          />
        ) : null
      }
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
