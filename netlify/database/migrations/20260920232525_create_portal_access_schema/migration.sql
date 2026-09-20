CREATE TYPE "attendance_status" AS ENUM('Present', 'Absent', 'Late');--> statement-breakpoint
CREATE TYPE "portal_role" AS ENUM('management', 'teacher');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pupil_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"recorded_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "fee_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pupil_id" uuid NOT NULL,
	"term" text NOT NULL,
	"item" text NOT NULL,
	"amount_due" numeric(12,2) NOT NULL,
	"amount_paid" numeric(12,2) DEFAULT '0' NOT NULL,
	"payment_date" date,
	"reference" text,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"full_name" text NOT NULL,
	"role" "portal_role" NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pupils" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"admission_number" text NOT NULL UNIQUE,
	"full_name" text NOT NULL,
	"gender" text,
	"date_of_birth" date,
	"class_id" uuid NOT NULL,
	"parent_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pupil_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"assessment" text NOT NULL,
	"term" text NOT NULL,
	"score" numeric(6,2) NOT NULL,
	"maximum_score" numeric(6,2) DEFAULT '100' NOT NULL,
	"recorded_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_classes" (
	"teacher_id" text NOT NULL,
	"class_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_pupil_date_unique" ON "attendance" ("pupil_id","attendance_date");--> statement-breakpoint
CREATE UNIQUE INDEX "result_unique" ON "academic_results" ("pupil_id","subject","assessment","term");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_class_unique" ON "teacher_classes" ("teacher_id","class_id");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_pupil_id_pupils_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_profiles_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_records" ADD CONSTRAINT "fee_records_pupil_id_pupils_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fee_records" ADD CONSTRAINT "fee_records_recorded_by_profiles_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "pupils" ADD CONSTRAINT "pupils_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id");--> statement-breakpoint
ALTER TABLE "pupils" ADD CONSTRAINT "pupils_parent_id_parents_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "academic_results" ADD CONSTRAINT "academic_results_pupil_id_pupils_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic_results" ADD CONSTRAINT "academic_results_recorded_by_profiles_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_teacher_id_profiles_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;