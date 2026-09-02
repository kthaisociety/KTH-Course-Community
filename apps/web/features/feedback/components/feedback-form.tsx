"use client";

import { ErrorMessage, Form, Formik, Field as FormikField } from "formik";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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
      {({ isSubmitting, errors, touched }) => (
        <Form>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name && touched.name)}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <FormikField
                as={Input}
                id="name"
                name="name"
                placeholder="Your name"
                aria-invalid={Boolean(errors.name && touched.name)}
              />
              <ErrorMessage name="name">
                {(msg) => <FieldError>{msg}</FieldError>}
              </ErrorMessage>
            </Field>

            <Field data-invalid={Boolean(errors.email && touched.email)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <FormikField
                as={Input}
                id="email"
                name="email"
                type="email"
                placeholder="your.email@kth.se"
                aria-invalid={Boolean(errors.email && touched.email)}
              />
              <ErrorMessage name="email">
                {(msg) => <FieldError>{msg}</FieldError>}
              </ErrorMessage>
            </Field>

            <Field data-invalid={Boolean(errors.message && touched.message)}>
              <FieldLabel htmlFor="message">Message</FieldLabel>
              <FormikField
                as={Textarea}
                id="message"
                name="message"
                rows={6}
                placeholder="Tell us what's on your mind..."
                aria-invalid={Boolean(errors.message && touched.message)}
              />
              <ErrorMessage name="message">
                {(msg) => <FieldError>{msg}</FieldError>}
              </ErrorMessage>
            </Field>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Send Message
            </Button>
          </FieldGroup>
        </Form>
      )}
    </Formik>
  );
}
