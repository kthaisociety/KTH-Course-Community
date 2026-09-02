import { Module } from "@nestjs/common";
import { DrizzleModule } from "../db/drizzle.module";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [DrizzleModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
