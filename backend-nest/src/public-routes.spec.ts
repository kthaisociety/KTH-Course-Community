import request from "supertest";
import { CourseController } from "./course/course.controller";
import { CourseService } from "./course/course.service";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { IngestController } from "./ingest/ingest.controller";
import { IngestService } from "./ingest/ingest.service";
import { ReviewsController } from "./reviews/reviews.controller";
import { ReviewsService } from "./reviews/reviews.service";
import { DepartmentsController } from "./search/departments.controller";
import { DepartmentsService } from "./search/departments.service";
import { SearchController } from "./search/search.controller";
import { SearchService } from "./search/search.service";
import {
  type AuthTestApp,
  createAuthTestApp,
} from "./testing/better-auth-test-app";

/**
 * The public surface, in one place.
 *
 * Protection is opt-out: the global guard covers every route, and a route a
 * visitor may reach says so explicitly. The failure mode that inversion
 * introduces is silently 401-ing visitors on pages that should be open, and
 * nothing else in the suite would catch it.
 *
 * These cases assert reachability only — each route's own behaviour is covered
 * by its own spec — so the services are stubbed.
 */
describe("Public routes (HTTP)", () => {
  let testApp: AuthTestApp;

  const publicRoutes = [
    { name: "course summary", method: "get", path: "/course/SF1625" },
    { name: "course details", method: "get", path: "/course/SF1625/details" },
    { name: "search", method: "get", path: "/search?q=algebra" },
    { name: "departments", method: "get", path: "/departments" },
    {
      name: "review listing",
      method: "get",
      path: "/reviews?courseCode=SF1625",
    },
    { name: "single review", method: "get", path: "/reviews/review-123" },
    { name: "health", method: "get", path: "/health" },
    { name: "ingest status", method: "get", path: "/ingest/status" },
  ] as const;

  beforeEach(async () => {
    testApp = await createAuthTestApp({
      controllers: [
        CourseController,
        SearchController,
        DepartmentsController,
        ReviewsController,
        HealthController,
        IngestController,
      ],
      providers: [
        {
          provide: CourseService,
          useValue: {
            getSummary: jest.fn().mockResolvedValue({ courseCode: "SF1625" }),
            getDetails: jest.fn().mockResolvedValue({ courseCode: "SF1625" }),
          },
        },
        {
          provide: SearchService,
          useValue: { searchCourses: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: DepartmentsService,
          useValue: { getDepartments: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ReviewsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: "review-123" }),
          },
        },
        {
          provide: HealthService,
          useValue: { testAll: jest.fn().mockResolvedValue({ ok: true }) },
        },
        {
          provide: IngestService,
          useValue: {
            getIngestStatus: jest.fn().mockReturnValue({ ok: true }),
          },
        },
      ],
    });
    testApp.signOut();
  });

  afterEach(async () => {
    await testApp.app.close();
    jest.clearAllMocks();
  });

  it.each(publicRoutes)(
    "serves $name to a visitor with no session",
    async ({ method, path }) => {
      await request(testApp.app.getHttpServer())[method](path).expect(200);
    },
  );
});
