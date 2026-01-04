import { jsPDF } from 'jspdf';
import { DocumentService } from './documentService';
import type { ExtractedArrangementData } from './aiService';

export interface ImprovedPDFGenerationRequest {
  type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
  arrangementData: ExtractedArrangementData;
  transcriptContent: string;
}

interface ParsedContent {
  type: 'header' | 'paragraph' | 'list' | 'bold' | 'italic' | 'separator';
  level?: number;
  content: string;
  styles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSize?: number;
    color?: string;
  };
}

export class ImprovedPDFService {
  static async generatePDF(request: ImprovedPDFGenerationRequest): Promise<Buffer> {
    // Generate the text content first using the existing document service
    const textContent = await DocumentService.generateDocument(request);
    
    // Create enhanced PDF
    return this.createEnhancedPDF(textContent, request);
  }

  static async generatePDFFromText(request: {
    type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
    plainTextContent: string;
    arrangementData: any;
  }): Promise<Buffer> {
    return this.createEnhancedPDF(request.plainTextContent, {
      type: request.type,
      arrangementData: request.arrangementData,
      transcriptContent: ''
    });
  }

  private static createEnhancedPDF(content: string, request: ImprovedPDFGenerationRequest | any): Buffer {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    // Set up page dimensions
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    // Parse and format content
    const parsedContent = this.parseMarkdownContent(content);
    
    // Add document header
    let yPosition = this.addDocumentHeader(doc, request, margin, pageWidth);
    
    // Add content with proper formatting
    yPosition = this.addFormattedContent(doc, parsedContent, margin, contentWidth, yPosition, pageHeight);
    
    // Add footer
    this.addDocumentFooter(doc, pageWidth, pageHeight);

    return Buffer.from(doc.output('arraybuffer'));
  }

  private static parseMarkdownContent(content: string): ParsedContent[] {
    const lines = content.split('\n');
    const parsed: ParsedContent[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        continue; // Skip empty lines
      }

      // Parse headers (check longer patterns first to avoid conflicts)
      if (line.match(/^###\s+/)) {
        parsed.push({
          type: 'header',
          level: 3,
          content: line.replace(/^###\s+/, ''),
          styles: { fontSize: 14, bold: true }
        });
      } else if (line.match(/^##\s+/)) {
        parsed.push({
          type: 'header',
          level: 2,
          content: line.replace(/^##\s+/, ''),
          styles: { fontSize: 16, bold: true }
        });
      } else if (line.match(/^#\s+/) && !line.match(/^##/)) {
        parsed.push({
          type: 'header',
          level: 1,
          content: line.replace(/^#\s+/, ''),
          styles: { fontSize: 18, bold: true }
        });
      }
      // Parse separator lines
      else if (line.startsWith('---') || line === '___') {
        parsed.push({
          type: 'separator',
          content: ''
        });
      }
      // Parse list items
      else if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\.\s/)) {
        parsed.push({
          type: 'list',
          content: line.replace(/^[-*]\s|^\d+\.\s/, ''),
          styles: { fontSize: 11 }
        });
      }
      // Parse regular paragraphs with inline formatting
      else {
        parsed.push({
          type: 'paragraph',
          content: line,
          styles: { fontSize: 11 }
        });
      }
    }

    return parsed;
  }

  private static addDocumentHeader(doc: jsPDF, request: any, margin: number, pageWidth: number): number {
    let yPosition = margin + 20;

    // Document title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const title = this.getDocumentTitle(request.type);
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 30;

    // Deceased name if available
    const deceasedName = this.getDeceasedName(request.arrangementData);
    if (deceasedName) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(deceasedName, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 25;
    }

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Generated: ${date}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 20;

    // Add separator line
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    return yPosition;
  }

  private static addFormattedContent(
    doc: jsPDF, 
    parsedContent: ParsedContent[], 
    margin: number, 
    contentWidth: number, 
    startY: number, 
    pageHeight: number
  ): number {
    let yPosition = startY;
    const lineHeight = 15;
    const bottomMargin = 80;

    for (const item of parsedContent) {
      // Check if we need a new page
      if (yPosition > pageHeight - bottomMargin) {
        doc.addPage();
        yPosition = margin + 20;
      }

      switch (item.type) {
        case 'header':
          yPosition += 15; // Extra space before headers
          doc.setFontSize(item.styles?.fontSize || 14);
          doc.setFont('helvetica', 'bold');
          
          const headerLines = doc.splitTextToSize(item.content, contentWidth);
          doc.text(headerLines, margin, yPosition);
          yPosition += (headerLines.length * lineHeight) + 15; // Extra space after headers
          break;

        case 'separator':
          yPosition += 8;
          doc.setLineWidth(0.5);
          doc.line(margin, yPosition, margin + contentWidth, yPosition);
          yPosition += 20;
          break;

        case 'list':
          doc.setFontSize(11);
          
          // Process inline formatting for list items
          const listSegments = this.parseInlineFormatting(item.content);
          
          // Start with bullet point
          doc.setFont('helvetica', 'normal');
          doc.text('•', margin + 10, yPosition);
          
          // Render the formatted text after the bullet
          this.renderFormattedText(doc, listSegments, margin + 25, contentWidth - 25, yPosition, lineHeight);
          yPosition += lineHeight + 3; // Small spacing between list items
          break;

        case 'paragraph':
          doc.setFontSize(11);
          
          // Process inline formatting
          const segments = this.parseInlineFormatting(item.content);
          const newY = this.renderFormattedText(doc, segments, margin, contentWidth, yPosition, lineHeight);
          yPosition = newY + 12; // Paragraph spacing
          break;
      }
    }

    return yPosition;
  }

  private static parseInlineFormatting(text: string): Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean }> {
    const segments: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean }> = [];
    
    // First handle the bold markers, processing them sequentially
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the bold section
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        if (beforeText.trim()) {
          segments.push({ text: beforeText });
        }
      }
      
      // Add the bold text
      segments.push({ text: match[1], bold: true });
      lastIndex = boldRegex.lastIndex;
    }
    
