// src/app.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { put } from "@vercel/blob";
import {
  Session,
  SuperTokensAuthGuard,
  VerifySession,
} from "supertokens-nestjs";
import type { SessionContainer } from "supertokens-node/recipe/session";
import { parseTranscript } from "./transcript.parser";
import { UserService } from "./user.service";

@Controller("user")
@UseGuards(SuperTokensAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  private async resolveAppUserId(session: SessionContainer): Promise<string> {
    const authUserId = session.getUserId();
    const appUserId = await this.userService.resolveAppUserId(authUserId);
    if (!appUserId) {
      throw new NotFoundException(
        "Authenticated user is not linked to an app account.",
      );
    }
    return appUserId;
  }

  @Get("/me")
  @VerifySession()
  async getMe(@Session() session: SessionContainer) {
    const userId = await this.resolveAppUserId(session);
    const user = await this.userService.getUser(userId);

    if (!user) {
      // Throw an exception if the user exists in SuperTokens but not in the database
      throw new NotFoundException(
        `User with ID ${userId} not found in database.`,
      );
    }
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      userFavorites: user.userFavorites,
      profilePicture: user.profilePicture || null,
      userReviews: user.userReviews,
      userLikedReviews: user.userLikedReviews,
      transcriptCourses: user.transcriptCourses,
    };
  }

  // Get user favorite courses
  @Get("/favorites")
  @VerifySession()
  async getFavorites(@Session() session: SessionContainer) {
    const userId = await this.resolveAppUserId(session);
    // Can be empty but we accept an empty array of favorite courses
    const userFavorites = await this.userService.getUserFavorites(userId);
    return userFavorites;
  }

  // Delete account
  @Delete("/")
  @VerifySession()
  async deleteAccount(@Session() session: SessionContainer) {
    const userId = await this.resolveAppUserId(session);
    await this.userService.deleteUser(userId);
    return { success: true };
  }

  // Add a course to user favorites
  @Post("/toggle-favorite")
  @VerifySession()
  async addFavoriteCourse(
    @Session() session: SessionContainer,
    @Body() body: { courseCode: string },
  ) {
    const userId = await this.resolveAppUserId(session);
    const { courseCode } = body;

    const result = await this.userService.toggleUserFavorite(
      userId,
      courseCode,
    );
    return { success: true, action: result.action };
  }

  // Upload and save a new profile picture
  @Post("/profile-picture")
  @VerifySession()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async uploadProfilePicture(
    @Session() session: SessionContainer,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = await this.resolveAppUserId(session);
    if (!file) {
      throw new BadRequestException("No file provided or invalid image type");
    }

    const blob = await put(file.originalname, file.buffer, {
      access: "public",
      addRandomSuffix: true,
    });

    await this.userService.updateProfilePicture(userId, blob.url);
    return { url: blob.url };
  }

  @Post("/transcript")
  @VerifySession()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype === "application/pdf");
      },
    }),
  )
  async uploadTranscript(
    @Session() session: SessionContainer,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = await this.resolveAppUserId(session);
    if (!file) {
      throw new BadRequestException("No file provided or invalid file type");
    }

    let pdfText: string;
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: file.buffer, verbosity: 0 });
      const result = await parser.getText();
      pdfText = result.text;
      await parser.destroy();
    } catch (err) {
      console.error("PDF parse error:", err);
      throw new InternalServerErrorException("Failed to parse PDF");
    }

    const parsed = parseTranscript(pdfText);
    return this.userService.saveTranscriptCourses(userId, parsed);
  }

  @Get("/transcript-courses")
  @VerifySession()
  async getTranscriptCourses(@Session() session: SessionContainer) {
    const userId = await this.resolveAppUserId(session);
    return this.userService.getTranscriptCourses(userId);
  }

  @Delete("/transcript-courses/:courseCode")
  @VerifySession()
  async deleteTranscriptCourse(
    @Session() session: SessionContainer,
    @Param("courseCode") courseCode: string,
  ) {
    const userId = await this.resolveAppUserId(session);
    await this.userService.deleteTranscriptCourse(userId, courseCode);
    return { success: true };
  }
}
