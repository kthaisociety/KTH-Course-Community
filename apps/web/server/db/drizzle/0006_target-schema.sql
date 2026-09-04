-- Data-preserving compatibility migration for issue #63.
-- Legacy tables/columns stay readable until their repositories switch in B.
-- course_rounds.round_code is deliberately gated: the current rows do not store
-- KOPPS round.ladokUID, and the serial id is not stable across re-ingestion.
-- The final PK change must follow a source-backed round rebuild, never id::text.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "review_likes"
		WHERE "vote_type" NOT IN ('like', 'dislike')
	) THEN
		RAISE EXCEPTION 'Cannot migrate review_likes: unsupported vote_type found';
	END IF;
END
$$;--> statement-breakpoint
CREATE TYPE "public"."node_signal_style" AS ENUM('default');--> statement-breakpoint
CREATE TYPE "public"."node_style" AS ENUM('default');--> statement-breakpoint
CREATE TYPE "public"."review_vote_type" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "collection_courses" (
	"collection_id" text NOT NULL,
	"collection_user_id" text NOT NULL,
	"course_code" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_courses_collection_id_course_code_pk" PRIMARY KEY("collection_id","course_code"),
	CONSTRAINT "position_nonnegative" CHECK ("collection_courses"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_id_user_id_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "course_explore" (
	"course_code" text PRIMARY KEY NOT NULL,
	"embedding" vector(1536),
	"source_hash" text,
	"search_vector" "tsvector",
	"embedding_model" text,
	"embedded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_prerequisites" (
	"course_code" text NOT NULL,
	"prerequisite_course_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_prerequisites_course_code_prerequisite_course_code_pk" PRIMARY KEY("course_code","prerequisite_course_code")
);
--> statement-breakpoint
CREATE TABLE "review_votes" (
	"voter_user_id" text NOT NULL,
	"review_id" text NOT NULL,
	"vote_type" "review_vote_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_votes_voter_user_id_review_id_pk" PRIMARY KEY("voter_user_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "user_saved_courses" (
	"user_id" text NOT NULL,
	"course_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_saved_courses_user_id_course_code_pk" PRIMARY KEY("user_id","course_code")
);
--> statement-breakpoint
CREATE TABLE "user_taken_courses" (
	"user_id" text NOT NULL,
	"course_code" text NOT NULL,
	"attendance_periods" text,
	"attendance_year" integer,
	"grade" text,
	"earned_credits" real,
	"transcript_imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_taken_courses_user_id_course_code_pk" PRIMARY KEY("user_id","course_code")
);
--> statement-breakpoint
CREATE TABLE "users_graph_backbone_edges" (
	"node_user_id" text NOT NULL,
	"anchor_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_graph_backbone_edges_node_user_id_anchor_user_id_pk" PRIMARY KEY("node_user_id","anchor_user_id"),
	CONSTRAINT "no_self_backbone_edge" CHECK ("users_graph_backbone_edges"."node_user_id" <> "users_graph_backbone_edges"."anchor_user_id")
);
--> statement-breakpoint
CREATE TABLE "users_graph_nodes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_node_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"color" text DEFAULT 'default' NOT NULL,
	"style" "node_style" DEFAULT 'default' NOT NULL,
	"signal_style" "node_signal_style" DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_examinations" DROP CONSTRAINT "course_examinations_course_code_courses_code_fk";
--> statement-breakpoint
ALTER TABLE "course_rounds" DROP CONSTRAINT "course_rounds_course_code_courses_code_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "examination_distribution" jsonb;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "approach_theory_percent" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "workload_score" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "learning_score" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "happy_took" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personalization_tier_earned" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_courses" ADD CONSTRAINT "collection_courses_collection_owner_fk" FOREIGN KEY ("collection_id","collection_user_id") REFERENCES "public"."collections"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_courses" ADD CONSTRAINT "collection_courses_saved_course_fk" FOREIGN KEY ("collection_user_id","course_code") REFERENCES "public"."user_saved_courses"("user_id","course_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_explore" ADD CONSTRAINT "course_explore_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_course_code_courses_code_fk" FOREIGN KEY ("prerequisite_course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_voter_user_id_users_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_courses" ADD CONSTRAINT "user_saved_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_courses" ADD CONSTRAINT "user_saved_courses_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_taken_courses" ADD CONSTRAINT "user_taken_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_taken_courses" ADD CONSTRAINT "user_taken_courses_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_graph_backbone_edges" ADD CONSTRAINT "users_graph_backbone_edges_node_user_id_users_graph_nodes_user_id_fk" FOREIGN KEY ("node_user_id") REFERENCES "public"."users_graph_nodes"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_graph_backbone_edges" ADD CONSTRAINT "users_graph_backbone_edges_anchor_user_id_users_graph_nodes_user_id_fk" FOREIGN KEY ("anchor_user_id") REFERENCES "public"."users_graph_nodes"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_graph_nodes" ADD CONSTRAINT "users_graph_nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_node_profiles" ADD CONSTRAINT "users_node_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Favorites always represented courses kept for later, so preserve every row.
INSERT INTO "user_saved_courses" ("user_id", "course_code", "created_at")
SELECT "user_id", "fav_course_code", "created_at"
FROM "user_favorites";--> statement-breakpoint

-- Preserve review votes while translating the legacy vocabulary.
INSERT INTO "review_votes" (
	"voter_user_id",
	"review_id",
	"vote_type",
	"created_at",
	"updated_at"
)
SELECT
	"user_id",
	"review_id",
	CASE "vote_type"
		WHEN 'like' THEN 'up'::"review_vote_type"
		WHEN 'dislike' THEN 'down'::"review_vote_type"
	END,
	"created_at",
	"created_at"
FROM "review_likes";--> statement-breakpoint

-- Move the existing derived search state without requiring a re-ingest.
-- Legacy course columns remain until search repositories switch over.
INSERT INTO "course_explore" (
	"course_code",
	"embedding",
	"source_hash",
	"search_vector",
	"embedding_model"
)
SELECT
	"code",
	"embedding",
	"embedding_hash",
	"search_vector",
	CASE
		WHEN "embedding" IS NOT NULL THEN 'openai/text-embedding-3-small'
		ELSE NULL
	END
FROM "courses";--> statement-breakpoint

-- The old integer answers cannot safely become a distribution or percentage,
-- so those target columns intentionally remain NULL. Directly equivalent data
-- is copied when valid, and empty comments become NULL.
UPDATE "reviews"
SET
	"workload_score" = CASE
		WHEN "workload" BETWEEN 1 AND 10 THEN "workload"
		ELSE NULL
	END,
	"learning_score" = CASE
		WHEN "learning_experience" BETWEEN 1 AND 10 THEN "learning_experience"
		ELSE NULL
	END,
	"happy_took" = "would_recommend",
	"message" = NULLIF("content", '');--> statement-breakpoint

-- Keep old application writes valid until #75 switches the review repository.
-- (Dropped in 0012_review_contract.sql.)
CREATE FUNCTION "sync_legacy_review_fields_to_target"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	NEW."workload_score" := CASE
		WHEN NEW."workload" BETWEEN 1 AND 10 THEN NEW."workload"
		ELSE NULL
	END;
	NEW."learning_score" := CASE
		WHEN NEW."learning_experience" BETWEEN 1 AND 10 THEN NEW."learning_experience"
		ELSE NULL
	END;
	NEW."happy_took" := NEW."would_recommend";
	NEW."message" := NULLIF(NEW."content", '');
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "reviews_legacy_target_sync"
BEFORE INSERT OR UPDATE OF
	"workload",
	"learning_experience",
	"would_recommend",
	"content"
ON "reviews"
FOR EACH ROW
EXECUTE FUNCTION "sync_legacy_review_fields_to_target"();--> statement-breakpoint

-- Fail rather than silently losing rows if a future source violates assumptions.
DO $$
BEGIN
	IF (SELECT count(*) FROM "user_saved_courses") <>
		(SELECT count(*) FROM "user_favorites") THEN
		RAISE EXCEPTION 'user_favorites row preservation check failed';
	END IF;

	IF (SELECT count(*) FROM "review_votes") <>
		(SELECT count(*) FROM "review_likes") THEN
		RAISE EXCEPTION 'review_likes row preservation check failed';
	END IF;

	IF (SELECT count(*) FROM "course_explore") <>
		(SELECT count(*) FROM "courses") THEN
		RAISE EXCEPTION 'course search-state preservation check failed';
	END IF;
END
$$;--> statement-breakpoint
CREATE INDEX "course_explore_search_vector_idx" ON "course_explore" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "course_explore_embedding_idx" ON "course_explore" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "course_examinations" ADD CONSTRAINT "course_examinations_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_rounds" ADD CONSTRAINT "course_rounds_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
UPDATE "course_rounds"
SET "study_pace" = NULL
WHERE "study_pace" IS NOT NULL
	AND "study_pace" NOT BETWEEN 1 AND 100;--> statement-breakpoint
ALTER TABLE "course_rounds" ADD CONSTRAINT "study_pace_range" CHECK ("course_rounds"."study_pace" between 1 and 100);--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "approach_theory_percent_range" CHECK ("reviews"."approach_theory_percent" between 0 and 100);--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "workload_score_range" CHECK ("reviews"."workload_score" between 1 and 10);--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "learning_score_range" CHECK ("reviews"."learning_score" between 1 and 10);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "personalization_tier_earned_range" CHECK ("users"."personalization_tier_earned" between 0 and 3);
