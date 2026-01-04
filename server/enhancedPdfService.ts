import puppeteer from 'puppeteer';
import { DocumentService } from './documentService';
import type { ExtractedArrangementData } from './aiService';

export interface EnhancedPDFGenerationRequest {
  type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
  arrangementData: ExtractedArrangementData;
  transcriptContent: string;
}

export class EnhancedPDFService {
  static async generatePDF(request: EnhancedPDFGenerationRequest): Promise<Buffer> {
    // Generate the text content first using the existing document service
    const textContent = await DocumentService.generateDocument(request);
    
    // Convert to HTML with enhanced formatting
    const htmlContent = this.convertToHTML(textContent, request);
    
    // Generate PDF from HTML using Puppeteer
    return await this.htmlToPDF(htmlContent);
  }

  static async generatePDFFromText(request: {
    type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
    plainTextContent: string;
    arrangementData: any;
  }): Promise<Buffer> {
    // Convert to HTML with enhanced formatting
    const htmlContent = this.convertToHTML(request.plainTextContent, {
      type: request.type,
      arrangementData: request.arrangementData,
      transcriptContent: ''
    });
    
    // Generate PDF from HTML using Puppeteer
    return await this.htmlToPDF(htmlContent);
  }

  private static convertToHTML(content: string, request: EnhancedPDFGenerationRequest | any): string {
    const title = this.getDocumentTitle(request.type);
    const deceasedName = this.getDeceasedName(request.arrangementData);
    
    // Convert markdown-style content to HTML with enhanced styling
    let htmlContent = this.markdownToHTML(content);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="document">
        <header class="document-header">
            <h1 class="document-title">${title}</h1>
            ${deceasedName ? `<h2 class="deceased-name">${deceasedName}</h2>` : ''}
            <div class="document-meta">
                <span class="generation-date">Generated: ${new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
            </div>
        </header>
        
        <main class="document-content">
            ${htmlContent}
        </main>
        
        <footer class="document-footer">
            <div class="footer-content">
                <span class="page-number">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>
        </footer>
    </div>
</body>
</html>`;
  }

  private static getCSS(): string {
    return `
        @page {
            size: A4;
            margin: 1in;
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 10px;
                color: #666;
            }
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }
        
        /* Global text wrapping for all text elements */
        * {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            hyphens: auto !important;
            white-space: normal !important;
            max-width: 100% !important;
        }
        
        .document {
            max-width: 100%;
            margin: 0 auto;
        }
        
        /* Header Styles */
        .document-header {
            text-align: center;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .document-title {
            font-size: 24pt;
            font-weight: 700;
            color: #2c3e50;
            margin: 0 0 10px 0;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        
        .deceased-name {
            font-size: 18pt;
            font-weight: 400;
            color: #34495e;
            margin: 0 0 15px 0;
            font-style: italic;
        }
        
        .document-meta {
            font-size: 10pt;
            color: #7f8c8d;
            font-weight: 300;
        }
        
        /* Typography */
        h1 {
            font-size: 20pt;
            font-weight: 700;
            color: #2c3e50;
            margin: 30px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #bdc3c7;
            page-break-after: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }
        
        h2 {
            font-size: 16pt;
            font-weight: 600;
            color: #34495e;
            margin: 25px 0 12px 0;
            page-break-after: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: 600;
            color: #34495e;
            margin: 20px 0 10px 0;
            page-break-after: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }
        
        h4 {
            font-size: 12pt;
            font-weight: 600;
            color: #34495e;
            margin: 15px 0 8px 0;
            page-break-after: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }
        
        h5, h6 {
            font-size: 11pt;
            font-weight: 600;
            color: #34495e;
            margin: 12px 0 6px 0;
            page-break-after: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }
        
        /* Paragraph and Text Styles */
        p {
            margin: 0 0 12px 0;
            text-align: left;
            orphans: 2;
            widows: 2;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
            max-width: 100%;
            white-space: normal;
        }
        
        .lead {
            font-size: 13pt;
            font-weight: 400;
            line-height: 1.8;
            margin-bottom: 20px;
            color: #2c3e50;
        }
        
        /* Text Formatting */
        strong, .bold {
            font-weight: 700;
            color: #2c3e50;
        }
        
        em, .italic {
            font-style: italic;
            color: #34495e;
        }
        
        .underline {
            text-decoration: underline;
        }
        
        .strike {
            text-decoration: line-through;
        }
        
        /* List Styles */
        ul, ol {
            margin: 12px 0;
            padding-left: 25px;
        }
        
        ul {
            list-style-type: disc;
        }
        
        ul ul {
            list-style-type: circle;
            margin-top: 6px;
            margin-bottom: 6px;
        }
        
        ul ul ul {
            list-style-type: square;
        }
        
        ol {
            list-style-type: decimal;
        }
        
        ol ol {
            list-style-type: lower-alpha;
            margin-top: 6px;
            margin-bottom: 6px;
        }
        
        ol ol ol {
            list-style-type: lower-roman;
        }
        
        li {
            margin: 6px 0;
            line-height: 1.5;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
            white-space: normal;
        }
        
        /* Special Elements */
        blockquote {
            margin: 20px 0;
            padding: 15px 20px;
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            font-style: italic;
            color: #555;
        }
        
        .highlight {
            background-color: #fff3cd;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        .important {
            background-color: #f8d7da;
            padding: 12px 15px;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            margin: 15px 0;
            color: #721c24;
        }
        
        .note {
            background-color: #d1ecf1;
            padding: 12px 15px;
            border: 1px solid #bee5eb;
            border-radius: 5px;
            margin: 15px 0;
            color: #0c5460;
        }
        
        .success {
            background-color: #d4edda;
            padding: 12px 15px;
            border: 1px solid #c3e6cb;
            border-radius: 5px;
            margin: 15px 0;
            color: #155724;
        }
        
        /* Spacing and Layout */
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .section-break {
            border-top: 1px solid #dee2e6;
            margin: 30px 0;
            padding-top: 20px;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        /* Alignment */
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-justify { text-align: justify; }
        
        /* Font Sizes */
        .text-small { font-size: 9pt; }
        .text-normal { font-size: 11pt; }
        .text-large { font-size: 13pt; }
        .text-xl { font-size: 16pt; }
        
        /* Colors */
        .text-muted { color: #6c757d; }
        .text-primary { color: #2c3e50; }
        .text-secondary { color: #34495e; }
        .text-success { color: #27ae60; }
        .text-danger { color: #e74c3c; }
        .text-warning { color: #f39c12; }
        .text-info { color: #3498db; }
        
        /* Footer */
        .document-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 30px;
            border-top: 1px solid #dee2e6;
            padding: 8px 0;
            text-align: center;
            font-size: 9pt;
            color: #6c757d;
            background-color: white;
        }
        
        /* Print optimizations */
        @media print {
            .document-footer {
                display: none;
            }
            
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    `;
  }

  private static markdownToHTML(content: string): string {
    let html = content;

    // First, normalize line endings and clean up excessive whitespace
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Convert headers - handle both with and without spaces after #, and handle ## patterns more precisely
    html = html.replace(/^#{4}\s*(.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^#{3}\s*(.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^#{2}\s*(.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^#{1}\s*(.*$)/gm, '<h1>$1</h1>');
    
    // Also handle headers without spaces (common issue)
    html = html.replace(/^####([^#].*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^###([^#].*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^##([^#].*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^#([^#].*$)/gm, '<h1>$1</h1>');
    
    // Convert bold and italic - be more careful with matching
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    
    // Convert underline and strikethrough
    html = html.replace(/__([^_]+)__/g, '<span class="underline">$1</span>');
    html = html.replace(/~~([^~]+)~~/g, '<span class="strike">$1</span>');
    
    // Convert special blocks
    html = html.replace(/^>\s*(.*$)/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^!!!\s*(.*$)/gm, '<div class="important">$1</div>');
    html = html.replace(/^!!\s*(.*$)/gm, '<div class="note">$1</div>');
    html = html.replace(/^!\s*(.*$)/gm, '<div class="success">$1</div>');
    
    // Handle lists more carefully
    html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="ordered">$1</li>');
    
    // Group consecutive list items
    html = html.replace(/(<li>.*?<\/li>)\s*(?=<li>)/gs, '$1');
    html = html.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');
    html = html.replace(/(<li class="ordered">.*?<\/li>(?:\s*<li class="ordered">.*?<\/li>)*)/gs, '<ol>$1</ol>');
    html = html.replace(/class="ordered"/g, '');
    
    // Split content into lines for better processing
    const lines = html.split('\n');
    const processedLines = [];
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // If it's an empty line, close current paragraph and add spacing
      if (line === '') {
        if (currentParagraph) {
          processedLines.push(`<p>${currentParagraph}</p>`);
          currentParagraph = '';
        }
        // Add a line break for spacing between elements
        processedLines.push('<br>');
        continue;
      }
      
      // If it's a header, list, or other block element, process it directly
      if (line.match(/^<(h[1-6]|ul|ol|li|blockquote|div)/)) {
        // Close any open paragraph first
        if (currentParagraph) {
          processedLines.push(`<p>${currentParagraph}</p>`);
          currentParagraph = '';
        }
        processedLines.push(line);
        continue;
      }
      
      // If it's regular text, add to current paragraph
      if (currentParagraph) {
        currentParagraph += ' ' + line;
      } else {
        currentParagraph = line;
      }
    }
    
    // Close any remaining paragraph
    if (currentParagraph) {
      processedLines.push(`<p>${currentParagraph}</p>`);
    }
    
    html = processedLines.join('\n');
    
    // Clean up multiple consecutive breaks and other formatting issues
    html = html.replace(/(<br>\s*){3,}/g, '<br><br>'); // Limit consecutive breaks
    html = html.replace(/<br>\s*<\/p>/g, '</p>'); // Remove breaks before closing paragraphs
    html = html.replace(/<p>\s*<br>/g, '<p>'); // Remove breaks after opening paragraphs
    html = html.replace(/<\/h[1-6]>\s*<br>/g, (match) => match.replace('<br>', '')); // Remove breaks after headers
    
    return html;
  }

  private static async htmlToPDF(htmlContent: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in'
        },
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
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