"use client";

import { ErrorMessage, Field, Form, Formik } from "formik";
import { MessageSquare, Send, Users } from "lucide-react";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContactViewProps = {
  onSubmit: (
    values: { name: string; email: string; message: string },
    formikHelpers: {
      setSubmitting: (isSubmitting: boolean) => void;
      resetForm: () => void;
    },
  ) => Promise<void>;
};

export default function ContactView({ onSubmit }: ContactViewProps) {
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

          {/* Info Boxes */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* About Us Box */}
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

            {/* Feedback Box */}
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

          {/* Contact Form using Formik */}
          <div className="bg-card p-8 rounded-lg shadow-md border border-border">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">
              Send us a Message
            </h2>

            <Formik
              initialValues={{ name: "", email: "", message: "" }}
              validate={(values) => {
                const errors: Record<string, string> = {};
                if (!values.name.trim()) errors.name = "Name is required";
                if (!values.email.trim()) {
                  errors.email = "Email is required";
                } else if (
                  !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
                ) {
                  errors.email = "Invalid email address";
                }
                if (!values.message.trim())
                  errors.message = "Message is required";
                return errors;
              }}
              onSubmit={onSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-6">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Field
                      as={Input}
                      id="name"
                      name="name"
                      placeholder="Your name"
                    />
                    <ErrorMessage
                      name="name"
                      component="p"
                      className="text-sm text-destructive mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Field
                      as={Input}
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your.email@kth.se"
                    />
                    <ErrorMessage
                      name="email"
                      component="p"
                      className="text-sm text-destructive mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Field
                      as={Textarea}
                      id="message"
                      name="message"
                      rows={6}
                      placeholder="Tell us what's on your mind..."
                    />
                    <ErrorMessage
                      name="message"
                      component="p"
                      className="text-sm text-destructive mt-1"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full"
                    size="lg"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </main>
    </div>
  );
}
