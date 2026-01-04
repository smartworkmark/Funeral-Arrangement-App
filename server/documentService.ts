import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface DocumentGenerationRequest {
  type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'death_cert' | 'arranger_tasks';
  arrangementData: any;
  transcriptContent: string;
}

export class DocumentService {
  static async generateDocument({
    type,
    arrangementData,
    transcriptContent,
    styleSpecifications
  }: {
    type: 'contract' | 'summary' | 'obituary' | 'tasks' | 'arranger_tasks' | 'death_cert';
    arrangementData: any;
    transcriptContent: string;
    styleSpecifications?: string[];
  }): Promise<string> {
    try {
      const prompt = this.getPromptForType(type, arrangementData, transcriptContent, styleSpecifications);

      // Use shorter timeout and implement retry logic
      const timeoutDuration = 15000; // 15 seconds

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI service timeout - request took too long')), timeoutDuration);
      });

      console.log(`Generating ${type} document with Gemini AI...`);

      const completionPromise = model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: type === 'arranger_tasks' ? 4000 : (type === 'tasks' ? 3500 : 3000),
        },
      });

      const result = await Promise.race([completionPromise, timeoutPromise]);

      if (!result || !result.response) {
        throw new Error('No response received from AI service');
      }

      const response = result.response;
      const content = response.text();

      console.log(`Generated ${type} document - content length: ${content?.length || 0}`);

      if (!content || content.trim().length === 0) {
        throw new Error(`Empty content received for ${type} document`);
      }

      return content;
    } catch (error) {
      console.error(`Error generating ${type} document:`, error);

      // Provide fallback content for critical document types
      if (type === 'arranger_tasks') {
        return this.getFallbackArrangerTasks(arrangementData);
      }
      if (type === 'tasks') {
        return this.getFallbackTasks(arrangementData);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate ${type} document: ${errorMessage}`);
    }
  }

  private static getFallbackArrangerTasks(arrangementData: any): string {
    const basic = arrangementData.arrangement?.basic_information || {};
    const arrangements = arrangementData.arrangement?.arrangements || {};

    return `# Family Arranger To-Do List
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

## Immediate Tasks (Next 24 Hours)
- [ ] Contact close family members and friends
- [ ] Confirm service details: ${arrangements.service_date || 'TBD'} at ${arrangements.service_time || 'TBD'}
- [ ] Verify venue: ${arrangements.funeral_service_place || 'TBD'}

## Pre-Service Tasks (2-4 Days Before)
- [ ] Arrange catering for reception
- [ ] Order flowers and arrangements
- [ ] Prepare eulogy and readings
- [ ] Coordinate family transportation
- [ ] Send guest notifications

## Day Before Service
- [ ] Confirm all arrangements
- [ ] Prepare memorial materials
- [ ] Brief family on service order

## Day of Service
- [ ] Arrive early for setup
- [ ] Coordinate with funeral director
- [ ] Greet guests and manage reception

## After Service
- [ ] Send thank you notes
- [ ] Handle final tasks
- [ ] Coordinate memorial donations

*Consult with your funeral director for additional requirements.*`;
  }

  private static getDeceasedFullName(arrangementData: any): string {
    const basic = arrangementData.arrangement?.basic_information;
    if (!basic?.deceased_name) {
      return '';
    }

    const deceasedName = basic.deceased_name;
    return [
      deceasedName.first,
      deceasedName.middle,
      deceasedName.last,
      deceasedName.suffix
    ].filter(Boolean).join(' ');
  }

  private static getFormattedDate(): string {
    return new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  private static getFallbackTasks(arrangementData: any): string {
    const basic = arrangementData.arrangement?.basic_information || {};
    const arrangements = arrangementData.arrangement?.arrangements || {};

    return `# Funeral Director Task Checklist
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

## Immediate Tasks (24 Hours)
- [ ] Complete death certificate coordination
- [ ] Prepare legal documentation
- [ ] Follow up with family consultation
- [ ] Schedule facility arrangements

## Pre-Service Tasks (1-3 Days)
- [ ] Setup service arrangements
- [ ] Confirm vendor services
- [ ] Assign staff responsibilities
- [ ] Prepare equipment and facilities

## Day of Service
- [ ] Coordinate service execution
- [ ] Manage staff and logistics
- [ ] Provide technical support
- [ ] Oversee ceremonial duties

## Post-Service
- [ ] Complete documentation
- [ ] Process final billing
- [ ] Coordinate facility cleanup
- [ ] Follow up with family

Service Details: ${basic.deceased_name?.first} ${basic.deceased_name?.last} - ${arrangements.service_date || 'TBD'}`;
  }

  private static getPromptForType(type: string, arrangementData: any, transcriptContent: string, styleSpecifications?: string[]): string {
    const basic = arrangementData.arrangement?.basic_information || {};
    const arrangements = arrangementData.arrangement?.arrangements || {};
    const informant = arrangementData.arrangement?.informant || {};

    switch (type) {
      case 'contract':
        return `## Role
You are a professional funeral director assistant specializing in creating formal funeral service contracts. Your task is to generate a comprehensive, professional funeral arrangement contract based on the provided arrangement data and transcript.

## Contract Information
Generate a formal funeral service contract that includes:

### Header Information
- Document title: "FUNERAL SERVICE ARRANGEMENT CONTRACT"
- Date of arrangement
- Contract number (generate a reasonable format)

### Parties Involved
- Funeral home information
- Client/informant information
- Deceased information

### Service Details
- Type of service selected
- Date, time, and location of services
- Specific merchandise selected (casket, urn, etc.)
- Additional services requested

### Financial Information
- Itemized list of services and merchandise
- Payment terms and methods
- Total contract amount

### Legal Terms
- Standard funeral service terms and conditions
- Signatures required
- Cancellation policies

## Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

## Original Transcript:
${transcriptContent}

Generate a professional funeral service contract that captures all the agreed-upon services and terms. Use formal legal language appropriate for a binding contract. 

Format the output starting with this exact header structure:
# Funeral Service Contract
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

Then continue with the contract content as clean, professional text that can be easily converted to PDF.`;

      case 'summary':
        return `## Role
You are a professional funeral director creating a concise arrangement summary for internal use and family reference.

## Summary Requirements
Create a clear, organized summary that includes:

### Meeting Overview
- Date and participants
- Key decisions made
- Family preferences expressed

### Service Summary
- Service type and location
- Date and time details
- Special requests or considerations

### Contact Information
- Primary contact person
- Emergency contacts
- Preferred communication methods

### Next Steps
- Immediate tasks to complete
- Items pending family decision
- Follow-up appointments needed

## Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

## Original Transcript:
${transcriptContent}

Generate a professional, concise summary that serves as a comprehensive reference for the funeral arrangement. Use clear, compassionate language suitable for both staff and family review.

Format the output starting with this exact header structure:
# Arrangement Summary
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

Then continue with the summary content.`;

      case 'obituary':
        const styleInstruction = styleSpecifications && styleSpecifications.length > 0 
          ? `\n\n## Style Requirements\nWrite the obituary with the following tonal style(s): ${styleSpecifications.join(", ")}. Ensure the tone is appropriate and respectful while incorporating these stylistic elements.`
          : '';

        return `## Role
You are a compassionate assistant specialized in drafting obituaries that honor the deceased with dignity and capture their unique life story.

## Obituary Guidelines
Create a thoughtful obituary that includes:

### Opening
- Full name, age, and passing information
- Date and place of death (if appropriate)

### Life Story
- Birth information and early life
- Education and career highlights
- Marriage and family information
- Personal interests and achievements
- Community involvement

### Family Information
- Surviving family members
- Those who preceded in death
- Special relationships

### Service Information
- Funeral or memorial service details
- Visitation information
- Burial or cremation details
- Memorial contributions

## Tone Guidelines
- Warm and respectful
- Focus on celebrating life
- Use gentle, dignified language
- Include personal touches that reflect character
- 250-400 words in length

## Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

## Original Transcript:
${transcriptContent}

Create a compassionate obituary that honors the deceased's life and provides comfort to the family. Focus on their unique story and legacy.

Format the output starting with this exact header structure:
# Obituary
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

Then continue with the obituary content.${styleInstruction}`;

      case 'tasks':
        return `## Role
You are a funeral director's assistant creating a comprehensive task list specifically for funeral director responsibilities to ensure all professional aspects of the funeral arrangement are properly managed.

## Task Categories
Organize funeral director tasks into the following categories with specific deadlines:

### Immediate Tasks (Within 24 Hours)
- Death certificate coordination
- Legal documentation preparation
- Initial family consultation follow-up
- Facility scheduling and reservations

### Preparation Tasks (1-3 Days Before Service)
- Professional service setup
- Vendor coordination and confirmations
- Staff assignments and briefings
- Equipment and facility preparation

### Day Before Service
- Final facility setup verification
- Staff coordination meetings
- Equipment testing and preparation
- Final professional arrangements confirmation

### Day of Service
- Service coordination and oversight
- Professional ceremonial duties
- Staff management during service
- Technical and logistical support

### Post-Service Tasks
- Professional follow-up documentation
- Facility cleanup coordination
- Final billing and administrative tasks
- Professional relationship maintenance

## Task Format
For each funeral director task, include:
- Clear professional description
- Responsible funeral home staff member
- Deadline and timing
- Priority level (High/Medium/Low)
- Professional notes and requirements

## Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

## Original Transcript:
${transcriptContent}

Generate a comprehensive, organized task list specifically focused on funeral director and funeral home staff responsibilities. Do not include family tasks - focus only on professional funeral service management.

Format the output starting with this exact header structure:
# Funeral Director Task Checklist
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

Then continue with the task list content.`;

      case 'arranger_tasks':
        return `## Role
You are an AI assistant specializing in funeral arrangement coordination. Your task is to analyze a transcript between a funeral director and funeral arranger, along with any additional verified information, and generate a comprehensive, timeline-based to-do list for the funeral arranger (family member).

## Timeline Structure
Organize all tasks into the following time-based categories:

### Immediate (Next 24 Hours)
- Urgent tasks that must be completed within 24 hours
- Time-sensitive communications
- Critical bookings or confirmations

### Short-term (2-4 Days Before Funeral)
- Preparation tasks with moderate urgency
- Coordination with vendors and service providers
- Family communication and updates

### Final Preparations (Day Before Funeral)
- Last-minute confirmations
- Setup and logistics verification
- Final family communications

### Day of Service
- Morning setup and arrival coordination
- Real-time logistics management
- On-site support and troubleshooting
- Service execution oversight

### Post-Funeral (After Service)
- Follow-up tasks
- Administrative completions
- Family support activities

## Task Formatting Requirements
For each task, include:
- **Priority level** (High/Medium/Low)
- **Estimated time** to complete
- **Responsible party** (if specified)
- **Dependencies** (what must be completed first)
- **Contact information** (when relevant)
- **Specific deadlines** (if mentioned)

## Content Guidelines
Include these types of tasks for the funeral arranger:
- Venue bookings and confirmations
- Catering arrangements
- Floral orders
- Transportation coordination
- Documentation preparation
- Family communications and notifications
- Vendor coordination
- Permits or legal requirements
- Special requests or accommodations
- Memorial materials preparation
- Guest list management
- Reception planning
- Music and reading selections

## Task Detail Level
- Be specific and actionable
- Include relevant contact information
- Note any special instructions or preferences
- Highlight family-specific requests
- Flag potential complications or alternatives

## Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

## Original Transcript:
${transcriptContent}

Generate a comprehensive, timeline-based to-do list specifically for the funeral arranger (family member). Focus on family responsibilities and coordination tasks while maintaining a respectful and professional tone. Be thorough yet clear, ensuring no critical family tasks are overlooked.

Format the output starting with this exact header structure:
# Family Arranger To-Do List
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

Then continue with the to-do list content.`;

      case 'death_cert':
        return `## Role
You are a vital records specialist assistant helping to compile information needed for death certificate completion.

## Information Required
Extract and organize the following information from the arrangement data and transcript:

### Personal Information
- Full legal name (including maiden name if applicable)
- Date of birth
- Place of birth
- Social Security Number (if mentioned)
- Marital status
- Spouse information

### Death Information
- Date of death
- Time of death (if available)
- Place of death
- Immediate cause of death
- Contributing factors

### Family Information
- Father's full name
- Mother's full name (including maiden name)
- Informant information

### Additional Details
- Occupation and industry
- Education level
- Military service information
- Usual residence

## Output Format
Present the information in a clear, organized format that can be easily referenced when completing official death certificates. Note any missing information that will need to be obtained.

## Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

## Original Transcript:
${transcriptContent}

Compile all available death certificate information from the provided sources. Clearly indicate any missing information that will need verification from other sources.

Format the output starting with this exact header structure:
# Death Certificate Information
${this.getDeceasedFullName(arrangementData)}
<div style="text-align: right;">Generated: ${this.getFormattedDate()}</div>

---

Then continue with the death certificate information.`;

      default:
        throw new Error(`Unknown document type: ${type}`);
    }
  }
}