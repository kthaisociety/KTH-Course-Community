# `docs/design/` — a read-only mirror of the Claude Design project

This folder is a snapshot of the Claude Design project

<https://claude.ai/design/p/d7c051c6-9911-493e-aedd-1c42261f30b1>

copied into the repo so that the frontend track can read the artboards without
design-tool access. It exists to be **read**, never edited.

## The design project is the source of truth; this is downstream of it

Every file here is a copy. Changing a file in this folder changes nothing about
the design — it only makes the mirror lie. A design change is made in the Claude
Design project and then re-mirrored (see [Re-syncing](#re-syncing)).

The corollary is that the artboards, not this folder's age, decide what a page
looks like. Within the wider precedence rule settled on
[#68](https://github.com/kthaisociety/KTH-Course-Community/issues/68):

- **The design is the visual source of truth** — layout, spacing, typography,
  colour, copy, states, responsive behaviour. Match the artboard.
- **The schema is the data source of truth** — what fields exist, what they are
  called, what shape they have, what may be null. Where an artboard or
  `cc-store.js` contradicts `apps/web/server/db/schema.ts`, the schema wins and
  the design adapts with the smallest visual change that works.

## What is here

Filenames keep their spaces on purpose: they are the artboard names in the
design project, and keeping them identical is what makes the mirror greppable
against it. Do not rename or slugify them.

### Deliverable artboards (13)

Pages and components the frontend track implements, one child issue each.

| File | What it is |
| --- | --- |
| `Course Community - Page Header.dc.html` | The app shell header |
| `Course Community - Workspace Pane.dc.html` | The pane owning open course-details and review-draft tabs |
| `Course Community - Course Card.dc.html` | The course card, shared by Explore and Saved |
| `Course Community - Unreviewed Card.dc.html` | The taken-but-unreviewed list, shared by My Page and Taken courses |
| `Course Community - Review Card.dc.html` | A single review |
| `Course Community - Explore.dc.html` | The search-and-browse workspace |
| `Course Community - Saved.dc.html` | Saved courses |
| `Course Community - Taken Courses.dc.html` | Self-reported taken courses |
| `Course Community - Collections.dc.html` | Collections |
| `Course Community - My Page.dc.html` | The signed-in profile page |
| `Course Community - Landing.dc.html` | The public landing page |
| `Course Community - About.dc.html` | About |
| `Course Community - Contact Form.dc.html` | Contact / feedback form |

### `reference/` — not deliverables

Artboards nobody implements as a page. They are exploration and shared
reference: read them, but do not treat them as a screen to build.

| File | What it is |
| --- | --- |
| `reference/Course Community - Design System.dc.html` | The palette and type scale, drawn out |
| `reference/Course Community - Mobile Preview.dc.html` | Shared responsive reference for every page |
| `reference/Course Community - Review Card Options.dc.html` | Rejected and alternate review-card treatments |
| `reference/Course Community - Unreviewed Card Options.dc.html` | Alternate empty-state treatments |

### Support files

| File | What it is |
| --- | --- |
| `cc-theme.css` | The palette. Mirrored into `apps/web/app/globals.css` as `--cc-*` tokens — style against those, never against raw hex |
| `support.js` | The design canvas runtime the artboards load. Generated; of no interest except that the artboards need it |
| `cc-store.js` | The design's **mock** store. A sketch of intent, never a data contract — see below |

## `cc-store.js` is a sketch, not a contract

It is the fixture data the artboards render against, written before the schema
settled, and it disagrees with `apps/web/server/db/schema.ts` in several places
(review authorship, vote storage, collection shape, the examination keys). The
schema wins in all of them. Each child PR that hits a contradiction states it,
so the design gets corrected at source rather than each page diverging quietly.

The one shape that *is* authoritative is the Course Card's `SAMPLE_COURSE` /
`SAMPLE_GEO`, extracted to `apps/web/data/course-card-sample.ts`.

## Formatters are kept off this folder — deliberately

`docs/design` is excluded in `biome.json`, and `.gitattributes` marks
`docs/design/**` as `-diff linguist-generated`.

That is not tidiness. lefthook runs `biome check --write` on staged files and
re-stages the result, and it had already silently rewritten `support.js` —
stripping its generated-file header and its `"use strict"`, and rewrapping it
from 1911 to 2105 lines. A reformatted mirror is no longer a mirror: it stops
matching the design project byte-for-byte, which is the only property this
folder has.

For the same reason, `cc-theme.css` and `cc-store.js` were taken from the design
**source** rather than from the exported folder, and committed after the
exclusions were in place.

The `-diff` marking also keeps ~700 KB of generated markup out of every diff and
review; that is a welcome side effect, not the reason. This README is the one
exception — it is ours rather than mirrored, so `.gitattributes` puts it back in
the diff.

**If you find yourself editing a file here, stop.** Either the change belongs in
the design project, or it belongs in `apps/web/`.

## Re-syncing

Only someone with access to the design project can do this.

1. Export the project, or copy each artboard's source out of it.
2. Overwrite the files here, keeping the filenames and the `reference/` split
   exactly as they are.
3. Take `cc-theme.css`, `support.js` and `cc-store.js` from the design source
   directly, not from an export that a formatter has been near.
4. `git status` — an artboard nobody touched in the design project should show
   no diff. If everything is modified, something reformatted the files.
5. If `cc-theme.css` changed, mirror the change into the `--cc-*` blocks of
   `apps/web/app/globals.css`. There are three parallel blocks there (the
   Tailwind `--color-cc-*` bridge, light, dark) and they must stay in step.
6. If the Course Card's `SAMPLE_COURSE` / `SAMPLE_GEO` changed, regenerate
   `apps/web/data/course-card-sample.ts` from the artboard rather than
   hand-editing it.
