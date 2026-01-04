import { pgTable, text, serial, integer, timestamp, varchar, boolean, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  funeralHome: varchar("funeral_home", { length: 255 }),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  billingPeriodStart: timestamp("billing_period_start").defaultNow().notNull(),
});

export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  content: text("content").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadDate: timestamp("upload_date").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("uploaded").notNull(),
});

export const arrangements = pgTable("arrangements", {
  id: serial("id").primaryKey(),
  transcriptId: integer("transcript_id").notNull().unique(),
  userId: integer("user_id").notNull(),

  // AI Extracted Data - Deceased Information
  deceasedName: varchar("deceased_name", { length: 255 }),
  deceasedAge: integer("deceased_age"),
  dateOfDeath: varchar("date_of_death", { length: 100 }),
  causeOfDeath: text("cause_of_death"),

  // Service Information
  serviceType: varchar("service_type", { length: 100 }),
  serviceLocation: varchar("service_location", { length: 255 }),
  serviceDate: varchar("service_date", { length: 100 }),
  serviceTime: varchar("service_time", { length: 100 }),

  // Contact Information
  arrangerName: varchar("arranger_name", { length: 255 }),
  arrangerPhone: varchar("arranger_phone", { length: 50 }),
  arrangerEmail: varchar("arranger_email", { length: 255 }),
  arrangerRelation: varchar("arranger_relation", { length: 100 }),

  // Preferences and Merchandise
  casketType: varchar("casket_type", { length: 255 }),
  flowerPrefs: text("flower_prefs"),
  specialRequests: text("special_requests"),

  // Document and Processing
  generatedDoc: text("generated_doc"),
  docStatus: varchar("doc_status", { length: 50 }).default("draft").notNull(),
  approvalStatus: varchar("approval_status", { length: 50 }).default("pending").notNull(),
  approvedAt: timestamp("approved_at"),
  aiProcessed: boolean("ai_processed").default(false).notNull(),
  extractedData: text("extracted_data"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  arrangementId: integer("arrangement_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // contract, summary, obituary, tasks, death_cert
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"), // Generated content
  plainTextContent: text("plain_text_content"), // Plain text content for editing
  status: varchar("status", { length: 20 }).default("generating").notNull(), // generating, completed, failed
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const funeralTasks = pgTable("funeral_tasks", {
  id: serial("id").primaryKey(),
  arrangementId: integer("arrangement_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // director, family
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 10 }).default("medium").notNull(), // low, medium, high
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userUsageMetrics = pgTable("user_usage_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  metricType: varchar("metric_type", { length: 50 }).notNull(), // 'transcript_processed' or 'document_generated'
  metricValue: integer("metric_value").default(1).notNull(),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userBillingPeriods = pgTable("user_billing_periods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end"),
  role: varchar("role", { length: 50 }).notNull(),
  transcriptsProcessed: integer("transcripts_processed").default(0).notNull(),
  documentsGenerated: integer("documents_generated").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transcripts: many(transcripts),
  arrangements: many(arrangements),
  usageMetrics: many(userUsageMetrics),
  billingPeriods: many(userBillingPeriods),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  user: one(users, {
    fields: [transcripts.userId],
    references: [users.id],
  }),
  arrangement: one(arrangements, {
    fields: [transcripts.id],
    references: [arrangements.transcriptId],
  }),
}));

export const arrangementsRelations = relations(arrangements, ({ one, many }) => ({
  transcript: one(transcripts, {
    fields: [arrangements.transcriptId],
    references: [transcripts.id],
  }),
  user: one(users, {
    fields: [arrangements.userId],
    references: [users.id],
  }),
  documents: many(documents),
  tasks: many(funeralTasks),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  arrangement: one(arrangements, {
    fields: [documents.arrangementId],
    references: [arrangements.id],
  }),
}));

export const funeralTasksRelations = relations(funeralTasks, ({ one }) => ({
  arrangement: one(arrangements, {
    fields: [funeralTasks.arrangementId],
    references: [arrangements.id],
  }),
}));

export const userUsageMetricsRelations = relations(userUsageMetrics, ({ one }) => ({
  user: one(users, {
    fields: [userUsageMetrics.userId],
    references: [users.id],
  }),
}));

export const userBillingPeriodsRelations = relations(userBillingPeriods, ({ one }) => ({
  user: one(users, {
    fields: [userBillingPeriods.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  uploadDate: true,
});

export const insertArrangementSchema = createInsertSchema(arrangements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFuneralTaskSchema = createInsertSchema(funeralTasks).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for password resets
export const insertPasswordResetSchema = createInsertSchema(passwordResets).omit({
  id: true,
  createdAt: true,
});

export const insertUserUsageMetricSchema = createInsertSchema(userUsageMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertUserBillingPeriodSchema = createInsertSchema(userBillingPeriods).omit({
  id: true,
  createdAt: true,
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Arrangement = typeof arrangements.$inferSelect;
export type InsertArrangement = z.infer<typeof insertArrangementSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type FuneralTask = typeof funeralTasks.$inferSelect;
export type InsertFuneralTask = z.infer<typeof insertFuneralTaskSchema>;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
export type UserUsageMetric = typeof userUsageMetrics.$inferSelect;
export type InsertUserUsageMetric = z.infer<typeof insertUserUsageMetricSchema>;
export type UserBillingPeriod = typeof userBillingPeriods.$inferSelect;
export type InsertUserBillingPeriod = z.infer<typeof insertUserBillingPeriodSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;