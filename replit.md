# Funeral Arrangement Management System

## Overview

This is a full-stack web application designed to help funeral directors manage arrangements through AI-powered transcript processing. The system allows users to upload conversation transcripts, extract structured information using AI, and generate professional documents. It's built with a React frontend, Node.js/Express backend, and PostgreSQL database using Drizzle ORM.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Components**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **PWA Support**: Service Worker for offline functionality and app installation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **File Upload**: Multer for handling file uploads
- **AI Integration**: Google Gemini AI and OpenAI for transcript processing
- **PDF Generation**: Multiple PDF generation strategies (jsPDF, Puppeteer)
- **Email Service**: SendGrid for password reset emails

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless connection
- **ORM**: Drizzle ORM for type-safe database operations
- **Migrations**: Drizzle Kit for database schema management
- **Offline Storage**: IndexedDB for offline functionality
- **File Storage**: Local filesystem for uploaded transcripts

## Key Components

### Database Schema
- **Users**: Authentication, roles, and billing period tracking
- **Transcripts**: Uploaded files with processing status
- **Arrangements**: Extracted funeral arrangement data
- **Documents**: Generated documents (contracts, summaries, etc.)
- **Tasks**: Automated checklists and task management
- **Password Resets**: Secure password reset token management

### AI Processing Pipeline
1. **Transcript Upload**: Support for text files, PDFs, and direct text input
2. **Content Extraction**: AI-powered parsing of conversational data
3. **Structured Data**: Extraction into predefined arrangement schema
4. **Document Generation**: Multiple document types from extracted data
5. **Task Creation**: Automated task lists based on arrangement details

### Authentication & Authorization
- **JWT Token**: Stateless authentication with Bearer token
- **Role-based Access**: User and admin roles with protected routes
- **Password Security**: bcrypt hashing with salt rounds
- **Password Reset**: Email-based secure reset flow

## Data Flow

1. **User Authentication**: Login/register → JWT token → Protected routes
2. **Transcript Processing**: Upload → AI analysis → Structured extraction
3. **Document Generation**: Arrangement data → AI processing → PDF/text documents
4. **Task Management**: Arrangement details → Automated task creation → Progress tracking
5. **Offline Support**: Service Worker → IndexedDB → Background sync

## External Dependencies

### AI Services
- **Google Gemini AI**: Primary AI service for content processing
- **OpenAI GPT**: Secondary AI service for document generation
- **Configuration**: Environment variables for API keys and model selection

### Third-party Services
- **Neon Database**: Serverless PostgreSQL hosting
- **SendGrid**: Email delivery service for notifications
- **Replit**: Development and hosting platform integration

### Key Libraries
- **React Ecosystem**: React Query, React Hook Form, Wouter
- **UI Components**: Radix UI, Tailwind CSS, Lucide React icons
- **Backend Tools**: Express, Multer, Puppeteer, jsPDF
- **Validation**: Zod for runtime type checking and validation

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with hot module replacement
- **Backend**: tsx for TypeScript execution in development
- **Database**: Drizzle migrations for schema management

### Production Build
- **Frontend**: Vite build with optimized bundles
- **Backend**: esbuild for Node.js bundle generation
- **Static Assets**: Served from dist/public directory
- **PWA**: Service Worker for offline functionality

### Environment Configuration
- **Database**: PostgreSQL connection via DATABASE_URL
- **AI Services**: API keys for Google Gemini and OpenAI
- **Email**: SendGrid API key for email functionality
- **Security**: JWT secret for token signing

## Changelog

```
Changelog:
- July 11, 2025. Enhanced offline functionality and removed Force Offline Mode testing feature
- July 07, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```