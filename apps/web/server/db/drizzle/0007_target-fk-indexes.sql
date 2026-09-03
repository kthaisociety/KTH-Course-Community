CREATE INDEX "collection_courses_collection_owner_idx" ON "collection_courses" USING btree ("collection_id","collection_user_id");--> statement-breakpoint
CREATE INDEX "collection_courses_saved_course_idx" ON "collection_courses" USING btree ("collection_user_id","course_code");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_prerequisites_prerequisite_course_code_idx" ON "course_prerequisites" USING btree ("prerequisite_course_code");--> statement-breakpoint
CREATE INDEX "course_rounds_course_code_idx" ON "course_rounds" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "review_votes_review_id_idx" ON "review_votes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_course_code_idx" ON "reviews" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "user_saved_courses_course_code_idx" ON "user_saved_courses" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "user_taken_courses_course_code_idx" ON "user_taken_courses" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "users_graph_backbone_edges_anchor_user_id_idx" ON "users_graph_backbone_edges" USING btree ("anchor_user_id");