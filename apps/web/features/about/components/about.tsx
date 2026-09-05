import { Github } from "lucide-react";
import { FeedbackForm } from "@/features/feedback";
import { PageColumn, PageHeader } from "@/features/shell";

/**
 * `/about` — `docs/design_ref_new/Course Community - About.dc.html`.
 *
 * The artboard is one page called "About & contact": a page header, the
 * open-source card, and the Contact Form artboard imported underneath it. So the
 * Feedback form appears here as well as on its own route, and both render the
 * same component.
 *
 * Nothing on this page needs a session, so it stays a server component; only the
 * form below it is client-side.
 */

/**
 * The artboard links to a bare `https://github.com` placeholder. This is the
 * repository it means.
 */
const REPOSITORY_URL = "https://github.com/kthaisociety/KTH-Course-Community";

export function About() {
  return (
    <PageColumn>
      <PageHeader
        title="About & contact"
        subtitle="Course Community is built by KTH AI Society to help students pick courses using the reviews and experience of the students before them."
      />

      <div className="px-7">
        <section className="mt-[30px] rounded-[12px] border border-cc-rule bg-cc-surface px-[22px] py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-cc-pill">
              <Github size={18} aria-hidden className="text-cc-brand" />
            </span>
            <div>
              <h2 className="m-0 font-semibold text-[15px]">
                Open source, on GitHub
              </h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-cc-muted">
                The code is out there. So are we.
              </p>
            </div>
          </div>
          <p className="m-0 mt-3.5 text-[13.5px] text-cc-ink2 leading-[1.6]">
            Every part of this — the reviews, the ratings, the way courses are
            matched — is open for anyone to read, fork, or improve. If something
            looks wrong or you'd rather build it differently, open an issue or
            send a pull request.
          </p>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3.5 inline-flex h-[38px] items-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-pg px-[15px] font-medium text-[13px] text-cc-ink no-underline hover:border-cc-hov"
          >
            <Github size={15} aria-hidden />
            View the repository
          </a>
        </section>

        <section className="mt-[26px]">
          <h2 className="m-0 font-semibold text-[18px]">Get in touch</h2>
          <p className="m-0 mt-1.5 text-[13px] text-cc-muted leading-[1.55]">
            Bug, idea, or just want to say hi — we read everything.
          </p>
          <FeedbackForm />
        </section>
      </div>
    </PageColumn>
  );
}
