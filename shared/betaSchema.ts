
import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Beta Experiments Table
export const betaExperiments = pgTable("beta_experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("alpha"), // alpha, beta, ready_for_production, archived
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  usageCount: integer("usage_count").default(0),
  successRate: real("success_rate"),
  averageResponseTime: integer("average_response_time_ms"),
  createdBy: text("created_by").default("system"),
});

// Beta Smoke Test Results (isolated from production)
export const betaSmokeTests = pgTable("beta_smoke_tests", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  method: text("method").notNull(), // axios_cheerio, puppeteer, playwright
  companyName: text("company_name"),
  confidence: integer("confidence"),
  processingTime: integer("processing_time_ms"),
  success: boolean("success").default(false),
  error: text("error"),
  extractionMethod: text("extraction_method"),
  technicalDetails: text("technical_details"),
  experimentId: integer("experiment_id").references(() => betaExperiments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Beta Performance Metrics
export const betaPerformanceMetrics = pgTable("beta_performance_metrics", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").references(() => betaExperiments.id),
  metricName: text("metric_name").notNull(),
  metricValue: real("metric_value").notNull(),
  metricUnit: text("metric_unit"), // ms, percentage, count
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Schema exports
export const insertBetaExperimentSchema = createInsertSchema(betaExperiments).omit({
  id: true,
  createdAt: true,
});

export const insertBetaSmokeTestSchema = createInsertSchema(betaSmokeTests).omit({
  id: true,
  createdAt: true,
});

export type BetaExperiment = typeof betaExperiments.$inferSelect;
export type InsertBetaExperiment = z.infer<typeof insertBetaExperimentSchema>;
export type BetaSmokeTest = typeof betaSmokeTests.$inferSelect;
export type InsertBetaSmokeTest = z.infer<typeof insertBetaSmokeTestSchema>;
