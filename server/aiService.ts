import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const SYSTEM_PROMPT = `You are an AI assistant specialized in extracting comprehensive funeral arrangement information from conversation transcripts between funeral directors and families.

Extract the following information from the transcript and return it as structured JSON. Only extract information that is explicitly mentioned in the conversation. Use null for missing numeric values, empty strings for missing text values, and empty arrays for missing lists.

{
  "arrangement": {
    "basic_information": {
      "funeral_director_name": "string",
      "deceased_name": {
        "first": "string",
        "middle": "string",
        "last": "string",
        "suffix": "string"
      },
      "preferred_name": "string",
      "gender": "string",
      "date_of_birth": "string",
      "date_of_death": "string",
      "birthplace": "string",
      "city_of_death": "string",
      "county_of_death": "string",
      "age": null,
      "maiden_name": "string",
      "marital_status": "string",
      "spouse_name": {
        "first": "string",
        "middle": "string",
        "last": "string",
        "maiden": "string"
      },
      "usual_residence": {
        "street": "string",
        "city": "string",
        "county": "string",
        "state": "string",
        "zip": "string"
      },
      "occupation": "string",
      "industry": "string",
      "education_level": "string",
      "military_service": {
        "served": false,
        "branch": "string",
        "service_dates": "string"
      },
      "dd_214": "string",
      "father_name": {
        "first": "string",
        "middle": "string",
        "last": "string"
      },
      "mother_name": {
        "first": "string",
        "middle": "string",
        "maiden": "string"
      },
      "children": [],
      "siblings": [],
      "grandchildren": "string",
      "great_grandchildren": "string",
      "physician_info": "string",
      "biographical_info": "string",
      "preceded_in_death_by": "string"
    },
    "informant": {
      "name": "string",
      "phone_number": "string",
      "email": "string",
      "relationship_to_deceased": "string",
      "financially_responsible_party": {
        "name": "string",
        "phone_number": "string",
        "address": "string",
        "email": "string"
      },
      "method_of_payment": "string"
    },
    "arrangements": {
      "disposition": "string",
      "place_of_disposition": "string",
      "funeral_service_place": "string",
      "service_date": "string",
      "service_time": "string",
      "visitation_place": "string",
      "visitation_date_time": "string",
      "other_times_at": "string",
      "phone_number": "string",
      "first_viewing_time": "string",
      "clergy": "string",
      "music": "string",
      "pallbearers": [],
      "honorary_pallbearers": [],
      "memorials_or_in_lieu_of_flowers": "string"
    },
    "final_disposition": {
      "final_disposition_type": "string",
      "cemetery_or_crematory": "string",
      "address": "string",
      "city": "string",
      "county": "string",
      "state": "string",
      "disposition_of_ashes": "string"
    },
    "casket_container": {
      "casket": "string",
      "casket_manufacturer": "string",
      "casket_model": "string",
      "interior_fabric_and_color": "string",
      "cap_panel": "string",
      "exterior_color": "string"
    },
    "outer_burial_enclosure": {
      "manufacturer": "string",
      "model": "string"
    },
    "urn": {
      "manufacturer": "string",
      "model": "string"
    },
    "other": {
      "inscriptions": "string",
      "jewelry_inventory": "string",
      "jewelry_to_remove": "string",
      "embalming_authorization": false,
      "fingerprint_authorization": false,
      "other_merchandise": "string"
    },
    "general_notes": "string"
  }
}`;

export interface ExtractedArrangementData {
  arrangement: {
    basic_information: {
      funeral_director_name: string;
      deceased_name: {
        first: string;
        middle: string;
        last: string;
        suffix: string;
      };
      preferred_name: string;
      gender: string;
      date_of_birth: string;
      date_of_death: string;
      birthplace: string;
      city_of_death: string;
      county_of_death: string;
      age: number | null;
      maiden_name: string;
      marital_status: string;
      spouse_name: {
        first: string;
        middle: string;
        last: string;
        maiden: string;
      };
      usual_residence: {
        street: string;
        city: string;
        county: string;
        state: string;
        zip: string;
      };
      occupation: string;
      industry: string;
      education_level: string;
      military_service: {
        served: boolean;
        branch: string;
        service_dates: string;
      };
      dd_214: string;
      father_name: {
        first: string;
        middle: string;
        last: string;
      };
      mother_name: {
        first: string;
        middle: string;
        maiden: string;
      };
      children: Array<{
        name: string;
        city: string;
        state: string;
        spouse_or_significant_other: string;
      }>;
      siblings: Array<{
        name: string;
        city: string;
        state: string;
      }>;
      grandchildren: string;
      great_grandchildren: string;
      physician_info: string;
      biographical_info: string;
      preceded_in_death_by: string;
    };
    informant: {
      name: string;
      phone_number: string;
      email: string;
      relationship_to_deceased: string;
      financially_responsible_party: {
        name: string;
        phone_number: string;
        address: string;
        email: string;
      };
      method_of_payment: string;
    };
    arrangements: {
      disposition: string;
      place_of_disposition: string;
      funeral_service_place: string;
      service_date: string;
      service_time: string;
      visitation_place: string;
      visitation_date_time: string;
      other_times_at: string;
      phone_number: string;
      first_viewing_time: string;
      clergy: string;
      music: string;
      pallbearers: string[];
      honorary_pallbearers: string[];
      memorials_or_in_lieu_of_flowers: string;
    };
    final_disposition: {
      final_disposition_type: string;
      cemetery_or_crematory: string;
      address: string;
      city: string;
      county: string;
      state: string;
      disposition_of_ashes: string;
    };
    casket_container: {
      casket: string;
      casket_manufacturer: string;
      casket_model: string;
      interior_fabric_and_color: string;
      cap_panel: string;
      exterior_color: string;
    };
    outer_burial_enclosure: {
      manufacturer: string;
      model: string;
    };
    urn: {
      manufacturer: string;
      model: string;
    };
    other: {
      inscriptions: string;
      jewelry_inventory: string;
      jewelry_to_remove: string;
      embalming_authorization: boolean;
      fingerprint_authorization: boolean;
      other_merchandise: string;
    };
    general_notes: string;
  };
}

