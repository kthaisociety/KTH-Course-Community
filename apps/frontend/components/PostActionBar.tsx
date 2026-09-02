import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "./ui/button";

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
    <div className="flex gap-2 justify-end py-1">
      <Button
        variant="ghost"
        onClick={() => props.onPostLike(props.postId)}
        className={isLiked ? "text-blue-600 bg-blue-50" : ""}
      >
        <ThumbsUp className={`size-4 ${isLiked ? "fill-current" : ""}`} />
        <span className="ml-1 text-sm">{props.likeCount}</span>
      </Button>
      <Button
        variant="ghost"
        onClick={() => props.onPostDislike(props.postId)}
        className={isDisliked ? "text-red-600 bg-red-50" : ""}
      >
        <ThumbsDown className={`size-4 ${isDisliked ? "fill-current" : ""}`} />
        <span className="ml-1 text-sm">{props.dislikeCount}</span>
      </Button>
    </div>
  );
}
