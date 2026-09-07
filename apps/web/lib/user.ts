export type Me = {
  userId: string;
  name: string;
  email: string;
  savedCourseCodes: string[];
  /**
   * Whatever the sign-in provider gave Better Auth — Google and GitHub supply
   * one, magic-link sign-in does not. Nothing in this app writes it, so it is
   * null for every email-only account and the avatar falls back to initials.
   */
  image: string | null;
};
