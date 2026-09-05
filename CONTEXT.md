# KTH Course Community

A course catalogue and review site for KTH students: courses are ingested from
KOPPS, explored, and reviewed. This file records the words this project uses, so
that the code, the tickets and the conversations all mean the same thing by them.

**How to read it.** The words here govern identifiers — tables, columns, types,
functions, routes. Reader-facing copy follows the design instead, so a term on an
`_Avoid_` line is banned in code and may still be right in a sentence shown to a
student. A `_Today_` line records what the code actually does where the schema
does not carry the word yet; it names what closes it, and it is deleted by the
migration that does. See ADR 0003.

## Language

### People

**App user**:
A person signed in to the app. Their id is issued by Better Auth and is the only
user id in the system — the primary key of `users` and the target of every user
foreign key.
_Avoid_: auth user, account, member, profile

**Visitor**:
A person using the app without a session. Visitors may explore courses and read
reviews; saving, taking and reviewing need an account.
_Avoid_: guest, anonymous user, unauthenticated user

### The catalogue

**Course**:
A KTH course as ingested from KOPPS, keyed by its course code. The catalogue
entry, not any particular time it ran.
_Avoid_: class, subject, module

**Course round**:
One scheduled run of a course. A course has many rounds; a round belongs to
exactly one course.
_Avoid_: instance, occasion, session, offering

**Course examination**:
One assessed component of a course, as KOPPS reports it. Its code is unique
within its course, never globally.
_Avoid_: exam type, assessment method, moment

**Course prerequisite**:
A directed edge from a course to one it requires, extracted from the source
prose. It cannot express AND/OR logic, so it never replaces **Eligibility** —
extraction narrows, it does not decide.
_Today_: no table. Closed by `course_prerequisites`.
_Avoid_: requirement, dependency, eligibility

**Eligibility**:
The full source prose stating who may take a course, kept verbatim in
`courses.eligibility`. Authoritative where a prerequisite edge is only a hint.
_Avoid_: prerequisites, requirements text

### A user's courses

Saving, taking and reviewing are three independent relationships. None implies
another: a course may be taken without ever being saved, and reviewed without
being either.

**Saved course**:
A course an app user has kept for later. Saved state is the existence of a row,
never a flag; unsaving removes it and must leave taken history and reviews
untouched.
_Avoid_: favorite, bookmark, starred, liked, wishlist

**Taken course**:
A course an app user has actually attended.
_Avoid_: completed course, course history, my courses, enrolled course

**Transcript import**:
Reading a Ladok transcript and turning its rows into taken courses after the
user confirms them. Imported grades and credits remain self-reported.
_Avoid_: transcript sync, Ladok scrape, upload (that is the file step, not this)

**Collection**:
A named, ordered group of one app user's saved courses. A course may only join a
collection its owner has also saved.
_Avoid_: comparison, list, folder, group, playlist

### Reviews

**Review**:
One app user's published assessment of one course. At most one per user per
course.
_Avoid_: rating, comment, post, feedback (see **Feedback form**)

**Upvote** / **Downvote**:
An app user's judgement that a review was or was not worth reading. A vote is
about the review, never about the reviewer.
_Avoid_: like, dislike, helpful, helpful score, karma, points, reaction

**Happy took**:
Whether the reviewer is glad they took the course. A different question from
whether they would advise a stranger to take it, and it belongs to the review.
_Avoid_: would recommend, satisfaction, overall rating

**Workload score** / **Learning score**:
Two separate axes on a review: how much work the course was, and how much the
reviewer got out of it. Neither is an overall verdict.
_Avoid_: difficulty, quality, star rating, overall score

**Examination distribution**:
A reviewer's recollection of how assessment was split across a course. "I don't
remember" is an answer and stores null, never zeroes. Distinct from **Course
examination**, which is source data rather than memory.
_Avoid_: exam breakdown, assessment mix, examination methods

**Approach theory percent**:
How theoretical rather than applied the reviewer found the course, on the same
"I don't remember" rule.
_Avoid_: theory rating, theoretical vs applied

**Fast-track reviewer**:
The screen on Taken courses that deals one card per unreviewed taken course, in
a **round**. It is a second way of asking for a **Review**, never a second kind
of one: a card writes through the same hook and the same validator as every
other form. A round lives in the tab and nowhere else — skipping a card writes
nothing at all, so the course is still an unreviewed taken course afterwards for
the same reason it was before.
_Avoid_: review wizard, review queue (that is the round's order, not the screen),
bulk review, quick rating

### The community graph

**Community graph**:
One persistent global graph of app users in a shared world coordinate space. It
is not rebuilt per visit: a returning user keeps their place and their
neighbourhood.
_Avoid_: network, social graph, map, constellation

**Node**:
One app user's presence in the community graph. Every node is a user; there are
no non-user nodes.
_Avoid_: point, vertex, avatar, dot (except in **Find your dot**)

**World position**:
A node's persistent place in the graph. World units are not browser pixels — the
frontend projects them, and responsive adjustments never write back.
_Avoid_: screen position, canvas coordinates, pixel position

**Anchor**:
An established node that a joining node attaches to. A new node takes roughly
three to five, and adding it must not move anyone already placed.
_Avoid_: parent, host, neighbour

**Backbone edge**:
The stored attachment between a node and its anchor. Its direction records
placement history — newer to older — and the UI may draw it undirected. It is
not a friendship and carries no social meaning.
_Avoid_: friendship, connection, follow, link, relationship

**Node profile**:
A node's appearance, stored separately from graph topology.
_Avoid_: avatar, skin, theme

**Signal**:
The moving trail rendered along a node. A visual state, never a stored event.
_Avoid_: pulse, ping, animation, activity

**Personalization tier**:
How far an app user has unlocked node personalisation, held as the highest value
ever reached. An effective tier may decay with inactivity, but that is derived at
read time and never overwrites what was earned.
_Avoid_: level, rank, XP, points, streak

**Find your dot**:
The landing flow in which a member locates their own node. "Dot" is UI copy for
this flow alone; the thing it finds is a **Node**.
_Avoid_: find me, locate node, my star

### Surfaces

**Explore**:
The workspace where a user searches and browses the catalogue and opens course
details. Explore is where the user is; search is what they do there. The route is
`/search` and stays that way.
_Avoid_: browse, catalogue page, discovery

**Feedback form**:
The unauthenticated contact form. Independent of authentication and unrelated to
**Review**.
_Avoid_: request form, contact us form, support ticket
