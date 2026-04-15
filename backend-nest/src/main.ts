// biome-ignore-all lint: Suppress all lint errors

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SuperTokensExceptionFilter } from "supertokens-nestjs";
import supertokens from "supertokens-node";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS must include SuperTokens' headers and allow credentials
  const websiteDomain = configService.get<string>("WEBSITE_DOMAIN");
  const origins = [
    websiteDomain ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://coursecompass.azurewebsites.net", // Production frontend domain
  ].filter((value, index, self) => value && self.indexOf(value) === index);

  app.enableCors({
    origin: origins,
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
