import { Button } from '@/components/ui/button';
import { Download, Share, Printer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReportHeaderProps {
  clientName: string;
  company?: string;
  period: string;
  batchName: string;
  logoUrl?: string;
  onExportPDF: () => void;
  onExportCSV: () => void;
  onShare: () => void;
}

export const ReportHeader = ({ 
  clientName, 
  company, 
  period, 
  batchName, 
  logoUrl,
  onExportPDF,
  onExportCSV,
  onShare 
}: ReportHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
      <div className="flex items-center gap-6">
        {logoUrl && (
          <img src={logoUrl} alt={`${clientName} logo`} className="h-12 w-auto" />
        )}
        <div>
          <h1 className="text-3xl font-bold text-foreground">{clientName}</h1>
          {company && <p className="text-muted-foreground">{company}</p>}
          <p className="text-sm text-muted-foreground mt-1">
            {period} • {batchName}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onExportPDF}>Export as PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportCSV}>Export Data (CSV)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>
    </div>
  );
};
