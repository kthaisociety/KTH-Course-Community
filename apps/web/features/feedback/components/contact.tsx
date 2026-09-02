import { MessageSquare, Users } from "lucide-react";
import { FeedbackForm } from "./feedback-form";

export function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-12 pt-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Get in Touch
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions about Course Community? Want to share feedback or
              suggest improvements? We'd love to hear from you!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-card-foreground mb-2">
                    About Us
                  </h3>
                  <p className="text-muted-foreground">
                    We're a team of KTH students dedicated to helping fellow
                    students make informed course decisions.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-card-foreground mb-2">
                    Share Your Feedback
                  </h3>
                  <p className="text-muted-foreground">
                    Your feedback helps us improve Course Community for all KTH
                    students. Let us know below!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card p-8 rounded-lg shadow-md border border-border">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">
              Send us a Message
            </h2>
            <FeedbackForm />
          </div>
        </div>
      </main>
    </div>
  );
}
