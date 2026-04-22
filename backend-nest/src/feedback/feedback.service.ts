import { Inject, Injectable } from "@nestjs/common";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { v4 as uuidv4 } from "uuid";
import * as schema from "../db/schema";
import {
  feedback_form,
  InsertFeedbackForm,
} from "../db/schema";
import { DRIZZLE } from "../database/drizzle.module";

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async submitFeedback(data: Omit<InsertFeedbackForm, "id" | "createdAt">) {
    const newFeedback = {
      id: uuidv4(),
      ...data,
    };

    await this.db.insert(feedback_form).values(newFeedback);

    return { success: true };
  }
}
