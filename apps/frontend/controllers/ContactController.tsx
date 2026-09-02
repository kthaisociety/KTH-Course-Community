"use client";

import { toast } from "sonner";
import { sendFeedback } from "@/lib/feedback";
import ContactView from "@/views/ContactView";

export default function ContactController() {
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
      await sendFeedback(values);
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
