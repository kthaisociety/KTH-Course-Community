"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import ContactView from "@/views/ContactView";

export default function ContactController() {
  const trpc = useTRPC();
  const submitFeedback = useMutation(trpc.feedback.submit.mutationOptions());

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
