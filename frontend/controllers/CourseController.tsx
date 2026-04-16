"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CoursePageSkeleton } from "@/components/CoursePageSkeleton";
import type { PostProps } from "@/components/Post";
import { useSessionData } from "@/hooks/sessionHooks";
import { getReviewsSocket } from "@/lib/realtime";
import { fetchCourseDetails } from "@/state/course/courseThunk";
import { fetchCourseReviews } from "@/state/reviews/reviewThunk";
import type { Dispatch, RootState } from "@/state/store";
import CourseView from "@/views/CourseView";

export default function CourseController() {
  const params = useParams<{ courseCode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch<Dispatch>();
  const { userId } = useSessionData();
  const fromSaved = searchParams.get("from") === "saved";
  const backHref = fromSaved ? "/favorites" : "/search";
  const backLabel = fromSaved ? "Back to saved courses" : "Back to explore";

  // Select from Redux
  const courseDetails = useSelector((s: RootState) => s.course.courseDetails);
  const courseLoading = useSelector((s: RootState) => s.course.loading);
  const reviews = useSelector((s: RootState) => s.reviews.reviews);
  const reviewsLoading = useSelector((s: RootState) => s.reviews.loading);
  const courseError = useSelector((s: RootState) => s.course.error);

  // Validate route param
  useEffect(() => {
    if (!params?.courseCode) router.push("/search");
  }, [params?.courseCode, router]);

  // Initial fetch
  useEffect(() => {
    if (!params?.courseCode) return;
    dispatch(fetchCourseDetails(params.courseCode));
    dispatch(fetchCourseReviews({ courseCode: params.courseCode, userId }));
  }, [params.courseCode, userId, dispatch]);

  // Websocket: Live update on review changes
  useEffect(() => {
    if (!params.courseCode || !userId) return;
    const socket = getReviewsSocket();
    const doJoin = () =>
      socket.emit("joinCourse", { courseCode: params.courseCode });
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);
    const handler = async () => {
      dispatch(fetchCourseReviews({ courseCode: params.courseCode, userId }));
    };
    socket.on("reviews.changed", handler);
    return () => {
      socket.off("reviews.changed", handler);
      socket.off("connect", doJoin);
    };
  }, [params.courseCode, userId, dispatch]);

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

  const routeCode = params.courseCode?.toUpperCase() ?? "";
  const loadedInfoCode = courseDetails?.courseCode.toUpperCase() ?? null;
  /** Avoid flashing previous course while Redux still holds last route's data. */
  const courseInfoStale =
    Boolean(courseDetails) &&
    Boolean(loadedInfoCode) &&
    loadedInfoCode !== routeCode;
  const reviewsStale =
    Array.isArray(reviews) &&
    reviews.length > 0 &&
    reviews[0].courseCode?.toUpperCase() !== routeCode;

  if (
    courseLoading ||
    reviewsLoading ||
    reviews === null ||
    !courseDetails ||
    courseInfoStale ||
    reviewsStale
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
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
