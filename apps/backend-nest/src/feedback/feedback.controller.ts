import { Body, Controller, Post } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { FeedbackService } from "./feedback.service";
@AllowAnonymous()
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async createFeedback(
    @Body() body: { name: string; email: string; message: string },
  ) {
    return this.feedbackService.submitFeedback(body);
  }
}
