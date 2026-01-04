import { users, transcripts, arrangements, documents, funeralTasks, passwordResets, userUsageMetrics, userBillingPeriods, type User, type InsertUser, type Transcript, type InsertTranscript, type Arrangement, type InsertArrangement, type Document, type InsertDocument, type FuneralTask, type InsertFuneralTask, type PasswordReset, type InsertPasswordReset, type UserUsageMetric, type InsertUserUsageMetric, type UserBillingPeriod, type InsertUserBillingPeriod } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;
  updateUserRole(userId: number, role: string): Promise<User>;

  // Transcript operations
  getTranscriptsByUserId(userId: number, limit?: number): Promise<Transcript[]>;
  getTranscriptById(id: number, userId: number): Promise<Transcript | undefined>;
  createTranscript(transcript: InsertTranscript): Promise<Transcript>;
  deleteTranscript(id: number, userId: number): Promise<void>;
  searchTranscripts(userId: number, query: string): Promise<Transcript[]>;
  getTranscriptStats(userId: number): Promise<{
    total: number;
    processed: number;
    pending: number;
    monthly: number;
    reviewRequired: number;
    documents: number;
  }>;

  // Arrangement operations
  createArrangement(arrangement: InsertArrangement): Promise<Arrangement>;
  getArrangementById(id: number): Promise<Arrangement | undefined>;
  getArrangementByTranscriptId(transcriptId: number): Promise<Arrangement | undefined>;
  updateArrangement(id: number, updates: Partial<Arrangement>): Promise<Arrangement>;
  updateTranscriptStatus(id: number, status: string): Promise<void>;

  // Password reset operations
  createPasswordReset(passwordReset: InsertPasswordReset): Promise<PasswordReset>;
  getPasswordReset(token: string): Promise<PasswordReset | undefined>;
  deletePasswordReset(token: string): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;

  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByArrangementId(arrangementId: number): Promise<Document[]>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document>;
  getDocumentById(id: number): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;

  // Task operations
  createTask(task: InsertFuneralTask): Promise<FuneralTask>;
  getTasksByArrangementId(arrangementId: number): Promise<FuneralTask[]>;
  updateTask(id: number, updates: Partial<FuneralTask>): Promise<FuneralTask>;

  // Usage analytics operations
  trackUsageMetric(userId: number, metricType: 'transcript_processed' | 'document_generated'): Promise<void>;
  getUserUsageStats(userId: number, startDate?: Date, endDate?: Date): Promise<{
    transcriptsProcessed: number;
    documentsGenerated: number;
  }>;
  getUserUsageTrends(userId: number, months: number): Promise<Array<{
    month: string;
    transcriptsProcessed: number;
    documentsGenerated: number;
  }>>;
  getAllUsersUsageStats(startDate?: Date, endDate?: Date): Promise<Array<{
    userId: number;
    userName: string;
    email: string;
    role: string;
    transcriptsProcessed: number;
    documentsGenerated: number;
    billingPeriodStart: Date;
  }>>;
  createBillingPeriod(billingPeriod: InsertUserBillingPeriod): Promise<UserBillingPeriod>;
  updateUserRoleAndResetBilling(userId: number, newRole: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserRole(userId: number, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getTranscriptsByUserId(userId: number, limit?: number): Promise<Transcript[]> {
    const baseQuery = db
      .select()
      .from(transcripts)
      .where(eq(transcripts.userId, userId))
      .orderBy(desc(transcripts.uploadDate));

    if (limit) {
      return await baseQuery.limit(limit);
    }

    return await baseQuery;
  }

  async getTranscriptById(id: number, userId: number): Promise<Transcript | undefined> {
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)));
    return transcript || undefined;
  }

  async createTranscript(transcript: InsertTranscript): Promise<Transcript> {
    const [newTranscript] = await db
      .insert(transcripts)
      .values(transcript)
      .returning();
    return newTranscript;
  }

  async deleteTranscript(id: number, userId: number): Promise<void> {
    await db
      .delete(transcripts)
      .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)));
  }

  async searchTranscripts(userId: number, query: string): Promise<Transcript[]> {
    return await db
      .select()
      .from(transcripts)
      .where(
        and(
          eq(transcripts.userId, userId),
          or(
            ilike(transcripts.filename, `%${query}%`),
            ilike(transcripts.content, `%${query}%`)
          )
        )
      )
      .orderBy(desc(transcripts.uploadDate));
  }

  async getTranscriptStats(userId: number): Promise<{
    total: number;
    processed: number;
    pending: number;
    monthly: number;
    reviewRequired: number;
    documents: number;
  }> {
    const userTranscripts = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.userId, userId));

    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const monthlyProcessedTranscripts = userTranscripts.filter(t => {
      if (t.status !== 'processed') return false;
      const uploadDate = new Date(t.uploadDate);
      return uploadDate >= startOfMonth && uploadDate <= endOfMonth;
    });

    // Get arrangements to check approval status for review required count
    const processedTranscripts = userTranscripts.filter(t => t.status === 'processed');
    let reviewRequiredCount = 0;

    for (const transcript of processedTranscripts) {
      const arrangement = await db
        .select()
        .from(arrangements)
        .where(eq(arrangements.transcriptId, transcript.id))
        .limit(1);

      if (arrangement.length > 0 && arrangement[0].approvalStatus !== 'approved') {
        reviewRequiredCount++;
      }
    }

    // Get total documents count for all processed transcripts (only non-deleted documents)
    let documentsCount = 0;
    for (const transcript of processedTranscripts) {
      const arrangement = await db
        .select()
        .from(arrangements)
        .where(eq(arrangements.transcriptId, transcript.id))
        .limit(1);

      if (arrangement.length > 0) {
        // Only count documents that still exist (haven't been deleted)
        const arrangementDocs = await this.getDocumentsByArrangementId(arrangement[0].id);
        documentsCount += arrangementDocs.length;
      }
    }

    return {
      total: userTranscripts.length,
      processed: processedTranscripts.length,
      pending: userTranscripts.filter(t => t.status === 'uploaded' || t.status === 'processing').length,
      monthly: monthlyProcessedTranscripts.length,
      reviewRequired: reviewRequiredCount,
      documents: documentsCount,
    };
  }

  async createArrangement(arrangement: InsertArrangement): Promise<Arrangement> {
    const [newArrangement] = await db
      .insert(arrangements)
      .values(arrangement)
      .returning();
    return newArrangement;
  }

  async createPasswordReset(passwordReset: InsertPasswordReset): Promise<PasswordReset> {
    const [newReset] = await db
      .insert(passwordResets)
      .values(passwordReset)
      .returning();
    return newReset;
  }

  async getPasswordReset(token: string): Promise<PasswordReset | undefined> {
    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token));
    return reset || undefined;
  }

  async deletePasswordReset(token: string): Promise<void> {
    await db
      .delete(passwordResets)
      .where(eq(passwordResets.token, token));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async getArrangementById(id: number): Promise<Arrangement | undefined> {
    const [arrangement] = await db
      .select()
      .from(arrangements)
      .where(eq(arrangements.id, id));
    return arrangement || undefined;
  }

  async getArrangementByTranscriptId(transcriptId: number): Promise<Arrangement | undefined> {
    const [arrangement] = await db
      .select()
      .from(arrangements)
      .where(eq(arrangements.transcriptId, transcriptId));
    return arrangement || undefined;
  }

  async updateArrangement(id: number, updates: Partial<Arrangement>): Promise<Arrangement> {
    const [updatedArrangement] = await db
      .update(arrangements)
      .set(updates)
      .where(eq(arrangements.id, id))
      .returning();
    return updatedArrangement;
  }

  async updateTranscriptStatus(id: number, status: string): Promise<void> {
    await db
      .update(transcripts)
      .set({ status })
      .where(eq(transcripts.id, id));
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async getDocumentsByArrangementId(arrangementId: number): Promise<Document[]> {
    return await db
      .select({
        id: documents.id,
        arrangementId: documents.arrangementId,
        type: documents.type,
        title: documents.title,
        content: documents.content,
        plainTextContent: documents.plainTextContent,
        status: documents.status,
        version: documents.version,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.arrangementId, arrangementId))
      .orderBy(desc(documents.createdAt));
  }

  async updateDocument(id: number, updates: Partial<Document>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();

    if (!updatedDocument) {
      throw new Error('Document not found');
    }

    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select({
        id: documents.id,
        arrangementId: documents.arrangementId,
        type: documents.type,
        title: documents.title,
        content: documents.content,
        plainTextContent: documents.plainTextContent,
        status: documents.status,
        version: documents.version,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  // Task operations
  async createTask(task: InsertFuneralTask): Promise<FuneralTask> {
    const [newTask] = await db.insert(funeralTasks).values(task).returning();
    return newTask;
  }

  async getTasksByArrangementId(arrangementId: number): Promise<FuneralTask[]> {
    return await db.select().from(funeralTasks).where(eq(funeralTasks.arrangementId, arrangementId)).orderBy(desc(funeralTasks.createdAt));
  }

  async updateTask(id: number, updates: Partial<FuneralTask>): Promise<FuneralTask> {
    const [updatedTask] = await db.update(funeralTasks)
      .set(updates)
      .where(eq(funeralTasks.id, id))
      .returning();
    return updatedTask;
  }

  // Usage analytics operations
  async trackUsageMetric(userId: number, metricType: 'transcript_processed' | 'document_generated'): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    await db.insert(userUsageMetrics).values({
      userId,
      metricType,
      metricValue: 1,
      billingPeriodStart: user.billingPeriodStart,
    });
  }

  async getUserUsageStats(userId: number, startDate?: Date, endDate?: Date): Promise<{
    transcriptsProcessed: number;
    documentsGenerated: number;
  }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { transcriptsProcessed: 0, documentsGenerated: 0 };
    }

    const start = startDate || user.billingPeriodStart;
    const end = endDate || new Date();

    const metrics = await db
      .select()
      .from(userUsageMetrics)
      .where(
        and(
          eq(userUsageMetrics.userId, userId),
          eq(userUsageMetrics.billingPeriodStart, user.billingPeriodStart)
        )
      );

    const transcriptsProcessed = metrics
      .filter(m => m.metricType === 'transcript_processed')
      .reduce((sum, m) => sum + m.metricValue, 0);

    const documentsGenerated = metrics
      .filter(m => m.metricType === 'document_generated')
      .reduce((sum, m) => sum + m.metricValue, 0);

    return { transcriptsProcessed, documentsGenerated };
  }

  async getUserUsageTrends(userId: number, months: number): Promise<Array<{
    month: string;
    transcriptsProcessed: number;
    documentsGenerated: number;
  }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const metrics = await db
      .select()
      .from(userUsageMetrics)
      .where(
        and(
          eq(userUsageMetrics.userId, userId),
          // Add date filtering here if needed
        )
      );

    // Group by month and aggregate
    const monthlyData = new Map<string, { transcripts: number; documents: number }>();

    for (const metric of metrics) {
      const monthKey = metric.createdAt.toISOString().substring(0, 7); // YYYY-MM format
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { transcripts: 0, documents: 0 });
      }

      const data = monthlyData.get(monthKey)!;
      if (metric.metricType === 'transcript_processed') {
        data.transcripts += metric.metricValue;
      } else if (metric.metricType === 'document_generated') {
        data.documents += metric.metricValue;
      }
    }

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      transcriptsProcessed: data.transcripts,
      documentsGenerated: data.documents,
    })).sort((a, b) => a.month.localeCompare(b.month));
  }

  async getAllUsersUsageStats(startDate?: Date, endDate?: Date): Promise<Array<{
    userId: number;
    userName: string;
    email: string;
    role: string;
    transcriptsProcessed: number;
    documentsGenerated: number;
    billingPeriodStart: Date;
  }>> {
    const allUsers = await this.getAllUsers();
    const results = [];

    for (const user of allUsers) {
      const stats = await this.getUserUsageStats(user.id, startDate, endDate);
      results.push({
        userId: user.id,
        userName: user.name,
        email: user.email,
        role: user.role,
        transcriptsProcessed: stats.transcriptsProcessed,
        documentsGenerated: stats.documentsGenerated,
        billingPeriodStart: user.billingPeriodStart,
      });
    }

    return results;
  }

  async createBillingPeriod(billingPeriod: InsertUserBillingPeriod): Promise<UserBillingPeriod> {
    const [newPeriod] = await db.insert(userBillingPeriods).values(billingPeriod).returning();
    return newPeriod;
  }

  async updateUserRoleAndResetBilling(userId: number, newRole: string): Promise<User> {
    const now = new Date();

    // Update user role and reset billing period start
    const [updatedUser] = await db
      .update(users)
      .set({ 
        role: newRole, 
        billingPeriodStart: now,
        updatedAt: now 
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('User not found');
    }

    // Create new billing period record
    await this.createBillingPeriod({
      userId,
      periodStart: now,
      role: newRole,
      transcriptsProcessed: 0,
      documentsGenerated: 0,
      isActive: true,
    });

    return updatedUser;
  }
}

export const storage = new DatabaseStorage();