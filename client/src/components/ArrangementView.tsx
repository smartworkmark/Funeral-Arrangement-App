import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FileText, User, Calendar, MapPin, Heart, Settings, Save, Download } from "lucide-react";
import jsPDF from "jspdf";

interface ArrangementData {
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

interface ArrangementViewProps {
  arrangementData: ArrangementData;
  onSave?: (data: ArrangementData) => void;
  onDownloadPDF?: () => void;
  onApprove?: () => void;
  isApproved?: boolean;
}

export default function ArrangementView({ arrangementData, onSave, onDownloadPDF, onApprove, isApproved }: ArrangementViewProps) {
  const [data, setData] = useState(arrangementData);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  console.log('ArrangementView props:', { hasChanges, isApproved, onApprove: !!onApprove });
  
  // Cleanup is no longer needed - service worker issue is resolved

  const updateData = (path: string, value: any) => {
    console.log("=== updateData called ===");
    console.log("Path:", path);
    console.log("Value:", value);
    
    const keys = path.split('.');
    const newData = { ...data };
    let current: any = newData;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setData(newData);
    setHasChanges(true);
    console.log("hasChanges set to true");
  };

  const handleSave = () => {
    console.log("=== ArrangementView handleSave called ===");
    console.log("onSave function exists:", !!onSave);
    console.log("hasChanges:", hasChanges);
    console.log("data to save:", data);
    
    if (onSave) {
      console.log("Calling onSave with data...");
      try {
        onSave(data);
        setHasChanges(false);
        // Don't show success toast here - let the mutation handle it
      } catch (error) {
        console.error("Error in onSave:", error);
        toast({
          title: "Save Error",
          description: "An error occurred while saving. Check console for details.",
          variant: "destructive",
        });
      }
    } else {
      console.error("onSave function not provided!");
      toast({
        title: "Configuration Error",
        description: "Save function is not properly configured.",
        variant: "destructive",
      });
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const generatePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      // Get user info for the webhook payload
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user information');
      }

      const user = await userResponse.json();

      // Generate structured markdown based on Excel template
      const markdownText = generateStructuredMarkdown(data);

      // Create document name
      const basic = data.arrangement.basic_information;
      const deceasedName = [basic.deceased_name.first, basic.deceased_name.last]
        .filter(Boolean).join(' ') || 'Unknown';
      const docName = `Funeral_Arrangement_Worksheet_${deceasedName}_${new Date().toISOString().split('T')[0]}`;

      // Send to webhook
      const webhookResponse = await fetch('https://hook.us2.make.com/1hsglqsybtqd88jxtq88ghvijr61vw4l', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          docName: docName,
          markdownText: markdownText,
          userId: user.id,
          userEmail: user.email
        })
      });

      if (!webhookResponse.ok) {
        throw new Error('Failed to process document with webhook');
      }

      const webhookResult = await webhookResponse.json();

      // Download the file using the returned URL
      const downloadResponse = await fetch(webhookResult.downloadUrl);
      if (!downloadResponse.ok) {
        throw new Error('Failed to download the processed document');
      }

      const blob = await downloadResponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${webhookResult.docName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Structured arrangement worksheet has been downloaded successfully.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to generate and download PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateStructuredMarkdown = (arrangementData: ArrangementData): string => {
    const basic = arrangementData.arrangement.basic_information;
    const informant = arrangementData.arrangement.informant;
    const arrangements = arrangementData.arrangement.arrangements;
    const finalDisp = arrangementData.arrangement.final_disposition;
    const casket = arrangementData.arrangement.casket_container;
    const outerBurial = arrangementData.arrangement.outer_burial_enclosure;
    const urn = arrangementData.arrangement.urn;
    const other = arrangementData.arrangement.other;

    const formatName = (nameObj: any) => {
      if (!nameObj) return '';
      return [nameObj.first, nameObj.middle, nameObj.last, nameObj.suffix].filter(Boolean).join(' ');
    };

    const formatAddress = (addressObj: any) => {
      if (!addressObj) return '';
      return [addressObj.street, addressObj.city, addressObj.county, addressObj.state, addressObj.zip].filter(Boolean).join(', ');
    };

    const formatChildrenList = (children: any[]) => {
      if (!children || children.length === 0) return '';
      return children.map(child => {
        const name = child?.name || '';
        const city = child?.city || '';
        const state = child?.state || '';

        // Only require name - city and state are optional
        if (!name) return '';

        const location = [city, state].filter(Boolean).join(', ');
        return location ? `${name} (${location})` : name;
      }).filter(Boolean).join('; ');
    };

    const formatSpousesList = (children: any[]) => {
      if (!children || children.length === 0) return '';
      return children.map(child => child.spouse_or_significant_other).filter(Boolean).join('; ');
    };

    const formatSiblingsList = (siblings: any[]) => {
      if (!siblings || siblings.length === 0) return '';
      return siblings.map(sibling => {
        const name = sibling?.name || '';
        const city = sibling?.city || '';
        const state = sibling?.state || '';

        // Only require name - location is optional
        if (!name) return '';

        const location = [city, state].filter(Boolean).join(', ');
        return location ? `${name} (${location})` : name;
      }).filter(Boolean).join('; ');
    };

    const deceasedName = formatName(basic.deceased_name);

    return `# Funeral Arrangement Details

**Arrangements for:** ${deceasedName || 'Not specified'}

---

| **#** | **Item Name** | **Information** |
|:---:|:--------------|:----------------|
| | **Basic Information** | |
| 1 | Name of Funeral Director | ${basic.funeral_director_name || ''} |
| 2 | Name of Deceased (First, Middle, Last, suffix) | ${deceasedName || ''} |
| 3 | Preferred name, nickname | ${basic.preferred_name || ''} |
| 4 | Gender | ${basic.gender || ''} |
| 5 | Date of birth | ${basic.date_of_birth || ''} |
| 6 | Date of Death | ${basic.date_of_death || ''} |
| 7 | Birthplace | ${basic.birthplace || ''} |
| 8 | City/Town of Death | ${basic.city_of_death || ''} |
| 9 | County of Death | ${basic.county_of_death || ''} |
| 10 | Age | ${basic.age || ''} |
| 11 | Maiden name (if applicable) | ${basic.maiden_name || ''} |
| 12 | Marital status | ${basic.marital_status || ''} |
| 13 | Spouse at time of death (first, middle, last and maiden) | ${formatName(basic.spouse_name) + (basic.spouse_name?.maiden ? ` (maiden: ${basic.spouse_name.maiden})` : '') || ''} |
| 14 | Usual residence (street, city, county, state, zip) | ${formatAddress(basic.usual_residence) || ''} |
| 15 | Occupation (type of work done during most of life) | ${basic.occupation || ''} |
| 16 | Kind of Business or Industry | ${basic.industry || ''} |
| 17 | Education Level | ${basic.education_level || ''} |
| 18 | Military Service (Yes/No; if yes, branch and service dates) | ${basic.military_service?.served ? `Yes - ${basic.military_service.branch || ''} (${basic.military_service.service_dates || ''})` : 'No'} |
| 19 | DD – 214 | ${basic.dd_214 || ''} |
| 20 | Father's Name (first, middle, last) | ${formatName(basic.father_name) || ''} |
| 21 | Mother's name (first, middle, maiden) | ${formatName(basic.mother_name) || ''} |
| 22 | Children's current name(s) and city and state of residence | ${formatChildrenList(basic.children) || ''} |
| 23 | Children's Spouses / significant other names if applicable | ${formatSpousesList(basic.children) || ''} |
| 24 | Siblings names if applicable and city and state of residence | ${formatSiblingsList(basic.siblings) || ''} |
| 25 | Grandchildren Great-grandchildren | ${[basic.grandchildren, basic.great_grandchildren].filter(Boolean).join('; ') || ''} |
| 26 | Physician Info | ${basic.physician_info || ''} |
| 27 | Biographical Info | ${basic.biographical_info || ''} |
| 28 | Preceded in Death By | ${basic.preceded_in_death_by || ''} |
| | **Informant** | |
| 30 | Informant | ${informant.name || ''} |
| 31 | Name(s) of informant (include phone number and email) | ${[informant.name, informant.phone_number, informant.email].filter(Boolean).join(' - ') || ''} |
| 32 | Relationship to deceased | ${informant.relationship_to_deceased || ''} |
| 33 | Name of financially responsible party (next of kin) if other than informant | ${[informant.financially_responsible_party?.name, informant.financially_responsible_party?.phone_number, informant.financially_responsible_party?.address, informant.financially_responsible_party?.email].filter(Boolean).join(' - ') || ''} |
| 34 | Method of payment | ${informant.method_of_payment || ''} |
| | **Arrangements** | |
| 35 | Disposition | ${arrangements.disposition || ''} |
| 36 | Place of Disposition | ${arrangements.place_of_disposition || ''} |
| 37 | Funeral Service/Place | ${arrangements.funeral_service_place || ''} |
| 38 | Service Date | ${arrangements.service_date || ''} |
| 39 | Service Time | ${arrangements.service_time || ''} |
| 40 | Visitation Place | ${arrangements.visitation_place || ''} |
| 41 | Visitation Date/Time | ${arrangements.visitation_date_time || ''} |
| 42 | Other Times At | ${arrangements.other_times_at || ''} |
| 43 | Phone Number | ${arrangements.phone_number || ''} |
| 44 | First Viewing Time | ${arrangements.first_viewing_time || ''} |
| 45 | Clergy | ${arrangements.clergy || ''} |
| 46 | Music | ${arrangements.music || ''} |
| 47 | Pallbearers | ${arrangements.pallbearers?.join(', ') || ''} |
| 48 | Honorary Pallbearers | ${arrangements.honorary_pallbearers?.join(', ') || ''} |
| 49 | Memorials / In Lieu of Flowers | ${arrangements.memorials_or_in_lieu_of_flowers || ''} |
| | **Final Disposition** | |
| 50 | Final Disposition | ${finalDisp.final_disposition_type || ''} |
| 51 | Cemetery/Crematory | ${finalDisp.cemetery_or_crematory || ''} |
| 52 | Address | ${finalDisp.address || ''} |
| 53 | City | ${finalDisp.city || ''} |
| 54 | County | ${finalDisp.county || ''} |
| 55 | State | ${finalDisp.state || ''} |
| 56 | Disposition of Ashes (if cremation) | ${finalDisp.disposition_of_ashes || ''} |
| | **Casket / Container** | |
| 57 | Casket | ${casket.casket || ''} |
| 58 | Casket Manufacturer | ${casket.casket_manufacturer || ''} |
| 59 | Casket Model | ${casket.casket_model || ''} |
| 60 | Interior: fabric and color | ${casket.interior_fabric_and_color || ''} |
| 61 | Cap panel | ${casket.cap_panel || ''} |
| 62 | Exterior color | ${casket.exterior_color || ''} |
| | **Outer Burial Enclosure** | |
| 63 | Manufacturer | ${outerBurial.manufacturer || ''} |
| 64 | Model | ${outerBurial.model || ''} |
| | **Urn** | |
| 65 | Urn Manufacturer | ${urn.manufacturer || ''} |
| 66 | Urn Model | ${urn.model || ''} |
| | **Other** | |
| 67 | Inscriptions | ${other.inscriptions || ''} |
| 68 | Jewelry inventory | ${other.jewelry_inventory || ''} |
| 69 | Jewelry to Remove | ${other.jewelry_to_remove || ''} |
| 70 | Embalming Authorization | ${other.embalming_authorization ? 'Yes' : 'No'} |
| 71 | Fingerprint authorization | ${other.fingerprint_authorization ? 'Yes' : 'No'} |
| | **Other Merchandise** | |
| 72 | Other Merchandise (describe) | ${other.other_merchandise || ''} |

---

## General Notes and Information Not Covered by Checklist

${arrangementData.arrangement.general_notes || 'No additional notes provided.'}

---

*Document generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*
`;
  };

  const basic = data.arrangement.basic_information;
  const informant = data.arrangement.informant;
  const arrangements = data.arrangement.arrangements;
  const finalDisp = data.arrangement.final_disposition;
  const casket = data.arrangement.casket_container;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Arrangement Details</h2>
          <Badge variant="secondary">AI Processed</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={generatePDF} 
            variant="outline" 
            className="gap-2"
            disabled={isGeneratingPDF}
          >
            <Download className="h-4 w-4" />
            {isGeneratingPDF ? 'Processing...' : 'Download PDF'}
          </Button>
          {hasChanges && (
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="basic" className="gap-2">
            <User className="h-4 w-4" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="family" className="gap-2">
            <Heart className="h-4 w-4" />
            Family
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <User className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="service" className="gap-2">
            <Calendar className="h-4 w-4" />
            Service
          </TabsTrigger>
          <TabsTrigger value="disposition" className="gap-2">
            <MapPin className="h-4 w-4" />
            Disposition
          </TabsTrigger>
          <TabsTrigger value="merchandise" className="gap-2">
            <Settings className="h-4 w-4" />
            Merchandise
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-2">
            <FileText className="h-4 w-4" />
            Other
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deceased Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="funeral_director_name">Funeral Director Name</Label>
                <Input
                  id="funeral_director_name"
                  value={basic.funeral_director_name}
                  onChange={(e) => updateData('arrangement.basic_information.funeral_director_name', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={basic.deceased_name.first}
                    onChange={(e) => updateData('arrangement.basic_information.deceased_name.first', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={basic.deceased_name.middle}
                    onChange={(e) => updateData('arrangement.basic_information.deceased_name.middle', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={basic.deceased_name.last}
                    onChange={(e) => updateData('arrangement.basic_information.deceased_name.last', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    value={basic.deceased_name.suffix}
                    onChange={(e) => updateData('arrangement.basic_information.deceased_name.suffix', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="preferred_name">Preferred Name</Label>
                  <Input
                    id="preferred_name"
                    value={basic.preferred_name}
                    onChange={(e) => updateData('arrangement.basic_information.preferred_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    id="gender"
                    value={basic.gender}
                    onChange={(e) => updateData('arrangement.basic_information.gender', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={basic.age || ''}
                    onChange={(e) => updateData('arrangement.basic_information.age', e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    value={basic.date_of_birth}
                    onChange={(e) => updateData('arrangement.basic_information.date_of_birth', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="date_of_death">Date of Death</Label>
                  <Input
                    id="date_of_death"
                    value={basic.date_of_death}
                    onChange={(e) => updateData('arrangement.basic_information.date_of_death', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="birthplace">Birthplace</Label>
                  <Input
                    id="birthplace"
                    value={basic.birthplace}
                    onChange={(e) => updateData('arrangement.basic_information.birthplace', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="city_of_death">City of Death</Label>
                  <Input
                    id="city_of_death"
                    value={basic.city_of_death}
                    onChange={(e) => updateData('arrangement.basic_information.city_of_death', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="county_of_death">County of Death</Label>
                  <Input
                    id="county_of_death"
                    value={basic.county_of_death}
                    onChange={(e) => updateData('arrangement.basic_information.county_of_death', e.target.value)}
                  />
                </div>
              </div>

              <h4 className="font-medium text-sm text-gray-700 mt-6">Residence Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    value={basic.usual_residence.street}
                    onChange={(e) => updateData('arrangement.basic_information.usual_residence.street', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={basic.usual_residence.city}
                    onChange={(e) => updateData('arrangement.basic_information.usual_residence.city', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="county">County</Label>
                  <Input
                    id="county"
                    value={basic.usual_residence.county}
                    onChange={(e) => updateData('arrangement.basic_information.usual_residence.county', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={basic.usual_residence.state}
                    onChange={(e) => updateData('arrangement.basic_information.usual_residence.state', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={basic.usual_residence.zip}
                    onChange={(e) => updateData('arrangement.basic_information.usual_residence.zip', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={basic.occupation}
                    onChange={(e) => updateData('arrangement.basic_information.occupation', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={basic.industry}
                    onChange={(e) => updateData('arrangement.basic_information.industry', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="education_level">Education Level</Label>
                  <Input
                    id="education_level"
                    value={basic.education_level}
                    onChange={(e) => updateData('arrangement.basic_information.education_level', e.target.value)}
                  />
                </div>
              </div>

              <h4 className="font-medium text-sm text-gray-700 mt-6">Military Service</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="military_served">Served in Military</Label>
                  <select
                    id="military_served"
                    value={basic.military_service.served ? 'true' : 'false'}
                    onChange={(e) => updateData('arrangement.basic_information.military_service.served', e.target.value === 'true')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="military_branch">Branch</Label>
                  <Input
                    id="military_branch"
                    value={basic.military_service.branch}
                    onChange={(e) => updateData('arrangement.basic_information.military_service.branch', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="service_dates">Service Dates</Label>
                  <Input
                    id="service_dates"
                    value={basic.military_service.service_dates}
                    onChange={(e) => updateData('arrangement.basic_information.military_service.service_dates', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="dd_214">DD-214</Label>
                <Input
                  id="dd_214"
                  value={basic.dd_214}
                  onChange={(e) => updateData('arrangement.basic_information.dd_214', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="physician_info">Physician Information</Label>
                  <Input
                    id="physician_info"
                    value={basic.physician_info}
                    onChange={(e) => updateData('arrangement.basic_information.physician_info', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="preceded_in_death">Preceded in Death By</Label>
                  <Input
                    id="preceded_in_death"
                    value={basic.preceded_in_death_by}
                    onChange={(e) => updateData('arrangement.basic_information.preceded_in_death_by', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="biographical_info">Biographical Information</Label>
                <Textarea
                  id="biographical_info"
                  value={basic.biographical_info}
                  onChange={(e) => updateData('arrangement.basic_information.biographical_info', e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="family" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Family Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="marital_status">Marital Status</Label>
                  <Input
                    id="marital_status"
                    value={basic.marital_status}
                    onChange={(e) => updateData('arrangement.basic_information.marital_status', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="maiden_name">Maiden Name</Label>
                  <Input
                    id="maiden_name"
                    value={basic.maiden_name}
                    onChange={(e) => updateData('arrangement.basic_information.maiden_name', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Spouse Information</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="spouse_first">First Name</Label>
                    <Input id="spouse_first"
                      value={basic.spouse_name.first}
                      onChange={(e) => updateData('arrangement.basic_information.spouse_name.first', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouse_middle">Middle Name</Label>
                    <Input
                      id="spouse_middle"
                      value={basic.spouse_name.middle}
                      onChange={(e) => updateData('arrangement.basic_information.spouse_name.middle', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouse_last">Last Name</Label>
                    <Input
                      id="spouse_last"
                      value={basic.spouse_name.last}
                      onChange={(e) => updateData('arrangement.basic_information.spouse_name.last', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouse_maiden">Maiden Name</Label>
                    <Input
                      id="spouse_maiden"
                      value={basic.spouse_name.maiden}
                      onChange={(e) => updateData('arrangement.basic_information.spouse_name.maiden', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Father's Information</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="father_first">First Name</Label>
                    <Input
                      id="father_first"
                      value={basic.father_name.first}
                      onChange={(e) => updateData('arrangement.basic_information.father_name.first', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="father_middle">Middle Name</Label>
                    <Input
                      id="father_middle"
                      value={basic.father_name.middle}
                      onChange={(e) => updateData('arrangement.basic_information.father_name.middle', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="father_last">Last Name</Label>
                    <Input
                      id="father_last"
                      value={basic.father_name.last}
                      onChange={(e) => updateData('arrangement.basic_information.father_name.last', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Mother's Information</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="mother_first">First Name</Label>
                    <Input
                      id="mother_first"
                      value={basic.mother_name.first}
                      onChange={(e) => updateData('arrangement.basic_information.mother_name.first', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mother_middle">Middle Name</Label>
                    <Input
                      id="mother_middle"
                      value={basic.mother_name.middle}
                      onChange={(e) => updateData('arrangement.basic_information.mother_name.middle', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mother_maiden">Maiden Name</Label>
                    <Input
                      id="mother_maiden"
                      value={basic.mother_name.maiden}
                      onChange={(e) => updateData('arrangement.basic_information.mother_name.maiden', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="children">Children</Label>
                  <Textarea
                    id="children"
                    value={basic.children?.map(child => {
                      const name = child?.name || '';
                      const city = child?.city || '';
                      const state = child?.state || '';
                      const spouse = child?.spouse_or_significant_other || '';

                      // Only require name - location is optional
                      if (!name) return '';

                      const location = [city, state].filter(Boolean).join(', ');
                      const baseInfo = location ? `${name} (${location})` : name;
                      return spouse ? `${baseInfo} - Spouse: ${spouse}` : baseInfo;
                    }).filter(Boolean).join('\n') || ''}
                    onChange={(e) => {
                      const children = e.target.value.split('\n').filter(line => line.trim()).map(line => {
                        const parts = line.split(' - Spouse: ');
                        const mainPart = parts[0];
                        const spouse = parts[1] || '';
                        const nameAndLocation = mainPart.split(' (');
                        const name = nameAndLocation[0] || '';
                        const location = nameAndLocation[1]?.replace(')', '') || '';
                        const locationParts = location.split(', ');
                        return {
                          name,
                          city: locationParts[0] || '',
                          state: locationParts[1] || '',
                          spouse_or_significant_other: spouse
                        };
                      });
                      updateData('arrangement.basic_information.children', children);
                    }}
                    placeholder="Enter children information (Name (City, State) - Spouse: Spouse Name)"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="siblings">Siblings</Label>
                  <Textarea
                    id="siblings"
                    value={basic.siblings?.map(sibling => {
                      const name = sibling?.name || '';
                      const city = sibling?.city || '';
                      const state = sibling?.state || '';

                      // Only require name - location is optional
                      if (!name) return '';

                      const location = [city, state].filter(Boolean).join(', ');
                      return location ? `${name} (${location})` : name;
                    }).filter(Boolean).join('\n') || ''}
                    onChange={(e) => {
                      const siblings = e.target.value.split('\n').filter(line => line.trim()).map(line => {
                        const nameAndLocation = line.split(' (');
                        const name = nameAndLocation[0] || '';
                        const location = nameAndLocation[1]?.replace(')', '') || '';
                        const locationParts = location.split(', ');
                        return {
                          name,
                          city: locationParts[0] || '',
                          state: locationParts[1] || ''
                        };
                      });
                      updateData('arrangement.basic_information.siblings', siblings);
                    }}
                    placeholder="Enter siblings information (Name (City, State))"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="grandchildren">Grandchildren</Label>
                  <Textarea
                    id="grandchildren"
                    value={basic.grandchildren}
                    onChange={(e) => updateData('arrangement.basic_information.grandchildren', e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="great_grandchildren">Great Grandchildren</Label>
                  <Textarea
                    id="great_grandchildren"
                    value={basic.great_grandchildren}
                    onChange={(e) => updateData('arrangement.basic_information.great_grandchildren', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact & Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="informant_name">Informant Name</Label>
                  <Input
                    id="informant_name"
                    value={informant.name}
                    onChange={(e) => updateData('arrangement.informant.name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="relationship">Relationship to Deceased</Label>
                  <Input
                    id="relationship"
                    value={informant.relationship_to_deceased}
                    onChange={(e) => updateData('arrangement.informant.relationship_to_deceased', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="informant_phone">Phone Number</Label>
                  <Input
                    id="informant_phone"
                    value={informant.phone_number}
                    onChange={(e) => updateData('arrangement.informant.phone_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="informant_email">Email</Label>
                  <Input
                    id="informant_email"
                    type="email"
                    value={informant.email}
                    onChange={(e) => updateData('arrangement.informant.email', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Financially Responsible Party</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="financial_name">Name</Label>
                    <Input
                      id="financial_name"
                      value={informant.financially_responsible_party.name}
                      onChange={(e) => updateData('arrangement.informant.financially_responsible_party.name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="financial_phone">Phone Number</Label>
                    <Input
                      id="financial_phone"
                      value={informant.financially_responsible_party.phone_number}
                      onChange={(e) => updateData('arrangement.informant.financially_responsible_party.phone_number', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="financial_address">Address</Label>
                    <Input
                      id="financial_address"
                      value={informant.financially_responsible_party.address}
                      onChange={(e) => updateData('arrangement.informant.financially_responsible_party.address', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="financial_email">Email</Label>
                    <Input
                      id="financial_email"
                      type="email"
                      value={informant.financially_responsible_party.email}
                      onChange={(e) => updateData('arrangement.informant.financially_responsible_party.email', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="payment_method">Method of Payment</Label>
                <Input
                  id="payment_method"
                  value={informant.method_of_payment}
                  onChange={(e) => updateData('arrangement.informant.method_of_payment', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Arrangements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="disposition">Disposition</Label>
                  <Input
                    id="disposition"
                    value={arrangements.disposition}
                    onChange={(e) => updateData('arrangement.arrangements.disposition', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="place_of_disposition">Place of Disposition</Label>
                  <Input
                    id="place_of_disposition"
                    value={arrangements.place_of_disposition}
                    onChange={(e) => updateData('arrangement.arrangements.place_of_disposition', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service_place">Funeral Service Place</Label>
                  <Input
                    id="service_place"
                    value={arrangements.funeral_service_place}
                    onChange={(e) => updateData('arrangement.arrangements.funeral_service_place', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="visitation_place">Visitation Place</Label>
                  <Input
                    id="visitation_place"
                    value={arrangements.visitation_place}
                    onChange={(e) => updateData('arrangement.arrangements.visitation_place', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service_date">Service Date</Label>
                  <Input
                    id="service_date"
                    value={arrangements.service_date}
                    onChange={(e) => updateData('arrangement.arrangements.service_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="service_time">Service Time</Label>
                  <Input
                    id="service_time"
                    value={arrangements.service_time}
                    onChange={(e) => updateData('arrangement.arrangements.service_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="visitation_date_time">Visitation Date/Time</Label>
                  <Input
                    id="visitation_date_time"
                    value={arrangements.visitation_date_time}
                    onChange={(e) => updateData('arrangement.arrangements.visitation_date_time', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="first_viewing_time">First Viewing Time</Label>
                  <Input
                    id="first_viewing_time"
                    value={arrangements.first_viewing_time}
                    onChange={(e) => updateData('arrangement.arrangements.first_viewing_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="other_times_at">Other Times At</Label>
                  <Input
                    id="other_times_at"
                    value={arrangements.other_times_at}
                    onChange={(e) => updateData('arrangement.arrangements.other_times_at', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={arrangements.phone_number}
                    onChange={(e) => updateData('arrangement.arrangements.phone_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="clergy">Clergy</Label>
                  <Input
                    id="clergy"
                    value={arrangements.clergy}
                    onChange={(e) => updateData('arrangement.arrangements.clergy', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="music">Music</Label>
                <Input
                  id="music"
                  value={arrangements.music}
                  onChange={(e) => updateData('arrangement.arrangements.music', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pallbearers">Pallbearers (comma separated)</Label>
                  <Textarea
                    id="pallbearers"
                    value={arrangements.pallbearers?.join(', ') || ''}
                    onChange={(e) => updateData('arrangement.arrangements.pallbearers', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="honorary_pallbearers">Honorary Pallbearers (comma separated)</Label>
                  <Textarea
                    id="honorary_pallbearers"
                    value={arrangements.honorary_pallbearers?.join(', ') || ''}
                    onChange={(e) => updateData('arrangement.arrangements.honorary_pallbearers', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="memorials">Memorials/In Lieu of Flowers</Label>
                <Textarea
                  id="memorials"
                  value={arrangements.memorials_or_in_lieu_of_flowers}
                  onChange={(e) => updateData('arrangement.arrangements.memorials_or_in_lieu_of_flowers', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disposition" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Final Disposition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="disposition_type">Disposition Type</Label>
                  <Input
                    id="disposition_type"
                    value={finalDisp.final_disposition_type}
                    onChange={(e) => updateData('arrangement.final_disposition.final_disposition_type', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cemetery">Cemetery/Crematory</Label>
                  <Input
                    id="cemetery"
                    value={finalDisp.cemetery_or_crematory}
                    onChange={(e) => updateData('arrangement.final_disposition.cemetery_or_crematory', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="disposition_address">Address</Label>
                <Input
                  id="disposition_address"
                  value={finalDisp.address}
                  onChange={(e) => updateData('arrangement.final_disposition.address', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="disposition_city">City</Label>
                  <Input
                    id="disposition_city"
                    value={finalDisp.city}
                    onChange={(e) => updateData('arrangement.final_disposition.city', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="disposition_county">County</Label>
                  <Input
                    id="disposition_county"
                    value={finalDisp.county}
                    onChange={(e) => updateData('arrangement.final_disposition.county', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="disposition_state">State</Label>
                  <Input
                    id="disposition_state"
                    value={finalDisp.state}
                    onChange={(e) => updateData('arrangement.final_disposition.state', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchandise" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Casket & Container</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="casket">Casket</Label>
                  <Input
                    id="casket"
                    value={casket.casket}
                    onChange={(e) => updateData('arrangement.casket_container.casket', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="casket_manufacturer">Manufacturer</Label>
                  <Input
                    id="casket_manufacturer"
                    value={casket.casket_manufacturer}
                    onChange={(e) => updateData('arrangement.casket_container.casket_manufacturer', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="casket_model">Model</Label>
                  <Input
                    id="casket_model"
                    value={casket.casket_model}
                    onChange={(e) => updateData('arrangement.casket_container.casket_model', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interior_fabric">Interior Fabric & Color</Label>
                  <Input
                    id="interior_fabric"
                    value={casket.interior_fabric_and_color}
                    onChange={(e) => updateData('arrangement.casket_container.interior_fabric_and_color', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="exterior_color">Exterior Color</Label>
                  <Input
                    id="exterior_color"
                    value={casket.exterior_color}
                    onChange={(e) => updateData('arrangement.casket_container.exterior_color', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cap_panel">Cap Panel</Label>
                <Input
                  id="cap_panel"
                  value={casket.cap_panel}
                  onChange={(e) => updateData('arrangement.casket_container.cap_panel', e.target.value)}
                />
              </div>

              <Separator />

              <h4 className="font-medium text-sm text-gray-700">Outer Burial Enclosure</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="burial_manufacturer">Manufacturer</Label>
                  <Input
                    id="burial_manufacturer"
                    value={data.arrangement.outer_burial_enclosure.manufacturer}
                    onChange={(e) => updateData('arrangement.outer_burial_enclosure.manufacturer', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="burial_model">Model</Label>
                  <Input
                    id="burial_model"
                    value={data.arrangement.outer_burial_enclosure.model}
                    onChange={(e) => updateData('arrangement.outer_burial_enclosure.model', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium text-sm text-gray-700">Urn</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="urn_manufacturer">Manufacturer</Label>
                  <Input
                    id="urn_manufacturer"
                    value={data.arrangement.urn.manufacturer}
                    onChange={(e) => updateData('arrangement.urn.manufacturer', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="urn_model">Model</Label>
                  <Input
                    id="urn_model"
                    value={data.arrangement.urn.model}
                    onChange={(e) => updateData('arrangement.urn.model', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Other Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inscriptions">Inscriptions</Label>
                  <Input
                    id="inscriptions"
                    value={data.arrangement.other.inscriptions}
                    onChange={(e) => updateData('arrangement.other.inscriptions', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="other_merchandise">Other Merchandise</Label>
                  <Input
                    id="other_merchandise"
                    value={data.arrangement.other.other_merchandise}
                    onChange={(e) => updateData('arrangement.other.other_merchandise', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="jewelry_inventory">Jewelry Inventory</Label>
                  <Input
                    id="jewelry_inventory"
                    value={data.arrangement.other.jewelry_inventory}
                    onChange={(e) => updateData('arrangement.other.jewelry_inventory', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="jewelry_to_remove">Jewelry to Remove</Label>
                  <Input
                    id="jewelry_to_remove"
                    value={data.arrangement.other.jewelry_to_remove}
                    onChange={(e) => updateData('arrangement.other.jewelry_to_remove', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium text-sm text-gray-700">Authorizations</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="embalming_auth">Embalming Authorization</Label>
                  <select
                    id="embalming_auth"
                    value={data.arrangement.other.embalming_authorization ? 'true' : 'false'}
                    onChange={(e) => updateData('arrangement.other.embalming_authorization', e.target.value === 'true')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="fingerprint_auth">Fingerprint Authorization</Label>
                  <select
                    id="fingerprint_auth"
                    value={data.arrangement.other.fingerprint_authorization ? 'true' : 'false'}
                    onChange={(e) => updateData('arrangement.other.fingerprint_authorization', e.target.value === 'true')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>

              <Separator />

              <div>
                <Label htmlFor="general_notes">General Notes</Label>
                <Textarea
                  id="general_notes"
                  value={data.arrangement.general_notes}
                  onChange={(e) => updateData('arrangement.general_notes', e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Actions */}
      <div className="mt-6 flex gap-4 justify-between items-center">
        <div className="flex gap-3">
          {hasChanges && onSave && (
            <Button onClick={handleSave} variant="outline">
              Save Changes
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {isApproved ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-md border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Arrangement Approved
            </div>
          ) : (
            onApprove && (
              <Button 
                onClick={() => {
                  console.log('Button clicked directly');
                  onApprove();
                }} 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={hasChanges}
              >
                {hasChanges ? 'Save Changes First' : 'Approve & Generate Documents'}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}