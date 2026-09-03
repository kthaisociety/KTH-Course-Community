"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";
import type { ReviewVoteType } from "@/types";

export type PostActionBarProps = {
  postId: string;
  upvoteCount: number;
  downvoteCount: number;
  userVote: ReviewVoteType | null;
  onVote: (postId: string, voteType: ReviewVoteType) => void;
};

export default function PostActionBar(props: Readonly<PostActionBarProps>) {
  const isUpvoted = props.userVote === "up";
  const isDownvoted = props.userVote === "down";

  return (
    <ButtonGroup>
      <Button
        variant={isUpvoted ? "secondary" : "ghost"}
        aria-pressed={isUpvoted}
        aria-label="Upvote this review"
        onClick={() => props.onVote(props.postId, "up")}
      >
        <ThumbsUp
          data-icon="inline-start"
          className={cn(isUpvoted && "fill-current")}
        />
        {props.upvoteCount}
      </Button>
      <Button
        variant={isDownvoted ? "destructive" : "ghost"}
        aria-pressed={isDownvoted}
        aria-label="Downvote this review"
        onClick={() => props.onVote(props.postId, "down")}
      >
        <ThumbsDown
          data-icon="inline-start"
          className={cn(isDownvoted && "fill-current")}
        />
        {props.downvoteCount}
      </Button>
    </ButtonGroup>
  );
}
