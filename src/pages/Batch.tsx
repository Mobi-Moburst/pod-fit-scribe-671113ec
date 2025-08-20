import { useEffect, useState, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClientCombobox } from '@/components/ClientCombobox';
import { ResultsTable } from '@/components/batch/ResultsTable';
import { EvaluationPanel } from '@/components/batch/EvaluationPanel';
import { getClients } from '@/data/clientStore';
import { BatchRow, BatchState, PreflightResult } from '@/types/batch';
import { 
  parseCSV, 
  validateAndDedupeUrls, 
  processSingleUrl, 
  exportToCSV 
} from '@/utils/batchProcessor';
import { Upload, AlertTriangle, CheckCircle, Download, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CONCURRENT_LIMIT = 8;
const ROWS_PER_PAGE = 25;

const Batch = () => {
  useEffect(() => { document.title = 'Batch — Podcast Fit Rater'; }, []);
  
  const [clients] = useState(getClients());
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [selectedRow, setSelectedRow] = useState<BatchRow | null>(null);
  const { toast } = useToast();
  
  const [state, setState] = useState<BatchState>({
    client_id: null,
    rows: [],
    processing: false,
    completed: 0,
    total: 0,
    filters: {
      min_score: 0,
      verdict: 'all',
      stale: false
    },
    selected_rows: new Set(),
    current_page: 1,
    rows_per_page: ROWS_PER_PAGE
  });
  
  // Handle CSV upload and validation
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setCsvFile(file);
      const data = await parseCSV(file);
      const preflight = validateAndDedupeUrls(data);
      setPreflightResult(preflight);
      
      // Convert to batch rows
      const rows: BatchRow[] = preflight.valid_urls.map((url, index) => ({
        id: `row-${index}`,
        podcast_url: url,
        show_notes_fallback: data.find(d => d.podcast_url === url || d.url === url)?.show_notes_fallback,
        status: 'pending'
      }));
      
      setState(prev => ({ ...prev, rows, total: rows.length }));
    } catch (error) {
      toast({
        description: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  }, [toast]);
  
  // Process URLs concurrently
  const startProcessing = useCallback(async () => {
    if (!state.client_id) {
      toast({ description: 'Please select a client first', variant: 'destructive' });
      return;
    }
    
    const client = clients.find(c => c.id === state.client_id);
    if (!client) {
      toast({ description: 'Selected client not found', variant: 'destructive' });
      return;
    }
    
    setState(prev => ({ ...prev, processing: true, completed: 0 }));
    
    const processingQueue = [...state.rows.filter(row => row.status === 'pending' || row.status === 'retry')];
    let completed = 0;
    
    // Process in batches
    for (let i = 0; i < processingQueue.length; i += CONCURRENT_LIMIT) {
      const batch = processingQueue.slice(i, i + CONCURRENT_LIMIT);
      
      // Update status to processing
      setState(prev => ({
        ...prev,
        rows: prev.rows.map(row => 
          batch.find(b => b.id === row.id) ? { ...row, status: 'processing' } : row
        )
      }));
      
      // Process batch concurrently
      const results = await Promise.allSettled(
        batch.map(row => processSingleUrl(row, client))
      );
      
      // Update results
      setState(prev => ({
        ...prev,
        rows: prev.rows.map(row => {
          const batchIndex = batch.findIndex(b => b.id === row.id);
          if (batchIndex === -1) return row;
          
          const result = results[batchIndex];
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            return { ...row, status: 'error', error: 'Processing failed' };
          }
        }),
        completed: completed + batch.length
      }));
      
      completed += batch.length;
    }
    
    setState(prev => ({ ...prev, processing: false }));
    toast({ description: 'Batch processing completed' });
  }, [state.client_id, state.rows, clients, toast]);
  
  // Retry failed row
  const retryRow = useCallback(async (row: BatchRow) => {
    if (!state.client_id) return;
    
    const client = clients.find(c => c.id === state.client_id);
    if (!client) return;
    
    setState(prev => ({
      ...prev,
      rows: prev.rows.map(r => r.id === row.id ? { ...r, status: 'processing', error: undefined } : r)
    }));
    
    try {
      const result = await processSingleUrl(row, client, true); // Force refresh
      setState(prev => ({
        ...prev,
        rows: prev.rows.map(r => r.id === row.id ? result : r)
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        rows: prev.rows.map(r => r.id === row.id ? { ...r, status: 'error', error: 'Retry failed' } : r)
      }));
    }
  }, [state.client_id, clients]);
  
  // Filtering
  const filteredRows = useMemo(() => {
    return state.rows.filter(row => {
      if (state.filters.min_score > 0 && (row.overall_score ?? 0) < state.filters.min_score) {
        return false;
      }
      
      if (state.filters.verdict !== 'all' && row.verdict !== state.filters.verdict) {
        return false;
      }
      
      if (state.filters.stale) {
        const isStale = row.last_publish_date && 
          new Date(row.last_publish_date) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        if (!isStale) return false;
      }
      
      return true;
    });
  }, [state.rows, state.filters]);
  
  // Pagination
  const paginatedRows = useMemo(() => {
    const start = (state.current_page - 1) * state.rows_per_page;
    return filteredRows.slice(start, start + state.rows_per_page);
  }, [filteredRows, state.current_page, state.rows_per_page]);
  
  const totalPages = Math.ceil(filteredRows.length / state.rows_per_page);
  
  // Selection handlers
  const handleRowSelect = useCallback((id: string, selected: boolean) => {
    setState(prev => {
      const newSelected = new Set(prev.selected_rows);
      if (selected) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      return { ...prev, selected_rows: newSelected };
    });
  }, []);
  
  const handleSelectAll = useCallback((selected: boolean) => {
    setState(prev => ({
      ...prev,
      selected_rows: selected ? new Set(paginatedRows.map(r => r.id)) : new Set()
    }));
  }, [paginatedRows]);
  
  const selectAllPassing = useCallback(() => {
    const passingRows = state.rows.filter(row => 
      row.verdict === 'Fit' && (row.overall_score ?? 0) >= state.filters.min_score
    );
    setState(prev => ({
      ...prev,
      selected_rows: new Set(passingRows.map(r => r.id))
    }));
  }, [state.rows, state.filters.min_score]);
  
  // Export handlers
  const exportSelected = useCallback(() => {
    const selectedRows = state.rows.filter(row => state.selected_rows.has(row.id));
    if (selectedRows.length === 0) {
      toast({ description: 'No rows selected for export', variant: 'destructive' });
      return;
    }
    exportToCSV(selectedRows, 'batch-results-selected.csv');
  }, [state.rows, state.selected_rows, toast]);
  
  const exportAll = useCallback(() => {
    const completedRows = state.rows.filter(row => row.status === 'success');
    if (completedRows.length === 0) {
      toast({ description: 'No completed results to export', variant: 'destructive' });
      return;
    }
    exportToCSV(completedRows);
  }, [state.rows, toast]);

  return (
    <div className="flex h-screen">
      <BackgroundFX />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        
        <main className="flex-1 overflow-auto px-6 py-4">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold">Batch Evaluation</h1>
              <p className="text-muted-foreground">
                Select client → upload CSV of URLs → process in batch → filter and export results
              </p>
            </div>
            
            {/* Setup Section */}
            <Card className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Client Selection */}
                <div className="space-y-2">
                  <Label>Select Client</Label>
                  <ClientCombobox
                    clients={clients}
                    value={state.client_id || ''}
                    onChange={(clientId) => setState(prev => ({ ...prev, client_id: clientId }))}
                    placeholder="Choose a client for evaluation..."
                  />
                </div>
                
                {/* CSV Upload */}
                <div className="space-y-2">
                  <Label>Upload CSV</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={!state.client_id}
                    />
                    <Button
                      onClick={startProcessing}
                      disabled={!state.client_id || state.rows.length === 0 || state.processing}
                      className="shrink-0"
                    >
                      {state.processing ? 'Processing...' : 'Start'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CSV format: podcast_url, show_notes_fallback (optional)
                  </p>
                </div>
              </div>
            </Card>
            
            {/* Pre-flight Results */}
            {preflightResult && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{preflightResult.total_unique} valid URLs</span>
                    {preflightResult.invalid_urls.length > 0 && (
                      <span className="text-red-600">{preflightResult.invalid_urls.length} invalid</span>
                    )}
                    {preflightResult.duplicates.length > 0 && (
                      <span className="text-orange-600">{preflightResult.duplicates.length} duplicates removed</span>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Progress */}
            {state.processing && (
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing...</span>
                    <span>{state.completed} / {state.total}</span>
                  </div>
                  <Progress value={(state.completed / state.total) * 100} />
                </div>
              </Card>
            )}
            
            {/* Controls */}
            {state.rows.length > 0 && (
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <Label className="text-sm">Min Score:</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={state.filters.min_score}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        filters: { ...prev.filters, min_score: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-20"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Verdict:</Label>
                    <Select
                      value={state.filters.verdict}
                      onValueChange={(value) => setState(prev => ({
                        ...prev,
                        filters: { ...prev.filters, verdict: value as any }
                      }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Fit">Fit</SelectItem>
                        <SelectItem value="Consider">Consider</SelectItem>
                        <SelectItem value="Not">Not</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="stale-filter"
                      checked={state.filters.stale}
                      onCheckedChange={(checked) => setState(prev => ({
                        ...prev,
                        filters: { ...prev.filters, stale: !!checked }
                      }))}
                    />
                    <Label htmlFor="stale-filter" className="text-sm">Show only stale (&gt;90d)</Label>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" variant="outline" onClick={selectAllPassing}>
                      Select All Passing
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportSelected} disabled={state.selected_rows.size === 0}>
                      <Download className="h-3 w-3 mr-1" />
                      Export Selected ({state.selected_rows.size})
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportAll}>
                      <Download className="h-3 w-3 mr-1" />
                      Export All
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            
            {/* Results */}
            {state.rows.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">
                    Results ({filteredRows.length} of {state.rows.length})
                  </h3>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setState(prev => ({ ...prev, current_page: Math.max(1, prev.current_page - 1) }))}
                        disabled={state.current_page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {state.current_page} of {totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setState(prev => ({ ...prev, current_page: Math.min(totalPages, prev.current_page + 1) }))}
                        disabled={state.current_page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
                
                <ResultsTable
                  rows={paginatedRows}
                  selectedRows={state.selected_rows}
                  onRowSelect={handleRowSelect}
                  onSelectAll={handleSelectAll}
                  onRowClick={setSelectedRow}
                  onRetry={retryRow}
                  loading={state.processing}
                />
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Evaluation Panel */}
      {selectedRow && (
        <div className="w-96 shrink-0">
          <EvaluationPanel
            row={selectedRow}
            onClose={() => setSelectedRow(null)}
          />
        </div>
      )}
    </div>
  );
};

export default Batch;