    // Add any remaining text after the last bold section
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText.trim()) {
        segments.push({ text: remainingText });
      }
    }
    
    // If no bold formatting was found, treat as plain text
    if (segments.length === 0 && text.trim()) {
      segments.push({ text: text });
    }

    return segments;
  }

  private static renderFormattedText(
    doc: jsPDF,
    segments: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean }>,
    startX: number,
    maxWidth: number,
    yPosition: number,
    lineHeight: number
  ): number {
    let currentX = startX;
    let currentY = yPosition;

    for (const segment of segments) {
      if (!segment.text || !segment.text.trim()) continue;

      // Set font style based on formatting
      if (segment.bold && segment.italic) {
        doc.setFont('helvetica', 'bolditalic');
      } else if (segment.bold) {
        doc.setFont('helvetica', 'bold');
      } else if (segment.italic) {
        doc.setFont('helvetica', 'italic');
      } else {
        doc.setFont('helvetica', 'normal');
      }

      // Split text into words for proper wrapping
      const words = segment.text.split(/\s+/).filter(word => word.length > 0);
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const spaceAfter = i < words.length - 1 ? ' ' : '';
        const fullWord = word + spaceAfter;
        const wordWidth = doc.getTextWidth(fullWord);
        
        // Check if we need to wrap to next line
        if (currentX + wordWidth > startX + maxWidth && currentX > startX) {
          currentY += lineHeight;
          currentX = startX;
        }

        // Render the word
        doc.text(word, currentX, currentY);
        
        // Add underline if needed
        if (segment.underline) {
          const actualWordWidth = doc.getTextWidth(word);
          doc.line(currentX, currentY + 1, currentX + actualWordWidth, currentY + 1);
        }

        // Move position for next word
        currentX += doc.getTextWidth(word);
        
        // Add space if not the last word
        if (i < words.length - 1) {
          currentX += doc.getTextWidth(' ');
        }
      }
    }

    return currentY;
  }

  private static processInlineFormatting(text: string): string {
    // Simple cleanup for list items - remove markdown but preserve meaning
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers but keep text
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markers but keep text
      .replace(/__(.*?)__/g, '$1'); // Remove underline markers but keep text
  }

  private static addDocumentFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
    const pageCount = doc.internal.pages.length - 1;
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Add page numbers
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
      
      // Add generation info
      doc.text('Generated by Funeral Arrangement System', pageWidth / 2, pageHeight - 15, { align: 'center' });
    }
  }

  private static getDeceasedName(arrangementData: any): string {
    if (!arrangementData?.arrangement?.basic_information?.deceased_name) {
      return '';
    }
    
    const deceasedName = arrangementData.arrangement.basic_information.deceased_name;
    return `${deceasedName.first} ${deceasedName.middle} ${deceasedName.last} ${deceasedName.suffix}`.trim();
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
}