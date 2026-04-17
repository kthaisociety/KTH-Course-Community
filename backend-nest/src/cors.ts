/**
 * Shared CORS origins builder.
 * Reads WEBSITE_DOMAIN and CORS_ORIGINS from process.env so it can be
 * used both in main.ts (via ConfigService) and in decorators evaluated
 * before the DI container exists (e.g. @WebSocketGateway).
 */
export function getCorsOrigins(): string[] {
  const websiteDomain =
    process.env.WEBSITE_DOMAIN ?? "http://localhost:3000";
  const extra = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return [
    websiteDomain,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...extra,
  ].filter((value, index, self) => self.indexOf(value) === index);
}
