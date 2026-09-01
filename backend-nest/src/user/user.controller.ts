// src/app.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { put } from "@vercel/blob";
import { UserService } from "./user.service";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@Session() session: UserSession) {
    const { id, name, email, image } = session.user;
    return {
      userId: id,
      name: name,
      email: email,
      image: image,
      userFavorites: await this.userService.getUserFavorites(id),
    };
  }

  // Get user favorite courses
  @Get("favorites")
  async getFavorites(@Session() session: UserSession) {
    const id = session.user.id;
    // Can be empty but we accept an empty array of favorite courses
    const userFavorites = await this.userService.getUserFavorites(id);
    return userFavorites;
  }

  // Delete account
  @Delete("/") // endpoint becomes DELETE /api/user
  // TODO: rework with BA (make sure the Better Auth endpoint is invoked too)
  async deleteAccount(@Session() session: UserSession) {
    const id = session.user.id;
    await this.userService.deleteUser(id);
    return { success: true };
  }

  // Add a course to user favorites
  @Post("toggle-favorite")
  async addFavoriteCourse(
    @Session() session: UserSession,
    @Body() body: { courseCode: string },
  ) {
    const id = session.user.id;
    const { courseCode } = body;

    const result = await this.userService.toggleUserFavorite(id, courseCode);
    return { success: true, action: result.action };
  }

  // Upload and save a new profile picture
  @Post("profile-picture")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async uploadImage(
    @Session() session: UserSession,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const id = session.user.id;
    if (!file) {
      throw new BadRequestException("No file provided or invalid image type");
    }

    const blob = await put(file.originalname, file.buffer, {
      access: "public",
      addRandomSuffix: true,
    });

    await this.userService.updateImage(id, blob.url);
    return { url: blob.url };
  }
}
