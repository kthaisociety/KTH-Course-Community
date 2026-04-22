// src/database/drizzle.module.ts

import { neon } from "@neondatabase/serverless";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

export const DRIZZLE = Symbol("DRIZZLE");

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): NeonHttpDatabase => {
        const url = config.get<string>("DATABASE_URL");
        if (!url) throw new Error("DATABASE_URL is not set");
        const sql = neon(url);
        return drizzle({ client: sql });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
