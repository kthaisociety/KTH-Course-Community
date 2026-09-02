# KTH Course Community

A course catalogue and review site for KTH students: courses are ingested from
KOPPS, searched, and reviewed. This file records the words this project uses for
the people it serves, so that the code, the tickets and the conversations all
mean the same thing by them.

## Language

**App user**:
A person signed in to the app. Their id is issued by Better Auth and is the only
user id in the system — it is the primary key of the `users` table and the target
of every user foreign key.
_Avoid_: auth user, account, member, profile

**Visitor**:
A person using the app without a session. Visitors may browse courses, search,
and read reviews; every other route redirects them to sign-in.
_Avoid_: guest, anonymous user, unauthenticated user
