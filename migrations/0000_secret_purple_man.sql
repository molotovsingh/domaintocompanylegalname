CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"total_domains" integer NOT NULL,
	"processed_domains" integer DEFAULT 0,
	"successful_domains" integer DEFAULT 0,
	"failed_domains" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"company_name" text,
	"extraction_method" text,
	"confidence_score" real,
	"retry_count" integer DEFAULT 0,
	"error_message" text,
	"batch_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
