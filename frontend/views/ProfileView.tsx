import type { Review } from "@shared/types";
import { ReviewPreview } from "@/components/ReviewPreviewProfile";
import { RichTextEditor } from "@/components/RichEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileReview = Review & {
  likeCount?: number;
  dislikeCount?: number;
};

type ProfileViewProps = {
  name: string;
  email: string;
  preview: string | null;
  userReviews: ProfileReview[];
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteAccount: () => void;
  onClickReview: (courseCode: string) => void;
};

export default function ProfileView({
  name,
  email,
  preview,
  userReviews,
  handleFileChange,
  handleDeleteAccount,
  onClickReview,
}: ProfileViewProps) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <main className="container mx-auto px-4 py-12 max-w-4xl">
      {/*
      <h1 className="text-4xl font-bold text-foreground mb-6">My Profile</h1>
      <p className="text-muted-foreground mb-10">
        Manage your account settings and preferences
      </p>
      */}

      <div className="space-y-4">
        <Card>
          <CardContent className="flex justify-center items-center py-2">
            <div className="relative">
              {/* Profile picture*/}
              <Avatar className="w-24 h-24 border-4">
                {preview ? (
                  <AvatarImage
                    src={preview}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-xl">
                    {getInitials(name || email)}
                  </AvatarFallback>
                )}
              </Avatar>
              {/* Bottom left - anchored to avatar */}
              <div className="absolute top-2/3 right-full pr-4 -translate-y-1/2 whitespace-nowrap">
                <p>{name}</p>
              </div>

              {/* Bottom right - anchored to avatar */}
              <div className="absolute top-2/3 left-full pl-4 -translate-y-1/2 whitespace-nowrap">
                <p>Computer Science</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/*Personal Data*/}
        <div className="flex gap-4">
          <div className="w-6/13 flex flex-col gap-4">
            {/*Courses Taken*/}
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>Courses Taken</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your taken courses will be shown here.
                </p>
              </CardContent>
            </Card>

            {/*Liked/Disliked Reviews*/}
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>Liked/Disliked Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your reviews will be shown here.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="w-7/13 flex flex-col gap-4">
            {/*My Reviews*/}
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>My Reviews</CardTitle>
                <CardDescription>
                  Reviews you've written can be viewed here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userReviews.length > 0 ? (
                  <ul className="space-y-2">
                    {[...userReviews]
                      .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
                      .slice(0, 4)
                      .map((review) => (
                        <li key={review.id} className="text-muted-foreground">
                          <ReviewPreview
                            courseCode={review.courseCode}
                            content={review.content}
                            examinationMethods={review.examinationMethods}
                            theoreticalVsApplied={review.theoreticalVsApplied}
                            workload={review.workload}
                            learningExperience={review.learningExperience}
                            wouldRecommend={review.wouldRecommend}
                            likeCount={review.likeCount}
                            dislikeCount={review.dislikeCount}
                            onClickReview={() =>
                              onClickReview(review.courseCode)
                            }
                          />
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    You haven't written any reviews yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/*My Goals*/}
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>My Goals</CardTitle>
                <CardDescription>
                  <p className="text-muted-foreground">
                    Your goals can be written here.
                  </p>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RichTextEditor />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Profile Info Card
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your profile picture and personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-primary/10">
                {preview ? (
                  <AvatarImage
                    src={preview}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials(name || email)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="space-y-2">
                <Label htmlFor="profile-upload">Profile Picture</Label>
                <div className="flex gap-2">
                  <label htmlFor="profile-upload">
                    <Button variant="secondary" size="sm" asChild>
                      <span>Upload New</span>
                    </Button>
                    <Input
                      id="profile-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max 2MB. JPG, PNG, or GIF.
                </p>
              </div>
            </div>

            
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                readOnly
                className="max-w-md bg-muted cursor-not-allowed"
              />
            </div>
          </CardContent>
        </Card>
           */}

        {/* Delete Account */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Delete Account</CardTitle>
            <CardDescription>
              Permanently remove your account and data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-destructive/5 p-4 border border-destructive/20">
              <p className="text-sm text-muted-foreground mb-4">
                Once deleted, your account and data can't be recovered.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
