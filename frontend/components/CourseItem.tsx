import { Bookmark } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating";
import { Button } from "./ui/button";

export type CourseItemProps = {
  courseName: string;
  courseCode: string;
  rating: number;
  // semester: string;
  ects: number | null;
  isUserFavorite: boolean;
  onSeeReviews: () => void;
  onToggleFavorite: () => void;
};

export function CourseItem({
  courseName = "Calculus in Several Variables",
  courseCode = "SF1626",
  rating = 4,
  // semester (need to be implemented)
  ects = 7.5,
  isUserFavorite,
  onSeeReviews,
  onToggleFavorite,
}: CourseItemProps) {
  return (
    <div className="outline-solid outline-1 outline-muted-foreground/10 rounded-md p-4">
      <div className="flex justify-between">
        <div className="space-y-1">
          <h4 className="text-sm leading-none font-medium">{courseName}</h4>
          <p className="text-muted-foreground text-sm">{courseCode}</p>
        </div>
        <div>
          <Button
            variant={"ghost"}
            onClick={onToggleFavorite}
            className="hover:bg-transparent hover:cursor-pointer"
          >
            <Bookmark
              className={Boolean(isUserFavorite) ? "h-6 w-6 fill-primary text-primary" : "h-6 w-6 text-muted-foreground"}
            />
          </Button>
        </div>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>
          <Rating value={rating} readOnly>
            {(["one", "two", "three", "four", "five"] as const).map(
              (starId) => (
                <RatingButton
                  className="text-yellow-600"
                  key={`star-${courseCode}-${starId}`}
                />
              ),
            )}
          </Rating>
        </div>
        <Separator orientation="vertical" />
        <div>{ects ? `${ects} ECTS` : "No ECTS available"}</div>
        <Separator orientation="vertical" />
        <div className="flex space-x-2 ml-auto">
          <Button
            className="w-32 px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-xs flex justify-center"
            onClick={onSeeReviews}
          >
            See Reviews
          </Button>
        </div>
      </div>
    </div>
  );
}
