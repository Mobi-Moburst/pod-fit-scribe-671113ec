import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, FileText, Check, RefreshCw, Upload, ChevronDown, ChevronRight, User, Link2 } from "lucide-react";
import { parseBatchCSV, parseAirtableCSV, parseSOVCSV, parseGEOCSV, parseContentGapCSV, parseRephonicCSV } from "@/utils/csvParsers";
import { mergeUpdatedReportData } from "@/utils/reportGenerator";
import { ReportData, SpeakerBreakdown } from "@/types/reports";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AirtableSyncButton } from "@/components/airtable/AirtableSyncButton";
import { AirtableCSVRow } from "@/hooks/use-airtable-connection";

// Helper to read File as text
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

interface UpdateCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any;
  onUpdated: () => void;
}

type CSVType = 'batch' | 'airtable' | 'sov' | 'geo' | 'content_gap' | 'rephonic';

interface CSVStatus {
  hasData: boolean;
  newFile: File | null;
}

interface SpeakerCSVFiles {
  batchFile: File | null;
  airtableFile: File | null;
  airtableSyncedData: AirtableCSVRow[] | null;
}

export function UpdateCSVDialog({ open, onOpenChange, report, onUpdated }: UpdateCSVDialogProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSpeakers, setExpandedSpeakers] = useState<Set<string>>(new Set());
  
  // Company-level optional CSVs
  const [csvFiles, setCsvFiles] = useState<Record<Exclude<CSVType, 'batch' | 'airtable'>, CSVStatus>>({
    sov: { hasData: false, newFile: null },
    geo: { hasData: false, newFile: null },
    content_gap: { hasData: false, newFile: null },
    rephonic: { hasData: false, newFile: null },
  });

  // Single-speaker mode files
  const [singleSpeakerFiles, setSingleSpeakerFiles] = useState<SpeakerCSVFiles>({
    batchFile: null,
    airtableFile: null,
    airtableSyncedData: null,
  });

  // Multi-speaker mode files (keyed by speaker_id)
  const [speakerFiles, setSpeakerFiles] = useState<Record<string, SpeakerCSVFiles>>({});

  const reportData = report?.report_data as ReportData | undefined;
  const isMultiSpeaker = reportData?.report_type === 'multi';
  const speakerBreakdowns = reportData?.speaker_breakdowns || [];

  const getDataStatus = (type: CSVType): boolean => {
    if (!reportData) return false;
    switch (type) {
      case 'batch':
      case 'airtable':
        return true;
      case 'sov':
        return !!reportData.sov_analysis;
      case 'geo':
        return !!reportData.geo_analysis || reportData.geo_csv_uploaded === true;
      case 'content_gap':
        return !!reportData.content_gap_analysis || reportData.content_gap_csv_uploaded === true;
      case 'rephonic':
        return reportData.podcasts?.some(p => p.true_emv && p.true_emv > 0) || false;
      default:
        return false;
    }
  };

  const handleOptionalFileChange = (type: Exclude<CSVType, 'batch' | 'airtable'>, file: File | null) => {
    setCsvFiles(prev => ({
      ...prev,
      [type]: { ...prev[type], newFile: file },
    }));
  };

  const handleSingleSpeakerFileChange = (type: 'batch' | 'airtable', file: File | null) => {
    setSingleSpeakerFiles(prev => ({
      ...prev,
      [type === 'batch' ? 'batchFile' : 'airtableFile']: file,
      // Clear synced data if uploading a file
      ...(type === 'airtable' && file ? { airtableSyncedData: null } : {}),
    }));
  };

  const handleSingleSpeakerAirtableSync = (data: AirtableCSVRow[]) => {
    setSingleSpeakerFiles(prev => ({
      ...prev,
      airtableFile: null, // Clear any uploaded file
      airtableSyncedData: data,
    }));
  };

  const handleSpeakerFileChange = (speakerId: string, type: 'batch' | 'airtable', file: File | null) => {
    setSpeakerFiles(prev => ({
      ...prev,
      [speakerId]: {
        ...prev[speakerId],
        [type === 'batch' ? 'batchFile' : 'airtableFile']: file,
        // Clear synced data if uploading a file
        ...(type === 'airtable' && file ? { airtableSyncedData: null } : {}),
      },
    }));
  };

  const handleSpeakerAirtableSync = (speakerId: string, data: AirtableCSVRow[]) => {
    setSpeakerFiles(prev => ({
      ...prev,
      [speakerId]: {
        ...prev[speakerId],
        airtableFile: null, // Clear any uploaded file
        airtableSyncedData: data,
      },
    }));
  };

  const toggleSpeakerExpanded = (speakerId: string) => {
    setExpandedSpeakers(prev => {
      const next = new Set(prev);
      if (next.has(speakerId)) {
        next.delete(speakerId);
      } else {
        next.add(speakerId);
      }
      return next;
    });
  };

  const hasAnyFileSelected = useMemo(() => {
    // Check optional files
    const hasOptionalFile = Object.values(csvFiles).some(s => s.newFile !== null);
    
    if (isMultiSpeaker) {
      // Check speaker files (including synced data)
      const hasSpeakerFile = Object.values(speakerFiles).some(
        sf => sf.batchFile !== null || sf.airtableFile !== null || sf.airtableSyncedData !== null
      );
      return hasOptionalFile || hasSpeakerFile;
    } else {
      // Check single speaker files (including synced data)
      return hasOptionalFile || 
        singleSpeakerFiles.batchFile !== null || 
        singleSpeakerFiles.airtableFile !== null ||
        singleSpeakerFiles.airtableSyncedData !== null;
    }
  }, [csvFiles, speakerFiles, singleSpeakerFiles, isMultiSpeaker]);

  const handleUpdate = async () => {
    if (!report || !hasAnyFileSelected) return;
    
    setIsProcessing(true);
    
    try {
      const existingReportData = report.report_data as ReportData;
      const updatedCSVTypes: CSVType[] = [];
      
      const dateRangeStart = new Date(report.date_range_start);
      const dateRangeEnd = new Date(report.date_range_end);
      
      let newBatchData: any[] | null = null;
      let newAirtableData: any[] | null = null;
      let newSOVData: any[] | null = null;
      let newGEOData: any[] | null = null;
      let newContentGapData: any[] | null = null;
      let newRephonicData: any[] | null = null;

      // Handle single-speaker vs multi-speaker batch/airtable files
      if (isMultiSpeaker) {
        // For multi-speaker, we need to handle per-speaker updates
        // This is more complex - for now, we'll update the speaker breakdowns individually
        // TODO: Implement full multi-speaker CSV update logic
        toast({
          title: "Multi-speaker update",
          description: "Per-speaker CSV updates are being processed. This may take a moment.",
        });
        
        // Collect all speaker batch and airtable data
        const allBatchData: any[] = [];
        const allAirtableData: any[] = [];
        
        for (const speaker of speakerBreakdowns) {
          const files = speakerFiles[speaker.speaker_id];
          if (files?.batchFile) {
            const csvText = await readFileAsText(files.batchFile);
            const parsed = parseBatchCSV(csvText);
            allBatchData.push(...parsed);
            if (!updatedCSVTypes.includes('batch')) updatedCSVTypes.push('batch');
          }
          // Check for synced data first, then fall back to file upload
          if (files?.airtableSyncedData && files.airtableSyncedData.length > 0) {
            allAirtableData.push(...files.airtableSyncedData);
            if (!updatedCSVTypes.includes('airtable')) updatedCSVTypes.push('airtable');
          } else if (files?.airtableFile) {
            const csvText = await readFileAsText(files.airtableFile);
            const parsed = parseAirtableCSV(csvText, dateRangeStart, dateRangeEnd);
            allAirtableData.push(...parsed);
            if (!updatedCSVTypes.includes('airtable')) updatedCSVTypes.push('airtable');
          }
        }
        
        if (allBatchData.length > 0) newBatchData = allBatchData;
        if (allAirtableData.length > 0) newAirtableData = allAirtableData;
      } else {
        // Single speaker mode
        if (singleSpeakerFiles.batchFile) {
          const csvText = await readFileAsText(singleSpeakerFiles.batchFile);
          newBatchData = parseBatchCSV(csvText);
          updatedCSVTypes.push('batch');
        }
        
        // Check for synced data first, then fall back to file upload
        if (singleSpeakerFiles.airtableSyncedData && singleSpeakerFiles.airtableSyncedData.length > 0) {
          newAirtableData = singleSpeakerFiles.airtableSyncedData;
          updatedCSVTypes.push('airtable');
        } else if (singleSpeakerFiles.airtableFile) {
          const csvText = await readFileAsText(singleSpeakerFiles.airtableFile);
          newAirtableData = parseAirtableCSV(csvText, dateRangeStart, dateRangeEnd);
          updatedCSVTypes.push('airtable');
        }
      }
      
      // Process optional company-level CSVs
      if (csvFiles.sov.newFile) {
        const csvText = await readFileAsText(csvFiles.sov.newFile);
        newSOVData = parseSOVCSV(csvText);
        updatedCSVTypes.push('sov');
      }
      
      if (csvFiles.geo.newFile) {
        const csvText = await readFileAsText(csvFiles.geo.newFile);
        newGEOData = parseGEOCSV(csvText);
        updatedCSVTypes.push('geo');
      }
      
      if (csvFiles.content_gap.newFile) {
        const csvText = await readFileAsText(csvFiles.content_gap.newFile);
        const clientDomain = existingReportData.client?.company_url || '';
        newContentGapData = parseContentGapCSV(csvText, clientDomain);
        updatedCSVTypes.push('content_gap');
      }
      
      if (csvFiles.rephonic.newFile) {
        const csvText = await readFileAsText(csvFiles.rephonic.newFile);
        newRephonicData = parseRephonicCSV(csvText);
        updatedCSVTypes.push('rephonic');
      }

      // Extract client info from existing report for AI categorization
      const clientInfo = {
        target_audiences: existingReportData.client?.target_audiences || 
          existingReportData.campaign_overview?.target_audiences || [],
        company_name: existingReportData.company_name || existingReportData.client?.company || undefined,
      };

      // Merge the updated data with existing report
      const updatedReportData = await mergeUpdatedReportData(
        existingReportData,
        {
          batchData: newBatchData,
          airtableData: newAirtableData,
          sovData: newSOVData,
          geoData: newGEOData,
          contentGapData: newContentGapData,
          rephonicData: newRephonicData,
        },
        updatedCSVTypes,
        { start: dateRangeStart, end: dateRangeEnd },
        clientInfo
      );

      // Save to database
      const { error } = await supabase
        .from('reports')
        .update({ 
          report_data: updatedReportData as any,
          generated_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      if (error) throw error;

      toast({
        title: "Report updated",
        description: `Successfully updated ${updatedCSVTypes.length} CSV${updatedCSVTypes.length > 1 ? 's' : ''}.`,
      });
      
      // Reset form
      resetForm();
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update report CSVs",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setCsvFiles({
      sov: { hasData: false, newFile: null },
      geo: { hasData: false, newFile: null },
      content_gap: { hasData: false, newFile: null },
      rephonic: { hasData: false, newFile: null },
    });
    setSingleSpeakerFiles({ batchFile: null, airtableFile: null, airtableSyncedData: null });
    setSpeakerFiles({});
    setExpandedSpeakers(new Set());
  };

  const optionalCsvConfigs: { type: Exclude<CSVType, 'batch' | 'airtable'>; label: string; description: string }[] = [
    { type: 'sov', label: 'SOV CSV', description: 'Share of Voice data' },
    { type: 'geo', label: 'GEO CSV', description: 'AI visibility data' },
    { type: 'content_gap', label: 'Content Gap CSV', description: 'Content gap analysis' },
    { type: 'rephonic', label: 'Rephonic EMV CSV', description: 'Earned media value data' },
  ];

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Update Report CSVs
          </DialogTitle>
          <DialogDescription>
            Upload new CSV files to refresh data in "{report?.report_name}". 
            Only uploaded files will be updated; other data will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Info */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">{report?.report_name}</p>
              <p className="text-sm text-muted-foreground">
                {report?.quarter} • {new Date(report?.date_range_start).toLocaleDateString()} - {new Date(report?.date_range_end).toLocaleDateString()}
              </p>
              {isMultiSpeaker && (
                <Badge variant="secondary" className="mt-1">
                  Multi-Speaker Report ({speakerBreakdowns.length} speakers)
                </Badge>
              )}
            </div>
          </div>

          {/* Required CSVs - Different UI for single vs multi-speaker */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              {isMultiSpeaker ? 'Per-Speaker CSVs' : 'Required CSVs'}
            </h4>
            
            {isMultiSpeaker ? (
              // Multi-speaker: collapsible sections per speaker
              <div className="space-y-2">
                {speakerBreakdowns.map((speaker) => (
                  <Collapsible
                    key={speaker.speaker_id}
                    open={expandedSpeakers.has(speaker.speaker_id)}
                    onOpenChange={() => toggleSpeakerExpanded(speaker.speaker_id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          {expandedSpeakers.has(speaker.speaker_id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{speaker.speaker_name}</p>
                            {speaker.speaker_title && (
                              <p className="text-xs text-muted-foreground">{speaker.speaker_title}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(speakerFiles[speaker.speaker_id]?.batchFile || speakerFiles[speaker.speaker_id]?.airtableFile) && (
                            <Badge variant="default" className="bg-primary/20 text-primary">
                              <Check className="h-3 w-3 mr-1" />
                              Files selected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 pl-6 space-y-2">
                      <CSVUploadRow
                        label="Batch CSV"
                        description="Podcast evaluations and scores"
                        hasExistingData={true}
                        file={speakerFiles[speaker.speaker_id]?.batchFile || null}
                        onFileChange={(file) => handleSpeakerFileChange(speaker.speaker_id, 'batch', file)}
                      />
                      <CSVUploadRow
                        label="Airtable CSV"
                        description="Booking status and episode links"
                        hasExistingData={true}
                        file={speakerFiles[speaker.speaker_id]?.airtableFile || null}
                        onFileChange={(file) => handleSpeakerFileChange(speaker.speaker_id, 'airtable', file)}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            ) : (
              // Single-speaker: simple file inputs with Airtable sync option
              <>
                <CSVUploadRow
                  label="Batch CSV"
                  description="Podcast evaluations and scores"
                  hasExistingData={true}
                  file={singleSpeakerFiles.batchFile}
                  onFileChange={(file) => handleSingleSpeakerFileChange('batch', file)}
                />
                <AirtableUploadRow
                  label="Airtable Data"
                  description="Booking status and episode links"
                  hasExistingData={true}
                  file={singleSpeakerFiles.airtableFile}
                  syncedData={singleSpeakerFiles.airtableSyncedData}
                  onFileChange={(file) => handleSingleSpeakerFileChange('airtable', file)}
                  companyId={report?.company_id}
                  speakerId={report?.speaker_id}
                  entityName={reportData?.client?.name || reportData?.company_name || 'Speaker'}
                  dateRangeStart={report?.date_range_start}
                  dateRangeEnd={report?.date_range_end}
                  onDataSynced={handleSingleSpeakerAirtableSync}
                />
              </>
            )}
          </div>

          {/* Optional Company-Level CSVs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              {isMultiSpeaker ? 'Company-Level CSVs' : 'Optional CSVs'}
            </h4>
            {optionalCsvConfigs.map(config => (
              <CSVUploadRow
                key={config.type}
                label={config.label}
                description={config.description}
                hasExistingData={getDataStatus(config.type)}
                file={csvFiles[config.type].newFile}
                onFileChange={(file) => handleOptionalFileChange(config.type, file)}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={!hasAnyFileSelected || isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Update Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CSVUploadRowProps {
  label: string;
  description: string;
  hasExistingData: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function CSVUploadRow({ label, description, hasExistingData, file, onFileChange }: CSVUploadRowProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {hasExistingData ? (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Check className="h-3 w-3 mr-1" />
            Has data
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            No data
          </Badge>
        )}
        
        <div className="relative">
          <Input
            type="file"
            accept=".csv"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          <Button variant={file ? "default" : "outline"} size="sm" className="pointer-events-none">
            {file ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                {file.name.length > 15 ? file.name.slice(0, 12) + '...' : file.name}
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </>
            )}
          </Button>
        </div>
        
        {file && (
          <Button variant="ghost" size="sm" onClick={() => onFileChange(null)}>
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}

interface AirtableUploadRowProps {
  label: string;
  description: string;
  hasExistingData: boolean;
  file: File | null;
  syncedData: AirtableCSVRow[] | null;
  onFileChange: (file: File | null) => void;
  companyId?: string;
  speakerId?: string;
  entityName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  onDataSynced: (data: AirtableCSVRow[]) => void;
}

function AirtableUploadRow({
  label,
  description,
  hasExistingData,
  file,
  syncedData,
  onFileChange,
  companyId,
  speakerId,
  entityName,
  dateRangeStart,
  dateRangeEnd,
  onDataSynced,
}: AirtableUploadRowProps) {
  const hasSyncedData = syncedData && syncedData.length > 0;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {hasSyncedData ? (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Check className="h-3 w-3 mr-1" />
            {syncedData.length} synced
          </Badge>
        ) : hasExistingData ? (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Check className="h-3 w-3 mr-1" />
            Has data
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            No data
          </Badge>
        )}
        
        {/* Airtable Sync Button */}
        <AirtableSyncButton
          companyId={companyId}
          speakerId={speakerId}
          entityName={entityName}
          dateRangeStart={dateRangeStart}
          dateRangeEnd={dateRangeEnd}
          onDataSynced={onDataSynced}
          variant="compact"
        />

        {/* Divider */}
        <span className="text-muted-foreground">or</span>
        
        {/* File upload fallback */}
        <div className="relative">
          <Input
            type="file"
            accept=".csv"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          <Button variant={file ? "default" : "outline"} size="sm" className="pointer-events-none">
            {file ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                {file.name.length > 15 ? file.name.slice(0, 12) + '...' : file.name}
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                CSV
              </>
            )}
          </Button>
        </div>
        
        {(file || hasSyncedData) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              onFileChange(null);
              if (hasSyncedData) {
                // Clear synced data by syncing empty array
                onDataSynced([]);
              }
            }}
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}
