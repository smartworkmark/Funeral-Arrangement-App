import { jsPDF } from 'jspdf';
import { DocumentService } from './documentService';
import type { ExtractedArrangementData } from './aiService';

export interface PDFGenerationRequest {
  type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
  arrangementData: ExtractedArrangementData;
  transcriptContent: string;
}

export class PDFService {
  static async generatePDF(request: PDFGenerationRequest): Promise<Buffer> {
    const doc = new jsPDF();
    
    // Generate the text content first using the existing document service
    const textContent = await DocumentService.generateDocument(request);
    
    // Apply formatting and styling
    const formattedContent = this.formatContent(textContent, request.type);
    
    // Add content to PDF with proper styling
    this.addContentToPDF(doc, formattedContent, request);
    
    // Return as buffer
    return Buffer.from(doc.output('arraybuffer'));
  }

  static async generatePDFFromText(request: {
    type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
    plainTextContent: string;
    arrangementData: any;
  }): Promise<Buffer> {
    const doc = new jsPDF();
    
    // Apply formatting and styling to the provided text
    const formattedContent = this.formatContent(request.plainTextContent, request.type);
    
    // Add content to PDF with proper styling
    this.addContentToPDF(doc, formattedContent, {
      type: request.type,
      arrangementData: request.arrangementData,
      transcriptContent: '' // Not needed for regenerating from text
    });
    
    // Return as buffer
    return Buffer.from(doc.output('arraybuffer'));
  }

  private static formatContent(content: string, type: string): string {
    // Keep markdown formatting for proper PDF rendering
    let formatted = content
      // Clean up excessive capitalization but preserve markdown
      .replace(/[A-Z]{3,}/g, (match) => {
        // Don't change if it's part of markdown formatting
        if (match.includes('**') || match.includes('#')) {
          return match;
        }
        return this.toProperCase(match);
      })
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();

    return formatted;
  }

  private static toProperCase(text: string): string {
    return text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  private static addContentToPDF(doc: jsPDF, content: string, request: PDFGenerationRequest) {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 6;
    const maxWidth = pageWidth - 2 * margin;
    
    let yPosition = margin;

    // Add header
    this.addHeader(doc, request, yPosition);
    yPosition += 30;

    // Add content sections
    const sections = this.parseSections(content);
    
    for (const section of sections) {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      // Add section title
      if (section.title) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, margin, yPosition);
        yPosition += lineHeight + 2;
      }

      // Add section content with markdown formatting
      this.addFormattedContent(doc, section.content, margin, maxWidth, yPosition, lineHeight, pageHeight);
      yPosition = this.getCurrentYPosition();
      
      yPosition += lineHeight; // Extra space between sections
    }

