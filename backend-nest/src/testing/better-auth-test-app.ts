import type { INestApplication, ModuleMetadata } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AuthModule, type UserSession } from "@thallesp/nestjs-better-auth";

/**
 * Boots a minimal Nest application around the controllers under test, with the
 * real global `AuthGuard` in place.
 *
 * The Better Auth instance is the only auth-related fake: `auth.api.getSession`
 * decides whether a request carries a session. Everything above it — the guard,
 * the `@Session()` decorator, routing, controllers, status codes — runs for
 * real, which is the only way to observe that public routes stay reachable
 * anonymously once protection is opt-out rather than opt-in.
 *
 * The full application module is deliberately not used: it would pull in
 * Elasticsearch, ingest and the AI module.
 */
export type AuthTestApp = {
  app: INestApplication;
  moduleRef: TestingModule;
  /** Every subsequent request carries this user's session. */
  signInAs(user?: SessionUser): UserSession;
  /** Every subsequent request is anonymous. */
  signOut(): void;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A Better Auth user, in the shape its documented schema defines. */
export const SESSION_USER: SessionUser = {
  id: "user-123",
  name: "Sven",
  email: "sven@kth.se",
  emailVerified: true,
  image: null,
  createdAt: new Date("2023-10-15T00:00:00.000Z"),
  updatedAt: new Date("2023-10-15T00:00:00.000Z"),
};

/** A second signed-in person, for the cases where identity must not be forgeable. */
export const OTHER_SESSION_USER: SessionUser = {
  ...SESSION_USER,
  id: "user-456",
  name: "Astrid",
  email: "astrid@kth.se",
};

/** A Better Auth session, in the shape its documented schema defines. */
function sessionFor(user: SessionUser): UserSession {
  return {
    user,
    session: {
      id: "session-1",
      token: "session-token",
      userId: user.id,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ipAddress: null,
      userAgent: null,
    },
  } as UserSession;
}

export async function createAuthTestApp(
  metadata: ModuleMetadata,
): Promise<AuthTestApp> {
  const getSession = jest.fn().mockResolvedValue(null);

  const moduleRef = await Test.createTestingModule({
    ...metadata,
    imports: [
      AuthModule.forRoot({
        auth: { api: { getSession }, options: {} },
        // Keep Better Auth's own `/api/auth/*` handler out of the test app;
        // the guard is what these specs exercise.
        disableControllers: true,
      }),
      ...(metadata.imports ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    moduleRef,
    signInAs(user = SESSION_USER) {
      const session = sessionFor(user);
      getSession.mockResolvedValue(session);
      return session;
    },
    signOut() {
      getSession.mockResolvedValue(null);
    },
  };
}
