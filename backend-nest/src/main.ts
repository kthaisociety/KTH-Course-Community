// biome-ignore-all lint: Suppress all lint errors

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { AppModule } from "./app.module";
import { getCorsOrigins } from "./cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Better Auth needs the raw request body on /api/auth/*.
    // @thallesp/nestjs-better-auth re-adds the default parsers for other routes.
    bodyParser: false,
  });
  const configService = app.get(ConfigService);

  // Cookie-based sessions require credentials.
  // Origins configured via WEBSITE_DOMAIN + CORS_ORIGINS env vars.
  app.enableCors({
    origin: getCorsOrigins(),
    allowedHeaders: ["content-type"],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = configService.get<number>("PORT") ?? 8080;
  await app.listen(port, "0.0.0.0");
}
bootstrap();
