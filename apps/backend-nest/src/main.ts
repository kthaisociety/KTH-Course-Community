// biome-ignore-all lint: Suppress all lint errors

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SuperTokensExceptionFilter } from "supertokens-nestjs";
import supertokens from "supertokens-node";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { AppModule } from "./app.module";
import { getCorsOrigins } from "./cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS must include SuperTokens' headers and allow credentials.
  // Origins configured via WEBSITE_DOMAIN + CORS_ORIGINS env vars.
  app.enableCors({
    origin: getCorsOrigins(),
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  });

  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new SuperTokensExceptionFilter(),
  );

  const port = configService.get<number>("PORT") ?? 8080;
  await app.listen(port, "0.0.0.0");
}
bootstrap();
