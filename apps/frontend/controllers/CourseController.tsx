"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CoursePageSkeleton } from "@/components/CoursePageSkeleton";
import type { PostProps } from "@/components/Post";
import { Review } from "@/components/review";
import { useAddReview } from "@/hooks/useAddReview";
import { useCourseDetails } from "@/hooks/useCourseDetails";
import { useCourseReviews } from "@/hooks/useCourseReviews";
import { useMe } from "@/hooks/useMe";
import { queryKeys } from "@/lib/query-keys";
import { getReviewsSocket } from "@/lib/realtime";
import CourseView from "@/views/CourseView";

export default function CourseController() {
  const params = useParams<{ courseCode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { userId } = useMe();
  const fromSaved = searchParams.get("from") === "saved";
  const openReviewOnLoad = searchParams.get("writeReview") === "1";
  const addReview = useAddReview();
  const backHref = fromSaved ? "/favorites" : "/search";
  const backLabel = fromSaved ? "Back to saved courses" : "Back to explore";

  const courseCode = params?.courseCode;
  const {
    data: courseDetails,
    isLoading: courseLoading,
    error: courseQueryError,
  } = useCourseDetails(courseCode);
  const { data: reviews, isLoading: reviewsLoading } = useCourseReviews(
    courseCode,
    userId || undefined,
  );
  const courseError = courseQueryError
    ? courseQueryError instanceof Error
      ? courseQueryError.message
      : "Failed to load course"
    : null;

  useEffect(() => {
    if (!params?.courseCode) router.push("/search");
  }, [params?.courseCode, router]);

  useEffect(() => {
    if (!params.courseCode || !userId) return;
    const socket = getReviewsSocket();
    const doJoin = () =>
      socket.emit("joinCourse", { courseCode: params.courseCode });
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);
    const handler = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews(params.courseCode),
      });
    };
    socket.on("reviews.changed", handler);
    return () => {
      socket.off("reviews.changed", handler);
      socket.off("connect", doJoin);
    };
  }, [params.courseCode, userId, queryClient]);

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

  if (courseLoading || reviewsLoading || reviews == null || !courseDetails) {
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
