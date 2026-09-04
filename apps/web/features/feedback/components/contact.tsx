import { PageColumn, PageHeader } from "@/features/shell";
import { FeedbackForm } from "./feedback-form";

/**
 * `/contact` — the Feedback form on its own route.
 *
 * The design has no separate contact page: `Course Community - Contact Form
 * .dc.html` is a section the About artboard imports, and the rail's only link is
 * "About & contact". This route predates the design and stays, so it renders the
 * same form with the section's own two lines promoted into the shell's
 * `PageHeader` rather than repeating them as a second heading.
 */
export function Contact() {
  return (
    <PageColumn>
      <PageHeader
        title="Get in touch"
        subtitle="Bug, idea, or just want to say hi — we read everything."
      />
      <div className="px-7">
        <FeedbackForm />
      </div>
    </PageColumn>
  );
}
