"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";

export type PostActionBarProps = {
  postId: string;
  likeCount: number;
  dislikeCount: number;
  userVote: "like" | "dislike" | null;
  onPostLike: (postId: string) => void;
  onPostDislike: (postId: string) => void;
};

export default function PostActionBar(props: Readonly<PostActionBarProps>) {
  const isLiked = props.userVote === "like";
  const isDisliked = props.userVote === "dislike";

  return (
    <ButtonGroup>
      <Button
        variant={isLiked ? "secondary" : "ghost"}
        onClick={() => props.onPostLike(props.postId)}
      >
        <ThumbsUp
          data-icon="inline-start"
          className={cn(isLiked && "fill-current")}
        />
        {props.likeCount}
      </Button>
      <Button
        variant={isDisliked ? "destructive" : "ghost"}
        onClick={() => props.onPostDislike(props.postId)}
      >
        <ThumbsDown
          data-icon="inline-start"
          className={cn(isDisliked && "fill-current")}
        />
        {props.dislikeCount}
      </Button>
    </ButtonGroup>
  );
}
