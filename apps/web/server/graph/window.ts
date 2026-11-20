/**
 * How many nodes a window may return.
 *
 * A query policy, not a database column: the landing page never loads the whole
 * community, and the bound belongs to the domain that answers the question.
 *
 * There is **one** number rather than one per caller, because there is now one
 * window. A member and a visitor are served the same slice of the same graph
 * and differ only in whether one node in it is flagged as theirs; a second
 * bound would be a second picture waiting to happen.
 *
 * It lives in its own file, with no imports, because the landing canvas needs
 * it too: a member past the bound is appended to their own window, and the
 * projection has to tell that one extra node from the community it is framing.
 * `service.ts` reaches the database, so the browser cannot import it from there.
 */
export const MAX_WINDOW_NODES = 150;
