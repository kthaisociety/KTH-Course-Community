"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFeedbackMutations } from "../api/mutations";
import { ContactView } from "./contact-view";

export function ContactScreen() {
  const feedback = useFeedbackMutations();
  const submitFeedback = useMutation(feedback.submit());

  const handleSubmit = async (
    values: { name: string; email: string; message: string },
    {
      setSubmitting,
      resetForm,
    }: {
      setSubmitting: (isSubmitting: boolean) => void;
      resetForm: () => void;
    },
  ) => {
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
  };

  return <ContactView onSubmit={handleSubmit} />;
}