    // Add footer
    this.addFooter(doc);
  }

  private static addHeader(doc: jsPDF, request: PDFGenerationRequest, yPosition: number) {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;

    // Document title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const title = this.getDocumentTitle(request.type);
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });

    // Deceased name if available
    const arrangementData = request.arrangementData;
    if (arrangementData?.arrangement?.basic_information?.deceased_name) {
      const deceasedName = arrangementData.arrangement.basic_information.deceased_name;
      const fullName = `${deceasedName.first} ${deceasedName.middle} ${deceasedName.last} ${deceasedName.suffix}`.trim();
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(fullName, pageWidth / 2, yPosition + 10, { align: 'center' });
    }

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, yPosition, { align: 'right' });
  }

  private static addFooter(doc: jsPDF) {
    const pageCount = doc.internal.pages.length - 1;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }

  private static getDocumentTitle(type: string): string {
    const titles = {
      contract: 'Funeral Service Contract',
      summary: 'Arrangement Summary',
      obituary: 'Obituary',
      tasks: 'Funeral Director Task Checklist',
      arranger_tasks: 'Funeral Arranger To-Do List',
      death_cert: 'Death Certificate Information'
    };
    return titles[type as keyof typeof titles] || 'Funeral Document';
  }

  private static currentYPosition: number = 0;

  private static getCurrentYPosition(): number {
    return this.currentYPosition;
  }

  private static addFormattedContent(doc: jsPDF, content: string, margin: number, maxWidth: number, yPosition: number, lineHeight: number, pageHeight: number) {
    this.currentYPosition = yPosition;
    
    // Split content into parts, handling markdown formatting
    const parts = this.parseMarkdownContent(content);
    
    for (const part of parts) {
      // Check if we need a new page
      if (this.currentYPosition > pageHeight - margin) {
        doc.addPage();
        this.currentYPosition = margin;
      }

      // Set font style and size based on formatting
      if (part.isHeader) {
        // Header styling
        const headerSize = Math.max(16 - part.headerLevel * 2, 12);
        doc.setFontSize(headerSize);
        doc.setFont('helvetica', 'bold');
      } else {
        // Regular text styling
        doc.setFontSize(11);
        if (part.bold) {
          doc.setFont('helvetica', 'bold');
        } else if (part.italic) {
          doc.setFont('helvetica', 'italic');
        } else {
          doc.setFont('helvetica', 'normal');
        }
      }

      // Handle indentation
      const leftMargin = margin + (part.indent * 10);
      
      // Skip empty text parts
      if (!part.text || part.text.trim() === '') {
        if (part.text === '\n') {
          this.currentYPosition += lineHeight * 0.5; // Reduced spacing
        }
        continue;
      }
      
      // Split text to fit width
      const lines = doc.splitTextToSize(part.text, maxWidth - (part.indent * 10));
      
      for (const line of lines) {
        if (this.currentYPosition > pageHeight - margin) {
          doc.addPage();
          this.currentYPosition = margin;
        }
        doc.text(line, leftMargin, this.currentYPosition);
        this.currentYPosition += lineHeight;
      }
      
      // Add extra space after headers
      if (part.isHeader) {
        this.currentYPosition += lineHeight * 0.5;
      }
    }
  }

  private static parseMarkdownContent(content: string): Array<{ text: string; bold: boolean; italic: boolean; indent: number; isHeader: boolean; headerLevel: number }> {
    const parts: Array<{ text: string; bold: boolean; italic: boolean; indent: number; isHeader: boolean; headerLevel: number }> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim() === '') {
        // Skip empty lines entirely to reduce spacing
        continue;
      }

      // Check for markdown headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const headerLevel = headerMatch[1].length;
        const headerText = headerMatch[2];
        parts.push({ 
          text: headerText, 
          bold: true, 
          italic: false, 
          indent: 0, 
          isHeader: true, 
          headerLevel: headerLevel 
        });
        // Add single line break after header
        parts.push({ text: '\n', bold: false, italic: false, indent: 0, isHeader: false, headerLevel: 0 });
        continue;
      }

      // Count indentation (spaces or dashes for bullet points)
      let indent = 0;
      let cleanLine = line;
      
      // Handle bullet points and indentation
      const indentMatch = line.match(/^(\s*[-*]\s*|\s+)/);
      if (indentMatch) {
        const indentStr = indentMatch[1];
        indent = Math.floor(indentStr.length / 2); // Convert spaces to indent level
        cleanLine = line.substring(indentMatch[0].length);
      }

      // Parse markdown formatting within the line
      this.parseLineMarkdown(cleanLine, indent, parts);
      
      // Add appropriate spacing based on content
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1];
        // Only add line break for new sections or bullet points
        if (this.isNewSection(nextLine) || nextLine.trim().match(/^[-*#]/)) {
          parts.push({ text: '\n', bold: false, italic: false, indent: 0, isHeader: false, headerLevel: 0 });
        } else if (nextLine.trim() !== '') {
          // Add space for continuous text
          parts.push({ text: ' ', bold: false, italic: false, indent: 0, isHeader: false, headerLevel: 0 });
        }
      }
    }
    
    return parts;
  }

  private static isNewSection(line: string): boolean {
    const trimmed = line.trim();
    // Check if line starts with header markers, bullet points, or looks like a section header
    return trimmed.startsWith('#') || 
           trimmed.startsWith('- ') || 
           trimmed.startsWith('* ') ||
           trimmed.startsWith('**') ||
           trimmed.match(/^[A-Z][A-Za-z\s]*:/) !== null;
  }

  private static parseLineMarkdown(line: string, indent: number, parts: Array<{ text: string; bold: boolean; italic: boolean; indent: number; isHeader: boolean; headerLevel: number }>) {
    // Handle mixed formatting within a line
    const regex = /(\*\*.*?\*\*|\*.*?\*|[^*]+)/g;
    let match;
    
    while ((match = regex.exec(line)) !== null) {
      const text = match[1];
      
      if (text.startsWith('**') && text.endsWith('**')) {
        // Bold text
        parts.push({
          text: text.slice(2, -2),
          bold: true,
          italic: false,
          indent: indent,
          isHeader: false,
          headerLevel: 0
        });
      } else if (text.startsWith('*') && text.endsWith('*')) {
        // Italic text
        parts.push({
          text: text.slice(1, -1),
          bold: false,
          italic: true,
          indent: indent,
          isHeader: false,
          headerLevel: 0
        });
      } else if (text.trim()) {
        // Regular text
        parts.push({
          text: text,
          bold: false,
          italic: false,
          indent: indent,
          isHeader: false,
          headerLevel: 0
        });
      }
    }
  }

  private static parseSections(content: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = [];
    const lines = content.split('\n');
    
    let currentSection = { title: '', content: '' };
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this line looks like a section header
      if (trimmedLine.length > 0 && 
          (trimmedLine.endsWith(':') || 
           trimmedLine.match(/^[A-Z][A-Za-z\s]+$/))) {
        
        // Save previous section if it has content
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: trimmedLine.replace(':', ''),
          content: ''
        };
      } else if (trimmedLine.length > 0) {
        // Add to current section content
        if (currentSection.content) {
          currentSection.content += '\n';
        }
        currentSection.content += trimmedLine;
      }
    }
    
    // Add the last section
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }
    
    // If no sections were found, treat entire content as one section
    if (sections.length === 0) {
      sections.push({ title: '', content: content });
    }
    
    return sections;
  }
}