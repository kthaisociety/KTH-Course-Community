import { Module } from "@nestjs/common";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth";

/**
 * Wires the Better Auth instance into Nest.
 *
 * `forRoot` mounts Better Auth's own `/api/auth/*` handler and registers its
 * `AuthGuard` globally, so every route is protected unless it opts out with
 * `@Public()`. `isGlobal` makes `AuthService` injectable without re-importing
 * this module.
 */
@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      isGlobal: true,
    }),
  ],
})
export class AuthModule {}
