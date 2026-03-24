import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { z } from 'zod';
import {
  CourseDetailSchema,
  type CourseSchema,
} from '../../../types/ingest/schemas';
import type { CourseDocumentES } from '../../../types/search/elastic.mappings';
import { DRIZZLE } from '../database/drizzle.module';
import { ES } from '../search/search.constants';
import ag2411Raw from './fixtures/course-detail-AG2411.json';
import dd2421Raw from './fixtures/course-detail-DD2421.json';
import { IngestService } from './ingest.service';
import { KoppsService } from './kopps.service';

// Parse fixtures through Zod so they are correctly typed
const dd2421 = CourseDetailSchema.parse(dd2421Raw);
const ag2411 = CourseDetailSchema.parse(ag2411Raw);

const dd2421Course: z.infer<typeof CourseSchema> = {
  code: 'DD2421',
  name: 'Machine Learning',
  department: 'EECS/Intelligenta system',
  state: 'ESTABLISHED',
};

const ag2411Course: z.infer<typeof CourseSchema> = {
  code: 'AG2411',
  name: 'GIS Architecture and Algorithms',
  department: 'ABE/Geoinformatik',
  state: 'ESTABLISHED',
};

// Helper to call the private toDocument() method
function callToDocument(
  service: IngestService,
  detail: z.infer<typeof CourseDetailSchema>,
  course: z.infer<typeof CourseSchema>,
): CourseDocumentES {
  type PrivateService = {
    toDocument: (
      d: z.infer<typeof CourseDetailSchema>,
      c: z.infer<typeof CourseSchema>,
    ) => CourseDocumentES;
  };
  return (service as unknown as PrivateService).toDocument(detail, course);
}

describe('IngestService', () => {
  let service: IngestService;
  let mockKopps: { getCourses: jest.Mock; getCourseInformation: jest.Mock };
  let mockEs: { indices: { create: jest.Mock }; bulk: jest.Mock };

  beforeEach(async () => {
    mockKopps = {
      getCourses: jest.fn(),
      getCourseInformation: jest.fn(),
    };
    mockEs = {
      indices: { create: jest.fn().mockResolvedValue({}) },
      bulk: jest.fn().mockResolvedValue({
        errors: false,
        items: [{ index: { _id: 'DD2421' } }],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestService,
        { provide: KoppsService, useValue: mockKopps },
        { provide: ES, useValue: mockEs },
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    service = module.get<IngestService>(IngestService);
  });

  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterAll(() => jest.restoreAllMocks());
  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('toDocument()', () => {
    it('maps DD2421 to the correct CourseDocumentES fields', () => {
      const doc = callToDocument(service, dd2421, dd2421Course);

      expect(doc.course_code).toBe('DD2421');
      expect(doc.course_name_swe).toBe('Maskininlärning');
      expect(doc.course_name_eng).toBe('Machine Learning');
      expect(doc.department).toBe('EECS/Intelligenta system');
      expect(doc.credits).toBe(7.5);
      expect(doc.subject).toBe('Datalogi och datateknik');
      expect(doc.state).toBe('ESTABLISHED');
    });

    it('sets course_category to PROGRAMME COURSE only for DD2421', () => {
      const doc = callToDocument(service, dd2421, dd2421Course);
      expect(doc.course_category).toEqual(['PROGRAMME COURSE']);
    });

    it('sets course_category to both values for AG2411 (isPU + isVU)', () => {
      const doc = callToDocument(service, ag2411, ag2411Course);
      expect(doc.course_category).toContain('PROGRAMME COURSE');
      expect(doc.course_category).toContain('OPEN COURSE');
      expect(doc.course_category).toHaveLength(2);
    });

    it('extracts period identifiers from all rounds for DD2421', () => {
      const doc = callToDocument(service, dd2421, dd2421Course);
      expect(doc.periods).toContain('P3');
      expect(doc.periods).toContain('P1');
    });

    it('picks the latest syllabus version and populates goals', () => {
      const doc = callToDocument(service, dd2421, dd2421Course);
      expect(doc.goals.length).toBeGreaterThan(0);
      expect(doc.eligibility).toBeDefined();
    });
  });

  describe('runElasticIngest()', () => {
    it('skips non-ESTABLISHED courses', async () => {
      mockKopps.getCourses.mockResolvedValue([
        { ...dd2421Course, state: 'CANCELLED' },
        dd2421Course,
      ]);
      mockKopps.getCourseInformation.mockResolvedValue(dd2421);

      await service.runElasticIngest();

      const bulkCalls = mockEs.bulk.mock.calls as Array<
        [{ operations: unknown[] }]
      >;
      const ops = bulkCalls[0]?.[0].operations;
      // Each doc is 2 entries: index op + document — 1 course = 2 entries
      expect(ops).toHaveLength(2);
    });

    it('uses fallback doc when getCourseInformation fails', async () => {
      mockKopps.getCourses.mockResolvedValue([dd2421Course]);
      mockKopps.getCourseInformation.mockRejectedValue(new Error('API down'));

      await service.runElasticIngest();

      const bulkCalls = mockEs.bulk.mock.calls as Array<
        [{ operations: unknown[] }]
      >;
      const ops = bulkCalls[0]?.[0].operations;
      const fallbackDoc = ops[1] as CourseDocumentES;
      expect(fallbackDoc.course_code).toBe('DD2421');
      expect(fallbackDoc.goals).toBe('');
      expect(fallbackDoc.credits).toBe(0);
    });

    it('updates status on success', async () => {
      mockKopps.getCourses.mockResolvedValue([dd2421Course]);
      mockKopps.getCourseInformation.mockResolvedValue(dd2421);

      await service.runElasticIngest();

      const status = service.getIngestStatus();
      expect(status.elastic.lastCompleted).not.toBeNull();
      expect(status.elastic.lastError).toBeNull();
    });

    it('updates status and rethrows on failure', async () => {
      mockKopps.getCourses.mockRejectedValue(new Error('Network error'));

      await expect(service.runElasticIngest()).rejects.toThrow('Network error');

      const status = service.getIngestStatus();
      expect(status.elastic.lastError).toBe('Error: Network error');
    });
  });
});
