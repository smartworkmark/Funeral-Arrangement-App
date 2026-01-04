import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertTranscriptSchema } from "@shared/schema";
import { sendPasswordResetEmail } from "./email";
import { AIService } from "./aiService";
import { DocumentService } from "./documentService";
import { PDFService } from "./pdfService";
import { EnhancedPDFService } from "./enhancedPdfService";
import { ImprovedPDFService } from "./improvedPdfService";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const upload = multer({ dest: "uploads/" });

// Middleware to verify JWT token
function authenticateToken(req: any, res: any, next: any) {
  console.log("=== AUTH MIDDLEWARE DEBUG ===");
  console.log("Request headers:", JSON.stringify(req.headers, null, 2));
  console.log("Authorization header:", req.headers["authorization"]);
  
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("Extracted token:", token);

  if (!token) {
    console.log("No token provided in request");
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      console.error("Token that failed:", token?.substring(0, 20) + "...");
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    console.log("Token verified successfully for user:", user.userId);
    req.user = user;
    next();
  });
}

// Middleware to verify admin role
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, {
        expiresIn: "7d",
      });

      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          funeralHome: user.funeralHome,
          role: user.role,
        },
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          funeralHome: user.funeralHome,
          role: user.role,
        },
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        funeralHome: user.funeralHome,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);

      // Always respond with success for security (don't reveal if email exists)
      if (user) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Store reset token
        await storage.createPasswordReset({
          email: user.email,
          token: resetToken,
          expiresAt,
        });

        // Send email
        const emailSent = await sendPasswordResetEmail(user.email, resetToken);
        if (!emailSent) {
          console.error('Failed to send password reset email to:', user.email);
        }
      }

      res.json({ message: "If an account with that email exists, we've sent a password reset link." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      // Find valid reset token
      const resetRecord = await storage.getPasswordReset(token);
      if (!resetRecord || new Date() > resetRecord.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Find user
      const user = await storage.getUserByEmail(resetRecord.email);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password
      await storage.updateUserPassword(user.id, hashedPassword);

      // Delete reset token
      await storage.deletePasswordReset(token);

      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile routes
  app.put("/api/auth/profile", authenticateToken, async (req: any, res) => {
    try {
      const { name, email, funeralHome } = req.body;
      const userId = req.user.userId;

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email address is already in use" });
        }
      }

      // Update user profile
      const updates: any = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (funeralHome !== undefined) updates.funeralHome = funeralHome;

      const updatedUser = await storage.updateUser(userId, updates);

      // Remove password from response
      const safeUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        funeralHome: updatedUser.funeralHome,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };

      res.json({ message: "Profile updated successfully", user: safeUser });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/auth/password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUserPassword(userId, hashedNewPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes
  app.get("/api/admin/users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove password from response
      const safeUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        funeralHome: user.funeralHome,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/users/:id/role", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!role || !['user', 'premium', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Valid role is required (user, premium, admin)" });
      }

      // Prevent admin from demoting themselves
      if (userId === req.user.userId && role !== 'admin') {
        return res.status(400).json({ message: "Cannot change your own admin role" });
      }

      const updatedUser = await storage.updateUserRole(userId, role);

      // Remove password from response
      const safeUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        funeralHome: updatedUser.funeralHome,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };

      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transcript routes
  app.get("/api/transcripts", authenticateToken, async (req: any, res) => {
    try {
      const transcripts = await storage.getTranscriptsByUserId(req.user.userId);
      res.json(transcripts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/transcripts/upload", authenticateToken, upload.single("file"), async (req: any, res) => {
    try {
      let content = "";
      let filename = "";
      let fileSize = 0;

      if (req.file) {
        // Handle file upload
        filename = req.file.originalname;
        fileSize = req.file.size;

        // Read file content based on file type
        const filePath = req.file.path;
        const fileExtension = path.extname(filename).toLowerCase();

        if (fileExtension === ".pdf") {
          // For now, PDF parsing requires additional setup
          // Clean up uploaded file
          fs.unlinkSync(filePath);
          return res.status(400).json({ 
            message: "PDF files are not currently supported. Please convert your PDF to text format or copy and paste the content directly." 
          });
        } else {
          // Read as text file
          content = fs.readFileSync(filePath, "utf-8");
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);
      } else if (req.body.content) {
        // Handle direct text input
        content = req.body.content;
        filename = req.body.filename || `transcript_${Date.now()}.txt`;
        fileSize = Buffer.byteLength(content, "utf8");
      } else {
        return res.status(400).json({ message: "No file or content provided" });
      }

      const transcript = await storage.createTranscript({
        userId: req.user.userId,
        filename,
        content,
        fileSize,
        status: "uploaded",
      });

      res.status(201).json(transcript);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transcripts/:id", authenticateToken, async (req: any, res) => {
    try {
      const transcript = await storage.getTranscriptById(
        parseInt(req.params.id),
        req.user.userId
      );

      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      res.json(transcript);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/transcripts/:id", authenticateToken, async (req: any, res) => {
    try {
      await storage.deleteTranscript(parseInt(req.params.id), req.user.userId);
      res.json({ message: "Transcript deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transcripts/search", authenticateToken, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }

      const transcripts = await storage.searchTranscripts(req.user.userId, query);
      res.json(transcripts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", authenticateToken, async (req: any, res) => {
    try {
      const stats = await storage.getTranscriptStats(req.user.userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/recent", authenticateToken, async (req: any, res) => {
    try {
      const recentTranscripts = await storage.getTranscriptsByUserId(req.user.userId, 5);
      res.json(recentTranscripts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Processing endpoints
  app.post("/api/transcripts/:id/process", authenticateToken, async (req: any, res) => {
    try {
      const transcriptId = parseInt(req.params.id);
      const userId = req.user.userId;

      // Get the transcript
      const transcript = await storage.getTranscriptById(transcriptId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      // Update status to processing
      await storage.updateTranscriptStatus(transcriptId, "processing");

      // Process with AI
      const extractedData = await AIService.extractArrangementData(transcript.content);

      // Generate document
      const generatedDoc = await AIService.generateArrangementDocument(extractedData);

      // Check if arrangement already exists
      let arrangement = await storage.getArrangementByTranscriptId(transcriptId);

      if (arrangement) {
        const basic = extractedData.arrangement.basic_information;
        const informant = extractedData.arrangement.informant;
        const arrangements = extractedData.arrangement.arrangements;
        const casket = extractedData.arrangement.casket_container;

        const fullName = [basic.deceased_name.first, basic.deceased_name.middle, basic.deceased_name.last]
          .filter(Boolean).join(' ');

        // Update existing arrangement
        arrangement = await storage.updateArrangement(arrangement.id, {
          deceasedName: fullName,
          deceasedAge: basic.age,
          dateOfDeath: basic.date_of_death,
          causeOfDeath: '',
          serviceType: arrangements.disposition,
          serviceLocation: arrangements.funeral_service_place,
          serviceDate: arrangements.service_date,
          serviceTime: arrangements.service_time,
          arrangerName: informant.name,
          arrangerPhone: informant.phone_number,
          arrangerEmail: informant.email,
          arrangerRelation: informant.relationship_to_deceased,
          casketType: casket.casket,
          flowerPrefs: arrangements.memorials_or_in_lieu_of_flowers,
          specialRequests: extractedData.arrangement.general_notes,
          generatedDoc,
          aiProcessed: true,
          extractedData: JSON.stringify(extractedData),
        });
      } else {
        const basic = extractedData.arrangement.basic_information;
        const informant = extractedData.arrangement.informant;
        const arrangements = extractedData.arrangement.arrangements;
        const casket = extractedData.arrangement.casket_container;

        const fullName = [basic.deceased_name.first, basic.deceased_name.middle, basic.deceased_name.last]
          .filter(Boolean).join(' ');

        // Create new arrangement
        arrangement = await storage.createArrangement({
          transcriptId,
          userId,
          deceasedName: fullName,
          deceasedAge: basic.age,
          dateOfDeath: basic.date_of_death,
          causeOfDeath: '',
          serviceType: arrangements.disposition,
          serviceLocation: arrangements.funeral_service_place,
          serviceDate: arrangements.service_date,
          serviceTime: arrangements.service_time,
          arrangerName: informant.name,
          arrangerPhone: informant.phone_number,
          arrangerEmail: informant.email,
          arrangerRelation: informant.relationship_to_deceased,
          casketType: casket.casket,
          flowerPrefs: arrangements.memorials_or_in_lieu_of_flowers,
          specialRequests: extractedData.arrangement.general_notes,
          generatedDoc,
          aiProcessed: true,
          extractedData: JSON.stringify(extractedData),
        });
      }

      // Update transcript status to processed
      await storage.updateTranscriptStatus(transcriptId, "processed");

      // Track usage metric for transcript processing
      await storage.trackUsageMetric(userId, 'transcript_processed');

      res.json({ 
        message: "Transcript processed successfully",
        arrangement: arrangement,
        extractedData: extractedData
      });
    } catch (error: any) {
      console.error("AI processing error:", error);

      // Update transcript status to error
      const transcriptId = parseInt(req.params.id);
      await storage.updateTranscriptStatus(transcriptId, "error");

      res.status(500).json({ 
        message: "AI processing failed",
        error: error.message 
      });
    }
  });

  app.get("/api/arrangements/:transcriptId", authenticateToken, async (req: any, res) => {
    try {
      const transcriptId = parseInt(req.params.transcriptId);
      const arrangement = await storage.getArrangementByTranscriptId(transcriptId);

      if (!arrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      res.json(arrangement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get arrangement by transcript ID (alternative endpoint)
  app.get("/api/transcripts/:id/arrangement", authenticateToken, async (req: any, res) => {
    try {
      const transcriptId = parseInt(req.params.id);
      const arrangement = await storage.getArrangementByTranscriptId(transcriptId);

      if (!arrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      res.json(arrangement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update arrangement by transcript ID (alternative endpoint)
  app.put("/api/transcripts/:id/arrangement", authenticateToken, async (req: any, res) => {
    try {
      const transcriptId = parseInt(req.params.id);
      const { extractedData } = req.body;

      console.log("PUT /api/transcripts/:id/arrangement - User:", req.user);
      console.log("Update request body:", req.body);
      console.log("Extracted data:", extractedData);

      if (!extractedData) {
        return res.status(400).json({ message: "extractedData is required" });
      }

      // Verify the transcript belongs to the user
      const transcript = await storage.getTranscriptById(transcriptId, req.user.userId);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      // Get existing arrangement
      const existingArrangement = await storage.getArrangementByTranscriptId(transcriptId);
      if (!existingArrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      // Update the arrangement
      const updatedArrangement = await storage.updateArrangement(existingArrangement.id, {
        extractedData
      });

      res.json(updatedArrangement);
    } catch (error: any) {
      console.error("Arrangement update error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/arrangements/:transcriptId", authenticateToken, async (req: any, res) => {
    try {
      const transcriptId = parseInt(req.params.transcriptId);
      const { extractedData } = req.body;

      console.log("Update request body:", req.body);
      console.log("Extracted data:", extractedData);

      if (!extractedData) {
        return res.status(400).json({ message: "extractedData is required" });
      }

      // Verify the transcript belongs to the user
      const transcript = await storage.getTranscriptById(transcriptId, req.user.userId);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      // Get existing arrangement
      const existingArrangement = await storage.getArrangementByTranscriptId(transcriptId);
      if (!existingArrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      // Update the arrangement
      const updatedArrangement = await storage.updateArrangement(existingArrangement.id, {
        extractedData
      });

      res.json(updatedArrangement);
    } catch (error: any) {
      console.error("Arrangement update error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  function getDocumentTitle(type: string, arrangementData: any): string {
    switch (type) {
      case 'contract':
        return 'Funeral Services Contract';
      case 'summary':
        return 'Arrangement Summary';
      case 'obituary':
        return 'Obituary Draft';
      case 'tasks':
        return 'Tasks List';
      case 'arranger_tasks':
        return 'Arranger Task List';
      case 'death_cert':
        return 'Death Certificate Information';
      default:
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Document`;
    }
  }

  // Approval workflow - approve arrangement and generate documents
  app.post("/api/arrangements/:id/approve", authenticateToken, async (req: any, res) => {
    try {
      const arrangementId = parseInt(req.params.id);

      // Get the arrangement
      const arrangement = await storage.getArrangementById(arrangementId);
      if (!arrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      // Get the original transcript
      const transcript = await storage.getTranscriptById(arrangement.transcriptId, req.user.userId);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      // Update arrangement status to approved
      await storage.updateArrangement(arrangementId, { 
        approvalStatus: 'approved',
        approvedAt: new Date()
      });

      // Generate all document types automatically
      const documentTypes = ['contract', 'summary', 'obituary', 'tasks', 'arranger_tasks', 'death_cert'];
      const generatedDocuments = [];
      const failedDocuments = [];

      for (const type of documentTypes) {
        try {
          console.log(`Starting generation of ${type} document...`);

          // Generate plain text content first
          const plainTextContent = await DocumentService.generateDocument({
            type: type as any,
            arrangementData: JSON.parse(arrangement.extractedData || '{}'),
            transcriptContent: transcript.content
          });

          const pdfBuffer = await PDFService.generatePDF({
            type: type as any,
            arrangementData: JSON.parse(arrangement.extractedData || '{}'),
            transcriptContent: transcript.content
          });

          const base64Content = pdfBuffer.toString('base64');

          const document = await storage.createDocument({
            arrangementId,
            type,
            title: getDocumentTitle(type, JSON.parse(arrangement.extractedData || '{}')),
            content: base64Content,
            plainTextContent: plainTextContent,
            status: 'generated'
          });

          generatedDocuments.push(document);
          
          // Track usage metric for each document generated
          await storage.trackUsageMetric(req.user.userId, 'document_generated');
          
          console.log(`Successfully generated ${type} document`);
        } catch (error) {
          console.error(`Error generating ${type} document:`, error);
          failedDocuments.push({ type, error: error instanceof Error ? error.message : 'Unknown error' });

          // Create a text-only document as fallback
          try {
            const textContent = await DocumentService.generateDocument({
              type: type as any,
              arrangementData: JSON.parse(arrangement.extractedData || '{}'),
              transcriptContent: transcript.content
            });

            const document = await storage.createDocument({
              arrangementId,
              type,
              title: `${type.charAt(0).toUpperCase() + type.slice(1)} Document (Text)`,
              content: Buffer.from(textContent).toString('base64'),
              status: 'generated'
            });

            generatedDocuments.push(document);
            
            // Track usage metric for fallback document as well
            await storage.trackUsageMetric(req.user.userId, 'document_generated');
            
            console.log(`Generated fallback text document for ${type}`);
          } catch (fallbackError) {
            console.error(`Failed to generate fallback for ${type}:`, fallbackError);
          }
        }
      }

      // Generate tasks automatically
      try {
        const tasksContent = await DocumentService.generateDocument({
          type: 'tasks',
          arrangementData: arrangement.extractedData,
          transcriptContent: transcript.content
        });

        // Parse tasks and create individual task records
        // For now, create a single task document
        await storage.createTask({
          arrangementId,
          type: 'task',
          title: 'Complete Funeral Arrangements',
          description: tasksContent,
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        });
      } catch (error) {
        console.error("Error creating tasks:", error);
      }

      res.json({ 
        message: 'Arrangement approved and documents generated',
        documents: generatedDocuments,
        failedDocuments: failedDocuments.length > 0 ? failedDocuments : undefined,
        arrangement: await storage.getArrangementById(arrangementId)
      });
    } catch (error: any) {
      console.error("Approval error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate all documents for an arrangement
  app.post("/api/arrangements/:id/regenerate-all", authenticateToken, async (req: any, res) => {
    try {
      const arrangementId = parseInt(req.params.id);

      // Get the arrangement
      const arrangement = await storage.getArrangementById(arrangementId);
      if (!arrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      // Get the original transcript
      const transcript = await storage.getTranscriptById(arrangement.transcriptId, req.user.userId);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      // Generate all document types automatically
      const documentTypes = ['contract', 'summary', 'obituary', 'tasks', 'arranger_tasks', 'death_cert'];
      const generatedDocuments = [];

      for (const type of documentTypes) {
        try {
          // Generate plain text content first
          const plainTextContent = await DocumentService.generateDocument({
            type: type as any,
            arrangementData: JSON.parse(arrangement.extractedData || '{}'),
            transcriptContent: transcript.content
          });

          const pdfBuffer = await ImprovedPDFService.generatePDF({
            type: type as any,
            arrangementData: JSON.parse(arrangement.extractedData || '{}'),
            transcriptContent: transcript.content
          });

          const base64Content = pdfBuffer.toString('base64');

          const document = await storage.createDocument({
            arrangementId,
            type,
            title: getDocumentTitle(type, JSON.parse(arrangement.extractedData || '{}')),
            content: base64Content,
            plainTextContent: plainTextContent,
            status: 'generated'
          });

          generatedDocuments.push(document);

        // Track usage metric for document generation
        await storage.trackUsageMetric(req.user.userId, 'document_generated');
        } catch (error) {
          console.error(`Error regenerating ${type} document:`, error);
        }
      }

      res.json({ 
        message: 'All documents regenerated successfully',
        documents: generatedDocuments
      });
    } catch (error: any) {
      console.error("Regenerate all documents error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get documents for an arrangement
  app.get("/api/arrangements/:id/documents", authenticateToken, async (req: any, res) => {
    try {
      const arrangementId = parseInt(req.params.id);
      const documents = await storage.getDocumentsByArrangementId(arrangementId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get document content for webhook processing
  app.get("/api/documents/:id/content", authenticateToken, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocumentById(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json({
        id: document.id,
        type: document.type,
        title: document.title,
        plainTextContent: document.plainTextContent,
        content: document.content
      });
    } catch (error: any) {
      console.error("Get document content error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Download PDF document
  app.get("/api/documents/:id/download", authenticateToken, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocumentById(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Convert base64 back to buffer
      const pdfBuffer = Buffer.from(document.content || '', 'base64');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + document.title + '.pdf"');
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Download document error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get tasks for an arrangement
  app.get("/api/arrangements/:id/tasks", authenticateToken, async (req: any, res) => {
    try {
      const arrangementId = parseInt(req.params.id);
      const tasks = await storage.getTasksByArrangementId(arrangementId);
      res.json(tasks);
} catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate individual document
  app.post("/api/documents/generate", authenticateToken, async (req: any, res) => {
    try {
      const { arrangementId, type, enhanced, styleSpecifications } = req.body;

      const arrangement = await storage.getArrangementById(arrangementId);
      if (!arrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      const transcript = await storage.getTranscriptById(arrangement.transcriptId, req.user.userId);
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }

      // Generate plain text content first
      const plainTextContent = await DocumentService.generateDocument({
        type: type as any,
        arrangementData: JSON.parse(arrangement.extractedData || '{}'),
        transcriptContent: transcript.content,
        styleSpecifications: styleSpecifications // Pass style specifications to the document service
      });

      // Choose PDF service based on enhanced flag
      const pdfBuffer = enhanced
        ? await ImprovedPDFService.generatePDF({
            type: type as any,
            arrangementData: JSON.parse(arrangement.extractedData || '{}'),
            transcriptContent: transcript.content
          })
        : await PDFService.generatePDF({
            type: type as any,
            arrangementData: JSON.parse(arrangement.extractedData || '{}'),
            transcriptContent: transcript.content
          });

      const base64Content = pdfBuffer.toString('base64');

      const document = await storage.createDocument({
        arrangementId,
        type,
        title: getDocumentTitle(type, JSON.parse(arrangement.extractedData || '{}')),
        content: base64Content,
        plainTextContent: plainTextContent,
        status: 'generated'
      });

      // Track usage metric for document generation
      await storage.trackUsageMetric(req.user.userId, 'document_generated');

      res.json({ document });
    } catch (error) {
      console.error("Document generation error:", error);
      res.status(500).json({ message: "Failed to generate document" });
    }
  });

  // Update document content
  app.patch("/api/documents/:id", authenticateToken, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { plainTextContent, enhanced = true } = req.body; // Default to enhanced formatting

      // Get the current document to access arrangement data
      const currentDoc = await storage.getDocumentById(documentId);
      if (!currentDoc) {
        return res.status(404).json({ message: "Document not found" });
      }

      const arrangement = await storage.getArrangementById(currentDoc.arrangementId);
      if (!arrangement) {
        return res.status(404).json({ message: "Arrangement not found" });
      }

      // Regenerate PDF with updated content using appropriate service
      const pdfBuffer = enhanced
        ? await ImprovedPDFService.generatePDFFromText({
            type: currentDoc.type as any,
            plainTextContent: plainTextContent,
            arrangementData: JSON.parse(arrangement.extractedData || '{}')
          })
        : await PDFService.generatePDFFromText({
            type: currentDoc.type as any,
            plainTextContent: plainTextContent,
            arrangementData: JSON.parse(arrangement.extractedData || '{}')
          });

      const base64Content = pdfBuffer.toString('base64');

      const document = await storage.updateDocument(documentId, {
        content: base64Content,
        plainTextContent: plainTextContent
      });

      res.json({ document });
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", authenticateToken, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update task status
  app.patch("/api/tasks/:id", authenticateToken, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const updates = req.body;

      const updatedTask = await storage.updateTask(taskId, updates);
      res.json(updatedTask);
    } catch (error: any) {
      console.error("Task update error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/documents/enhanced-pdf', authenticateToken, async (req, res) => {
    try {
      const { type, arrangementData, transcriptContent } = req.body;

      console.log('Generating enhanced PDF for type:', type);

      const pdfBuffer = await EnhancedPDFService.generatePDF({
        type,
        arrangementData,
        transcriptContent
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + type + '-document.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Enhanced PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate enhanced PDF' });
    }
  });

  app.post('/api/documents/enhanced-pdf-from-text', authenticateToken, async (req, res) => {
    try {
      const { type, plainTextContent, arrangementData } = req.body;

      console.log('Generating enhanced PDF from text for type:', type);

      const pdfBuffer = await EnhancedPDFService.generatePDFFromText({
        type,
        plainTextContent,
        arrangementData
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + type + '-document.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Enhanced PDF from text generation error:', error);
      res.status(500).json({ error: 'Failed to generate enhanced PDF from text' });
    }
  });

  // Generate markdown document with AI
  app.post('/api/documents/generate-markdown', authenticateToken, async (req: any, res) => {
    try {
      const { arrangementData, type = 'comprehensive_arrangement' } = req.body;

      if (!arrangementData) {
        return res.status(400).json({ message: 'Arrangement data is required' });
      }

      // Generate comprehensive markdown document using AI
      const markdownText = await AIService.generateMarkdownDocument(arrangementData, type);

      res.json({ markdownText });
    } catch (error: any) {
      console.error('Markdown generation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to reconcile historical usage metrics
  app.post("/api/admin/reconcile-metrics", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      // Get all users
      const users = await storage.getAllUsers();
      let totalTranscriptsBackfilled = 0;
      let totalDocumentsBackfilled = 0;

      for (const user of users) {
        // Get all transcripts processed before usage tracking started
        const transcripts = await storage.getTranscriptsByUserId(user.id);
        const processedTranscripts = transcripts.filter(t => t.status === 'processed');

        // Get existing metrics to avoid duplicates
        const existingMetrics = await db
          .select()
          .from(userUsageMetrics)
          .where(and(
            eq(userUsageMetrics.userId, user.id),
            eq(userUsageMetrics.billingPeriodStart, user.billingPeriodStart)
          ));

        const existingTranscriptMetrics = existingMetrics.filter(m => m.metricType === 'transcript_processed').length;
        const existingDocumentMetrics = existingMetrics.filter(m => m.metricType === 'document_generated').length;

        // Backfill missing transcript metrics
        const missingTranscriptMetrics = processedTranscripts.length - existingTranscriptMetrics;
        for (let i = 0; i < missingTranscriptMetrics; i++) {
          await storage.trackUsageMetric(user.id, 'transcript_processed');
          totalTranscriptsBackfilled++;
        }

        // Count actual documents in database for this user
        const actualDocuments = await db
          .select()
          .from(documents)
          .innerJoin(arrangements, eq(documents.arrangementId, arrangements.id))
          .innerJoin(transcripts, eq(arrangements.transcriptId, transcripts.id))
          .where(eq(transcripts.userId, user.id));

        // Backfill missing document metrics
        const missingDocumentMetrics = actualDocuments.length - existingDocumentMetrics;
        for (let i = 0; i < missingDocumentMetrics; i++) {
          await storage.trackUsageMetric(user.id, 'document_generated');
          totalDocumentsBackfilled++;
        }
      }

      res.json({
        message: 'Historical usage metrics reconciled successfully',
        transcriptsBackfilled: totalTranscriptsBackfilled,
        documentsBackfilled: totalDocumentsBackfilled
      });
    } catch (error: any) {
      console.error("Reconcile metrics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Usage Analytics API Routes
  app.get("/api/analytics/user/:userId/stats", authenticateToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { startDate, endDate } = req.query;

      // Users can only access their own stats unless they're admin
      if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const stats = await storage.getUserUsageStats(userId, start, end);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analytics/user/:userId/trends", authenticateToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const months = parseInt(req.query.months) || 6;

      // Users can only access their own trends unless they're admin
      if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const trends = await storage.getUserUsageTrends(userId, months);
      res.json(trends);
    } catch (error: any) {
      console.error("Error fetching user trends:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Analytics Routes
  app.get("/api/analytics/admin/all-users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const allUsersStats = await storage.getAllUsersUsageStats(start, end);
      res.json(allUsersStats);
    } catch (error: any) {
      console.error("Error fetching all users stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // User role management with billing reset
  app.put("/api/admin/users/:userId/role", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      const updatedUser = await storage.updateUserRoleAndResetBilling(userId, role);
      res.json({
        message: "User role updated and billing period reset",
        user: updatedUser
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}