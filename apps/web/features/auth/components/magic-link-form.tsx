"use client";

import { useForm } from "@tanstack/react-form";
import { Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { requestedReturnTo } from "../lib/return-to";

const formSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export function MagicLinkForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.magicLink({
        email: value.email,
        // Where the visitor was when they asked for the link, not the front
        // door. This is the path that cannot recover a destination any other
        // way: the link is opened in a new tab, so nothing but the URL the
        // mail carries survives to say where they were going.
        callbackURL: requestedReturnTo(),
        errorCallbackURL: "/auth",
      });
      if (error) {
        toast.error("Could not send sign-in link");
        return;
      }
      setSentTo(value.email);
    },
  });

  if (sentTo) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Mail />
          </EmptyMedia>
          <EmptyTitle>Check your email</EmptyTitle>
          <EmptyDescription>
            We sent a sign-in link to {sentTo}. It expires in 5 minutes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="email">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  placeholder="your.email@kth.se"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Email me a sign-in link
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  );
}
