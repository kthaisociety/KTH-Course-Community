"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import profoundWords from "profane-words";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import type { CourseHeaderProps } from "@/components/CourseHeader";
import type { PostProps } from "@/components/Post";
import type { ReviewFormData } from "@/components/review";
import { useSessionData } from "@/hooks/sessionHooks";
import { getReviewsSocket } from "@/lib/realtime";
import { fetchCourseInfo } from "@/state/course/courseThunk";
import {
  dislikeCourseReview,
  fetchCourseReviews,
  likeCourseReview,
  submitReview,
} from "@/state/reviews/reviewThunk";
import type { Dispatch, RootState } from "@/state/store";
import CourseView from "@/views/CourseView";
import SuspenseView from "@/views/SuspenseView";

type Review = {
  id: string;
  userId: string;
  courseCode: string;
  easyScore: number;
  usefulScore: number;
  interestingScore: number;
  wouldRecommend: boolean;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  dislikeCount: number;
  userVote: string | null;
};

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

  // Select from Redux
  const courseInfo = useSelector((s: RootState) => s.course.courseInfo);
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
    dispatch(fetchCourseInfo(params.courseCode));
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
      // Refresh reviews
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

  // Compose CourseHeaderProps (from pure utils + Redux state)
  let courseHeader: CourseHeaderProps | null = null;
  if (courseInfo && reviews !== null) {
    const posts = reviews as PostProps[];
    const ci = courseInfo as Record<string, unknown>;

    const courseCode = String(
      ci.courseCode ?? ci.course_code ?? params.courseCode ?? "",
    );
    const courseName = String(ci.name ?? ci.course_name ?? "");
    const goals = String(ci.goals ?? "");
    const content = String(ci.content ?? "");
    const department = String(ci.department ?? "");
    const summary =
      typeof ci.summary === "string" && ci.summary.trim()
        ? ci.summary
        : undefined;

    courseHeader = {
      courseCode,
      courseName,
      credits: courseInfo.credits ?? null,
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
    return <SuspenseView />;
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
          onClick={() => router.push("/search")}
        >
          Back to explore
        </button>
      </div>
    );
  }

  if (courseLoading || reviewsLoading || reviews === null || !courseHeader) {
    return <SuspenseView />;
  }

  const ci = courseInfo as Record<string, unknown>;
  const department = String(ci.department ?? "");
  const goalsHtml = String(ci.goals ?? "");
  const contentHtml = String(ci.content ?? "");
  const summary =
    typeof ci.summary === "string" && ci.summary.trim() ? ci.summary : undefined;
  const neon = courseInfo.neon ?? null;

  return (
    <CourseView
      courseCode={courseHeader.courseCode}
      courseName={courseHeader.courseName}
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
      department={department}
      goalsHtml={goalsHtml}
      contentHtml={contentHtml}
      summary={summary}
      neon={neon}
    />
  );
}
