import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  controllers: [AiController],
  // AiService is kept as a provider for future AI-related business logic.
  providers: [AiService],
})
export class AiModule {}
