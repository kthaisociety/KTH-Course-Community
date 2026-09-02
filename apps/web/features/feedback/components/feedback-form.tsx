"use client";

import { ErrorMessage, Field, Form, Formik } from "formik";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubmitFeedback } from "../api/mutations";

export function FeedbackForm() {
  const submitFeedback = useSubmitFeedback();

  return (
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
        if (!values.message.trim()) errors.message = "Message is required";
        return errors;
      }}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        try {
          await submitFeedback.mutateAsync(values);
          toast.success("Message sent successfully!");
          resetForm();
        } catch (error) {
          console.error(error);
          toast.error("Failed to send message.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="space-y-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Field as={Input} id="name" name="name" placeholder="Your name" />
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
  );
}