export class AIService {
  static async generateMarkdownDocument(
    arrangementData: ExtractedArrangementData,
    type: string = 'comprehensive_arrangement'
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.");
    }

    try {
      const prompt = `You are an expert funeral director and technical writer. Create a comprehensive, professional markdown document from the following funeral arrangement data.

Requirements:
- Use proper markdown formatting with headers, lists, and emphasis
- Structure the document logically with clear sections
- Include all relevant information from the arrangement data
- Use professional funeral industry language
- Format as a complete, standalone document suitable for families and funeral staff
- Include document title and generation timestamp
- Use tables where appropriate for organized data presentation

Arrangement Data:
${JSON.stringify(arrangementData, null, 2)}

Generate a comprehensive funeral arrangement document in markdown format that covers all aspects of the arrangement including personal information, service details, family information, and final disposition arrangements.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content received from OpenAI API");
      }

      return content;
    } catch (error: any) {
      console.error("AI markdown generation error:", error);
      throw new Error(`AI markdown generation failed: ${error.message}`);
    }
  }

  static async extractArrangementData(
    transcriptText: string,
  ): Promise<ExtractedArrangementData> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.");
    }

    try {
      const prompt = `${SYSTEM_PROMPT}\n\nTranscript to analyze:\n${transcriptText}`;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content received from OpenAI API");
      }

      // Clean up the response to extract JSON
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const extractedData = JSON.parse(cleanContent);
      return extractedData;
    } catch (error: any) {
      console.error("AI processing error:", error);
      if (error.message.includes("JSON")) {
        throw new Error("Failed to parse AI response as JSON");
      }
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  static async generateArrangementDocument(
    data: ExtractedArrangementData,
  ): Promise<string> {
    const arr = data.arrangement;
    const basic = arr.basic_information;
    const informant = arr.informant;
    const arrangements = arr.arrangements;
    const finalDisp = arr.final_disposition;
    const casket = arr.casket_container;

    const fullName = [
      basic.deceased_name.first,
      basic.deceased_name.middle,
      basic.deceased_name.last,
      basic.deceased_name.suffix,
    ]
      .filter(Boolean)
      .join(" ");

    const spouseName = [
      basic.spouse_name.first,
      basic.spouse_name.middle,
      basic.spouse_name.last,
    ]
      .filter(Boolean)
      .join(" ");

    const fatherName = [
      basic.father_name.first,
      basic.father_name.middle,
      basic.father_name.last,
    ]
      .filter(Boolean)
      .join(" ");

    const motherName = [
      basic.mother_name.first,
      basic.mother_name.middle,
      basic.mother_name.maiden,
    ]
      .filter(Boolean)
      .join(" ");

    const documentTemplate = `
# FUNERAL ARRANGEMENT DOCUMENT

## BASIC INFORMATION
**Funeral Director:** ${basic.funeral_director_name || "Not specified"}
**Deceased Name:** ${fullName || "Not specified"}
**Preferred Name:** ${basic.preferred_name || "Not specified"}
**Gender:** ${basic.gender || "Not specified"}
**Date of Birth:** ${basic.date_of_birth || "Not specified"}
**Date of Death:** ${basic.date_of_death || "Not specified"}
**Age:** ${basic.age || "Not specified"}
**Birthplace:** ${basic.birthplace || "Not specified"}
**City of Death:** ${basic.city_of_death || "Not specified"}
**County of Death:** ${basic.county_of_death || "Not specified"}

## PERSONAL DETAILS
**Marital Status:** ${basic.marital_status || "Not specified"}
**Spouse Name:** ${spouseName || "Not specified"}
**Maiden Name:** ${basic.maiden_name || "Not specified"}
**Occupation:** ${basic.occupation || "Not specified"}
**Industry:** ${basic.industry || "Not specified"}
**Education Level:** ${basic.education_level || "Not specified"}

## RESIDENCE
**Address:** ${[basic.usual_residence.street, basic.usual_residence.city, basic.usual_residence.state, basic.usual_residence.zip].filter(Boolean).join(", ") || "Not specified"}

## MILITARY SERVICE
**Served:** ${basic.military_service.served ? "Yes" : "No"}
**Branch:** ${basic.military_service.branch || "Not specified"}
**Service Dates:** ${basic.military_service.service_dates || "Not specified"}
**DD-214:** ${basic.dd_214 || "Not specified"}

## FAMILY INFORMATION
**Father:** ${fatherName || "Not specified"}
**Mother:** ${motherName || "Not specified"}

### Children
${
  basic.children.length > 0
    ? basic.children
        .map(
          (child) =>
            `- ${child.name} (${child.city}, ${child.state})${child.spouse_or_significant_other ? ` - Spouse: ${child.spouse_or_significant_other}` : ""}`,
        )
        .join("\n")
    : "Not specified"
}

### Siblings
${
  basic.siblings.length > 0
    ? basic.siblings
        .map(
          (sibling) => `- ${sibling.name} (${sibling.city}, ${sibling.state})`,
        )
        .join("\n")
    : "Not specified"
}

**Grandchildren:** ${basic.grandchildren || "Not specified"}
**Great Grandchildren:** ${basic.great_grandchildren || "Not specified"}
**Preceded in Death By:** ${basic.preceded_in_death_by || "Not specified"}

## INFORMANT DETAILS
**Name:** ${informant.name || "Not specified"}
**Phone:** ${informant.phone_number || "Not specified"}
**Email:** ${informant.email || "Not specified"}
**Relationship:** ${informant.relationship_to_deceased || "Not specified"}

### Financially Responsible Party
**Name:** ${informant.financially_responsible_party.name || "Not specified"}
**Phone:** ${informant.financially_responsible_party.phone_number || "Not specified"}
**Address:** ${informant.financially_responsible_party.address || "Not specified"}
**Email:** ${informant.financially_responsible_party.email || "Not specified"}
**Payment Method:** ${informant.method_of_payment || "Not specified"}

## SERVICE ARRANGEMENTS
**Disposition:** ${arrangements.disposition || "Not specified"}
**Service Place:** ${arrangements.funeral_service_place || "Not specified"}
**Service Date:** ${arrangements.service_date || "Not specified"}
**Service Time:** ${arrangements.service_time || "Not specified"}
**Visitation Place:** ${arrangements.visitation_place || "Not specified"}
**Visitation Date/Time:** ${arrangements.visitation_date_time || "Not specified"}
**Clergy:** ${arrangements.clergy || "Not specified"}
**Music:** ${arrangements.music || "Not specified"}

### Pallbearers
${arrangements.pallbearers.length > 0 ? arrangements.pallbearers.join(", ") : "Not specified"}

### Honorary Pallbearers
${arrangements.honorary_pallbearers.length > 0 ? arrangements.honorary_pallbearers.join(", ") : "Not specified"}

**Memorials/In Lieu of Flowers:** ${arrangements.memorials_or_in_lieu_of_flowers || "Not specified"}

## FINAL DISPOSITION
**Type:** ${finalDisp.final_disposition_type || "Not specified"}
**Cemetery/Crematory:** ${finalDisp.cemetery_or_crematory || "Not specified"}
**Address:** ${[finalDisp.address, finalDisp.city, finalDisp.state].filter(Boolean).join(", ") || "Not specified"}
**County:** ${finalDisp.county || "Not specified"}
**Disposition of Ashes:** ${finalDisp.disposition_of_ashes || "Not specified"}

## CASKET/CONTAINER
**Casket:** ${casket.casket || "Not specified"}
**Manufacturer:** ${casket.casket_manufacturer || "Not specified"}
**Model:** ${casket.casket_model || "Not specified"}
**Interior:** ${casket.interior_fabric_and_color || "Not specified"}
**Exterior Color:** ${casket.exterior_color || "Not specified"}

## OUTER BURIAL ENCLOSURE
**Manufacturer:** ${arr.outer_burial_enclosure.manufacturer || "Not specified"}
**Model:** ${arr.outer_burial_enclosure.model || "Not specified"}

## URN
**Manufacturer:** ${arr.urn.manufacturer || "Not specified"}
**Model:** ${arr.urn.model || "Not specified"}

## OTHER DETAILS
**Inscriptions:** ${arr.other.inscriptions || "Not specified"}
**Jewelry Inventory:** ${arr.other.jewelry_inventory || "Not specified"}
**Jewelry to Remove:** ${arr.other.jewelry_to_remove || "Not specified"}
**Embalming Authorization:** ${arr.other.embalming_authorization ? "Yes" : "No"}
**Fingerprint Authorization:** ${arr.other.fingerprint_authorization ? "Yes" : "No"}
**Other Merchandise:** ${arr.other.other_merchandise || "Not specified"}

## BIOGRAPHICAL INFORMATION
${basic.biographical_info || "Not specified"}

## PHYSICIAN INFORMATION
${basic.physician_info || "Not specified"}

## GENERAL NOTES
${arr.general_notes || "None"}

---
*Document generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*
`;

    return documentTemplate;
  }
}
