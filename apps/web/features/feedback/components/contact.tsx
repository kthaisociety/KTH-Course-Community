import { MessageSquare, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { FeedbackForm } from "./feedback-form";

export function Contact() {
  return (
    <main className="container mx-auto px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
            Get in Touch
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Have questions about Course Community? Want to share feedback or
            suggest improvements? We'd love to hear from you!
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-2">
          <Item variant="outline">
            <ItemMedia variant="icon">
              <Users />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>About Us</ItemTitle>
              <ItemDescription>
                We're a team of KTH students dedicated to helping fellow
                students make informed course decisions.
              </ItemDescription>
            </ItemContent>
          </Item>

          <Item variant="outline">
            <ItemMedia variant="icon">
              <MessageSquare />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Share Your Feedback</ItemTitle>
              <ItemDescription>
                Your feedback helps us improve Course Community for all KTH
                students. Let us know below!
              </ItemDescription>
            </ItemContent>
          </Item>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send us a Message</CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
