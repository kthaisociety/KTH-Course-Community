"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import profoundWords from "profane-words";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import type { CourseHeaderProps } from "@/components/CourseHeader";
import { CoursePageSkeleton } from "@/components/CoursePageSkeleton";
import type { PostProps } from "@/components/Post";
import type { ReviewFormData } from "@/components/review";
import { useSessionData } from "@/hooks/sessionHooks";
import { getReviewsSocket } from "@/lib/realtime";
import { fetchCourseDetails } from "@/state/course/courseThunk";
import {
  dislikeCourseReview,
  fetchCourseReviews,
  likeCourseReview,
  submitReview,
} from "@/state/reviews/reviewThunk";
import type { Dispatch, RootState } from "@/state/store";
import CourseView from "@/views/CourseView";

// TODO: Remove raing logic, since we don't want that.
/** --- REMOVE THESE -------------- */
const getAverageRating = (posts: PostProps[]) => {
  const totalScores = posts.reduce(
    (acc, post) => ({
      easyScore: acc.easyScore + post.easyScore,
      usefulScore: acc.usefulScore + post.usefulScore,
      interestingScore: acc.interestingScore + post.interestingScore,
    }),
    { easyScore: 0, usefulScore: 0, interestingScore: 0 },
  );
  const numberOfPosts = posts.length;
  const averageEasyScore = totalScores.easyScore / numberOfPosts;
  const averageUsefulScore = totalScores.usefulScore / numberOfPosts;
  const averageInterestingScore = totalScores.interestingScore / numberOfPosts;

  return Math.round(
    (averageEasyScore + averageUsefulScore + averageInterestingScore) / 3,
  );
};
const getEasyScoreDistribution = (posts: PostProps[]) => {
  const counts = [0, 0, 0, 0, 0];
  posts.forEach((post) => {
    if (post.easyScore >= 1 && post.easyScore <= 5) {
      counts[post.easyScore - 1] += 1;
    }
  });
  return counts;
};
const getUsefulScoreDistribution = (posts: PostProps[]) => {
  const counts = [0, 0, 0, 0, 0];
  posts.forEach((post) => {
    if (post.usefulScore >= 1 && post.usefulScore <= 5) {
      counts[post.usefulScore - 1] += 1;
    }
  });
  return counts;
};
const getInterestingScoreDistribution = (posts: PostProps[]) => {
  const counts = [0, 0, 0, 0, 0];
  posts.forEach((post) => {
    if (post.interestingScore >= 1 && post.interestingScore <= 5) {
      counts[post.interestingScore - 1] += 1;
    }
  });
  return counts;
};
// Average rating distribution (1-5 stars)
const getRatingDistribution = (posts: PostProps[]) => {
  const counts = [0, 0, 0, 0, 0];
  posts.forEach((post) => {
    const avgScore = Math.round(
      (post.easyScore + post.usefulScore + post.interestingScore) / 3,
    );
    if (avgScore >= 1 && avgScore <= 5) {
      counts[avgScore - 1] += 1;
    }
  });
  return counts;
};
// TODO: Remove the rating logic / rework
/** --- REMOVE THESE ABOVE -------------- */

// TODO: Re-work to be like / favorite course
const getPercentageWouldRecommend = (posts: PostProps[]) => {
  return (
    (posts.filter((post) => post.wouldRecommend).length / posts.length) * 100
  );
};

export default function CourseController() {
  const params = useParams<{ courseCode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch<Dispatch>();
  const { userId } = useSessionData();
  const openReview = searchParams.get("writeReview") === "1";
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

  // Add Review Handler
  const handleAddReview = async (
    courseCode: string,
    userId: string,
    reviewForm: ReviewFormData,
  ): Promise<boolean> => {
    const plainText = reviewForm.content.replace(/<[^>]*>/g, " ");
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const profoundMatches = profoundWords
      .filter(Boolean)
      .filter((badWord) =>
        new RegExp(`\\b${escapeRegex(String(badWord))}\\b`, "i").test(
          plainText,
        ),
      );
    if (profoundMatches.length > 0) {
      toast("Please refrain from using profane language", {
        description: `Dissaproved words: ${profoundMatches.join(", ")}`,
      });
      return false;
    }
    try {
      await dispatch(submitReview({ courseCode, userId, reviewForm })).unwrap();
      toast.success("Review added successfully!");
      dispatch(fetchCourseReviews({ courseCode, userId }));
      return true;
    } catch {
      toast.error("Failed to add review", { description: "Try again later" });
      return false;
    }
  };

  // Like/Dislike Handlers
  const handleLikePost = async (postId: string) => {
    if (!userId) return;
    await dispatch(likeCourseReview({ reviewId: postId, userId })).unwrap();
    dispatch(fetchCourseReviews({ courseCode: params.courseCode, userId }));
  };
  const handleDislikePost = async (postId: string) => {
    if (!userId) return;
    await dispatch(dislikeCourseReview({ reviewId: postId, userId })).unwrap();
    dispatch(fetchCourseReviews({ courseCode: params.courseCode, userId }));
  };

  // Compose CourseHeaderProps from CourseDetails + reviews
  let courseHeader: CourseHeaderProps | null = null;
  if (courseDetails && reviews !== null) {
    const posts = reviews as PostProps[];
    const goals = courseDetails.goals ?? "";
    const content = courseDetails.content ?? "";

    courseHeader = {
      courseCode: courseDetails.courseCode,
      courseTitle: courseDetails.titleEng,
      credits: courseDetails.credits,
      syllabus: `${content}\n\n${goals}`,
      courseRating: posts.length > 0 ? getAverageRating(posts) : null,
      ratingDistribution: getRatingDistribution(posts),
      easyScoreDistribution: getEasyScoreDistribution(posts),
      usefulScoreDistribution: getUsefulScoreDistribution(posts),
      interestingScoreDistribution: getInterestingScoreDistribution(posts),
      percentageWouldRecommend: posts.length
        ? getPercentageWouldRecommend(posts)
        : null,
      userId: userId ?? "",
      onAddReview: handleAddReview,
    };
  }
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
    !courseHeader ||
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
      courseCode={courseHeader.courseCode}
      courseTitle={courseHeader.courseTitle}
      credits={courseHeader.credits}
      syllabus={courseHeader.syllabus}
      percentageWouldRecommend={courseHeader.percentageWouldRecommend}
      easyScoreDistribution={courseHeader.easyScoreDistribution}
      usefulScoreDistribution={courseHeader.usefulScoreDistribution}
      interestingScoreDistribution={courseHeader.interestingScoreDistribution}
      ratingDistribution={courseHeader.ratingDistribution}
      courseRating={courseHeader.courseRating}
      userId={userId ?? ""}
      onAddReview={courseHeader.onAddReview}
      posts={posts}
      onLikePost={handleLikePost}
      onDislikePost={handleDislikePost}
      openReview={openReview}
      department={courseDetails.department}
      goalsHtml={courseDetails.goals ?? ""}
      contentHtml={courseDetails.content ?? ""}
      rounds={courseDetails.rounds}
      examinations={courseDetails.examinations}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
