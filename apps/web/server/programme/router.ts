import { z } from "zod";
import { NotFoundError } from "@/server/errors";
import { baseProcedure, createTRPCRouter } from "../api/trpc";
import {
  getCurrentRounds,
  getDegreeProjects,
  getMasterRequirements,
  getProgramme,
  listProgrammes,
} from "./service";

const programmeCode = z.string().regex(/^[A-ZÅÄÖ0-9]{2,8}$/);

/**
 * KTH's programme syllabi, as public as the course catalogue, so every
 * procedure is open to visitors: a study plan works before signing in.
 */
export const programmeRouter = createTRPCRouter({
  list: baseProcedure.query(() => listProgrammes()),
  detail: baseProcedure
    .input(z.object({ code: programmeCode }))
    .query(async ({ input }) => {
      const programme = await getProgramme(input.code);
      if (!programme)
        throw new NotFoundError(
          `Programme ${input.code} is not in the programme data.`,
        );
      return programme;
    }),
  masterRequirements: baseProcedure
    .input(z.object({ codes: z.array(programmeCode).max(80) }))
    .query(({ input }) => getMasterRequirements(input.codes)),
  /** This academic year's rounds per course, for the codes in one plan. */
  rounds: baseProcedure
    .input(
      z.object({
        codes: z.array(z.string().regex(/^[A-Z0-9]{5,7}$/)).max(400),
      }),
    )
    .query(({ input }) => getCurrentRounds([...new Set(input.codes)])),
  degreeProjects: baseProcedure
    .input(
      z.object({
        codes: z.array(z.string().regex(/^[A-Z]{2}\d{3}X$/)).max(60),
      }),
    )
    .query(({ input }) => getDegreeProjects(input.codes)),
});
