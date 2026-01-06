import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Check, RefreshCw, Upload } from "lucide-react";
import { parseBatchCSV, parseAirtableCSV, parseSOVCSV, parseGEOCSV, parseContentGapCSV, parseRephonicCSV } from "@/utils/csvParsers";
import { mergeUpdatedReportData } from "@/utils/reportGenerator";
import { ReportData } from "@/types/reports";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export function UpdateCSVDialog({ open, onOpenChange, report, onUpdated }: UpdateCSVDialogProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Track files to be updated
  const [csvFiles, setCsvFiles] = useState<Record<CSVType, CSVStatus>>({
    batch: { hasData: true, newFile: null }, // Always has data
    airtable: { hasData: true, newFile: null }, // Always has data
    sov: { hasData: false, newFile: null },
    geo: { hasData: false, newFile: null },
    content_gap: { hasData: false, newFile: null },
    rephonic: { hasData: false, newFile: null },
  });

  // Determine what data exists in the current report
  const reportData = report?.report_data as ReportData;
  
  const getDataStatus = (type: CSVType): boolean => {
    if (!reportData) return false;
    switch (type) {
      case 'batch':
      case 'airtable':
        return true; // These are always present
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

  const handleFileChange = (type: CSVType, file: File | null) => {
    setCsvFiles(prev => ({
      ...prev,
      [type]: { ...prev[type], newFile: file },
    }));
  };

  const hasAnyFileSelected = Object.values(csvFiles).some(s => s.newFile !== null);

  const handleUpdate = async () => {
    if (!report || !hasAnyFileSelected) return;
    
    setIsProcessing(true);
    
    try {
      const existingReportData = report.report_data as ReportData;
      const updatedCSVTypes: CSVType[] = [];
      
      // Get date range from report
      const dateRangeStart = new Date(report.date_range_start);
      const dateRangeEnd = new Date(report.date_range_end);
      
      // Parse all new files
      let newBatchData: any[] | null = null;
      let newAirtableData: any[] | null = null;
      let newSOVData: any[] | null = null;
      let newGEOData: any[] | null = null;
      let newContentGapData: any[] | null = null;
      let newRephonicData: any[] | null = null;

      if (csvFiles.batch.newFile) {
        const csvText = await readFileAsText(csvFiles.batch.newFile);
        newBatchData = parseBatchCSV(csvText);
        updatedCSVTypes.push('batch');
      }
      
      if (csvFiles.airtable.newFile) {
        const csvText = await readFileAsText(csvFiles.airtable.newFile);
        newAirtableData = parseAirtableCSV(csvText, dateRangeStart, dateRangeEnd);
        updatedCSVTypes.push('airtable');
      }
      
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
        newContentGapData = parseContentGapCSV(csvText);
        updatedCSVTypes.push('content_gap');
      }
      
      if (csvFiles.rephonic.newFile) {
        const csvText = await readFileAsText(csvFiles.rephonic.newFile);
        newRephonicData = parseRephonicCSV(csvText);
        updatedCSVTypes.push('rephonic');
      }

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
        updatedCSVTypes
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
      
      // Reset form and close
      setCsvFiles({
        batch: { hasData: true, newFile: null },
        airtable: { hasData: true, newFile: null },
        sov: { hasData: false, newFile: null },
        geo: { hasData: false, newFile: null },
        content_gap: { hasData: false, newFile: null },
        rephonic: { hasData: false, newFile: null },
      });
      
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

  const csvConfigs: { type: CSVType; label: string; required: boolean; description: string }[] = [
    { type: 'batch', label: 'Batch CSV', required: true, description: 'Podcast evaluations and scores' },
    { type: 'airtable', label: 'Airtable CSV', required: true, description: 'Booking status and episode links' },
    { type: 'sov', label: 'SOV CSV', required: false, description: 'Share of Voice data' },
    { type: 'geo', label: 'GEO CSV', required: false, description: 'AI visibility data' },
    { type: 'content_gap', label: 'Content Gap CSV', required: false, description: 'Content gap analysis' },
    { type: 'rephonic', label: 'Rephonic EMV CSV', required: false, description: 'Earned media value data' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
            </div>
          </div>

          {/* Required CSVs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Required CSVs</h4>
            {csvConfigs.filter(c => c.required).map(config => (
              <CSVUploadRow
                key={config.type}
                config={config}
                hasExistingData={getDataStatus(config.type)}
                file={csvFiles[config.type].newFile}
                onFileChange={(file) => handleFileChange(config.type, file)}
              />
            ))}
          </div>

          {/* Optional CSVs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Optional CSVs</h4>
            {csvConfigs.filter(c => !c.required).map(config => (
              <CSVUploadRow
                key={config.type}
                config={config}
                hasExistingData={getDataStatus(config.type)}
                file={csvFiles[config.type].newFile}
                onFileChange={(file) => handleFileChange(config.type, file)}
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
  config: { type: CSVType; label: string; required: boolean; description: string };
  hasExistingData: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function CSVUploadRow({ config, hasExistingData, file, onFileChange }: CSVUploadRowProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        {hasExistingData ? (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <Check className="h-3 w-3 mr-1" />
            Has data
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            No data
          </Badge>
        )}
        
        {/* File input */}
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
                {file.name.slice(0, 15)}...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </>
            )}
          </Button>
        </div>
        
        {/* Clear button */}
        {file && (
          <Button variant="ghost" size="sm" onClick={() => onFileChange(null)}>
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}
