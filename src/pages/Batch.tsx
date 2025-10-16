import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClientCombobox } from '@/components/ClientCombobox';
import { ResultsTable } from '@/components/batch/ResultsTable';
import { EvaluationPanel } from '@/components/batch/EvaluationPanel';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { MinimalClient } from '@/types/clients';
import { BatchRow, BatchState, PreflightResult } from '@/types/batch';
import { 
  parseCSV, 
  validateAndDedupeUrls, 
  processSingleUrl, 
  exportToCSV,
  detectUrlColumn,
  detectDescriptionColumn
} from '@/utils/batchProcessor';
import { Upload, AlertTriangle, CheckCircle, Download, Filter, Loader2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CONCURRENT_LIMIT = 8;
const ROWS_PER_PAGE = 25;

const Batch = () => {
  useEffect(() => { document.title = 'Batch — Podcast Fit Rater'; }, []);
  
  const [clients, setClients] = useState<MinimalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [selectedRow, setSelectedRow] = useState<BatchRow | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load clients from Supabase
  useEffect(() => {
    const loadClients = async () => {
      try {
        setClientsLoading(true);
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const mappedClients: MinimalClient[] = (data || []).map(client => ({
          id: client.id,
          name: client.name,
          company: client.company || undefined,
          company_url: client.company_url || undefined,
          media_kit_url: client.media_kit_url,
          target_audiences: client.target_audiences || [],
          talking_points: client.talking_points || [],
          avoid: client.avoid || [],
          notes: client.notes || undefined,
          campaign_manager: client.campaign_manager || undefined,
          campaign_strategy: client.campaign_strategy,
          pitch_template: client.pitch_template || undefined
        }));
        
        setClients(mappedClients);
      } catch (error) {
        console.error('Failed to load clients:', error);
        toast({
          description: 'Failed to load clients. Please refresh the page.',
          variant: 'destructive'
        });
      } finally {
        setClientsLoading(false);
      }
    };

    loadClients();
  }, [toast]);
  
  const [state, setState] = useState<BatchState>({
    client_id: null,
    rows: [],
    processing: false,
    completed: 0,
    total: 0,
    filters: {
      min_score: 'all',
      verdict: 'all',
      stale: false,
      min_listeners: 'all',
      categories: [],
      min_engagement: 'all',
      published_within: 'all'
    },
    selected_rows: new Set(),
    current_page: 1,
    rows_per_page: ROWS_PER_PAGE
  });
  
  // Handle CSV upload and validation
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadedFileName(file.name);
    
    try {
      setCsvFile(file);
      const data = await parseCSV(file);
      const preflight = validateAndDedupeUrls(data);
      setPreflightResult(preflight);
      
      // Convert to batch rows, preserving Rephonic metadata
      const rows: BatchRow[] = preflight.valid_urls.map((url, index) => {
        const sourceRow = data.find(d => detectUrlColumn(d) === url);
        
        return {
          id: `row-${index}`,
          podcast_url: url,
          show_notes_fallback: sourceRow ? detectDescriptionColumn(sourceRow) : undefined,
          status: 'pending',
          metadata: sourceRow ? {
            name: sourceRow.Name,
            publisher: sourceRow.Publisher,
            listeners_per_episode: sourceRow['Listeners Per Episode'] ? parseInt(sourceRow['Listeners Per Episode'].replace(/,/g, '')) : undefined,
            monthly_listens: sourceRow['Monthly Listens'] ? parseInt(sourceRow['Monthly Listens'].replace(/,/g, '')) : undefined,
            categories: sourceRow.Categories,
            social_reach: sourceRow['Social Reach'] ? parseInt(sourceRow['Social Reach'].replace(/,/g, '')) : undefined,
            engagement: sourceRow.Engagement ? parseInt(sourceRow.Engagement) : undefined,
            language: sourceRow.Language,
            status: sourceRow.Status,
            publishes: sourceRow.Publishes,
            website: sourceRow.Website
          } : undefined
        };
      });
      
      setState(prev => ({ ...prev, rows, total: rows.length }));
    } catch (error) {
      toast({
        description: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
      setUploadedFileName(null);
    }
  }, [toast]);
  
  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      if (!file.name.endsWith('.csv')) {
        toast({
          description: 'Please upload a CSV file',
          variant: 'destructive'
        });
        return;
      }
      
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      handleFileUpload(syntheticEvent);
    }
  }, [handleFileUpload, toast]);
  
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
  
  // Extract unique categories from all rows
  const availableCategories = useMemo(() => {
    const categorySet = new Set<string>();
    state.rows.forEach(row => {
      if (row.metadata?.categories) {
        row.metadata.categories.split(',').forEach(cat => {
          categorySet.add(cat.trim());
        });
      }
    });
    return Array.from(categorySet).sort();
  }, [state.rows]);

  // Filtering
  const filteredRows = useMemo(() => {
    // Convert dropdown values to numeric thresholds
    const scoreThreshold = {
      'all': 0,
      '8+': 8.0,
      '7+': 7.0,
      '6+': 6.0,
      '5+': 5.0,
      '4+': 4.0
    }[state.filters.min_score];
    
    const listenerThreshold = {
      'all': 0,
      '10000+': 10000,
      '5000+': 5000,
      '1000+': 1000,
      '500+': 500,
      '100+': 100
    }[state.filters.min_listeners];
    
    const engagementThreshold = {
      'all': 0,
      '70+': 70,
      '60+': 60,
      '50+': 50,
      '40+': 40
    }[state.filters.min_engagement];

    return state.rows.filter(row => {
      // Score filter
      if ((row.overall_score ?? 0) < scoreThreshold) {
        return false;
      }
      
      // Verdict filter
      if (state.filters.verdict !== 'all' && row.verdict !== state.filters.verdict) {
        return false;
      }
      
      // Stale filter
      if (state.filters.stale) {
        const isStale = row.last_publish_date && 
          new Date(row.last_publish_date) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        if (!isStale) return false;
      }
      
      // Listener filter
      if (listenerThreshold > 0) {
        if (!row.metadata?.listeners_per_episode || row.metadata.listeners_per_episode < listenerThreshold) {
          return false;
        }
      }
      
      // Category filter
      if (state.filters.categories.length > 0) {
        if (!row.metadata?.categories) return false;
        const rowCategories = row.metadata.categories.toLowerCase();
        const hasMatch = state.filters.categories.some(filterCat => 
          rowCategories.includes(filterCat.toLowerCase())
        );
        if (!hasMatch) return false;
      }
      
      // Engagement filter
      if (engagementThreshold > 0) {
        if (!row.metadata?.engagement || row.metadata.engagement < engagementThreshold) {
          return false;
        }
      }
      
      // Published within filter
      if (state.filters.published_within !== 'all') {
        if (!row.last_publish_date) return false;
        
        const publishDate = new Date(row.last_publish_date);
        const now = Date.now();
        const daysMap = {
          '30d': 30,
          '90d': 90,
          '180d': 180,
          '1y': 365
        };
        const maxAge = daysMap[state.filters.published_within] * 24 * 60 * 60 * 1000;
        
        if (now - publishDate.getTime() > maxAge) {
          return false;
        }
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
    const scoreThreshold = {
      'all': 0,
      '8+': 8.0,
      '7+': 7.0,
      '6+': 6.0,
      '5+': 5.0,
      '4+': 4.0
    }[state.filters.min_score];
    
    const passingRows = state.rows.filter(row => 
      row.verdict === 'Fit' && (row.overall_score ?? 0) >= scoreThreshold
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

  const saveBatchToHistory = useCallback(async () => {
    if (!state.client_id) {
      toast({ description: 'No client selected', variant: 'destructive' });
      return;
    }

    const successfulRows = state.rows.filter(row => row.status === 'success');
    
    if (successfulRows.length === 0) {
      toast({ description: 'No successful evaluations to save', variant: 'destructive' });
      return;
    }

    try {
      // Create batch session
      const batchName = `Batch - ${uploadedFileName?.replace('.csv', '') || 'Untitled'} (${new Date().toLocaleDateString()})`;
      
      const { data: batchSession, error: batchError } = await supabase
        .from('batch_sessions')
        .insert({
          client_id: state.client_id,
          name: batchName,
          total_count: successfulRows.length,
          success_count: successfulRows.length,
          org_id: TEAM_ORG_ID
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Insert all evaluations with batch_session_id
      const evaluationsToInsert = successfulRows.map(row => ({
        batch_session_id: batchSession.id,
        client_id: state.client_id,
        url: row.podcast_url,
        show_title: row.show_title,
        overall_score: row.overall_score,
        confidence: row.confidence,
        rubric_json: row.evaluation_data || {},
        citations: row.evaluation_data?.citations || [],
        org_id: TEAM_ORG_ID
      }));

      const { error: evalError } = await supabase
        .from('evaluations')
        .insert(evaluationsToInsert);

      if (evalError) throw evalError;

      toast({
        description: `✓ Saved ${successfulRows.length} evaluations to History`,
      });
    } catch (error) {
      console.error('Failed to save batch:', error);
      toast({
        description: 'Failed to save batch to history',
        variant: 'destructive'
      });
    }
  }, [state.client_id, state.rows, uploadedFileName, toast]);

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
                  {clientsLoading ? (
                    <div className="flex items-center gap-2 p-2 border rounded">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading clients...</span>
                    </div>
                  ) : (
                    <ClientCombobox
                      clients={clients}
                      value={state.client_id || ''}
                      onChange={(clientId) => setState(prev => ({ ...prev, client_id: clientId }))}
                      placeholder="Choose a client for evaluation..."
                    />
                  )}
                </div>
                
                {/* CSV Upload */}
                <div className="space-y-2">
                  <Label>Upload CSV</Label>
                  
                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                      isDragging 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50",
                      (!state.client_id || clientsLoading) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={!state.client_id || clientsLoading}
                      className="hidden"
                      id="csv-upload"
                    />
                    
                    <label 
                      htmlFor="csv-upload" 
                      className="flex flex-col items-center gap-2 cursor-pointer"
                    >
                      {uploadedFileName ? (
                        <>
                          <CheckCircle className="h-8 w-8 text-green-600" />
                          <div className="text-center">
                            <p className="font-medium">{uploadedFileName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Click to replace or drag new file
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <div className="text-center">
                            <p className="font-medium">
                              {isDragging ? 'Drop CSV file here' : 'Drag & drop CSV file here'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              or click to browse
                            </p>
                          </div>
                        </>
                      )}
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      CSV format: HubSpot (podcast_url) or Rephonic (Apple Podcasts column)
                    </p>
                    <Button
                      onClick={startProcessing}
                      disabled={!state.client_id || state.rows.length === 0 || state.processing || clientsLoading}
                      className="shrink-0"
                    >
                      {state.processing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>
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
                <div className="space-y-4">
                  {/* Row 1: Primary filters */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <Label className="text-sm">Score:</Label>
                      <Select
                        value={state.filters.min_score}
                        onValueChange={(value: any) => setState(prev => ({
                          ...prev,
                          filters: { ...prev.filters, min_score: value }
                        }))}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Scores</SelectItem>
                          <SelectItem value="8+">8.0+ (Excellent Fit)</SelectItem>
                          <SelectItem value="7+">7.0+ (Strong Fit)</SelectItem>
                          <SelectItem value="6+">6.0+ (Good Fit)</SelectItem>
                          <SelectItem value="5+">5.0+ (Consider)</SelectItem>
                          <SelectItem value="4+">4.0+ (Weak Fit)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Verdict:</Label>
                      <Select
                        value={state.filters.verdict}
                        onValueChange={(value: any) => setState(prev => ({
                          ...prev,
                          filters: { ...prev.filters, verdict: value }
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
                      <Label className="text-sm">Published:</Label>
                      <Select
                        value={state.filters.published_within}
                        onValueChange={(value: any) => setState(prev => ({
                          ...prev,
                          filters: { ...prev.filters, published_within: value }
                        }))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Time</SelectItem>
                          <SelectItem value="30d">Last 30 Days</SelectItem>
                          <SelectItem value="90d">Last 90 Days</SelectItem>
                          <SelectItem value="180d">Last 6 Months</SelectItem>
                          <SelectItem value="1y">Last Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Row 2: Audience & Engagement filters */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Listeners:</Label>
                      <Select
                        value={state.filters.min_listeners}
                        onValueChange={(value: any) => setState(prev => ({
                          ...prev,
                          filters: { ...prev.filters, min_listeners: value }
                        }))}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sizes</SelectItem>
                          <SelectItem value="10000+">10,000+ (Large)</SelectItem>
                          <SelectItem value="5000+">5,000+ (Medium-Large)</SelectItem>
                          <SelectItem value="1000+">1,000+ (Medium)</SelectItem>
                          <SelectItem value="500+">500+ (Small-Medium)</SelectItem>
                          <SelectItem value="100+">100+ (Small)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Categories:</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-48 justify-between">
                            {state.filters.categories.length > 0
                              ? `${state.filters.categories.length} selected`
                              : "All Categories"}
                            <Filter className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                            {availableCategories.length > 0 ? (
                              availableCategories.map((category) => (
                                <div key={category} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`cat-${category}`}
                                    checked={state.filters.categories.includes(category)}
                                    onCheckedChange={(checked) => {
                                      setState(prev => ({
                                        ...prev,
                                        filters: {
                                          ...prev.filters,
                                          categories: checked
                                            ? [...prev.filters.categories, category]
                                            : prev.filters.categories.filter(c => c !== category)
                                        }
                                      }));
                                    }}
                                  />
                                  <Label htmlFor={`cat-${category}`} className="text-sm cursor-pointer">
                                    {category}
                                  </Label>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground p-2">
                                Upload CSV to filter by category
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Engagement:</Label>
                      <Select
                        value={state.filters.min_engagement}
                        onValueChange={(value: any) => setState(prev => ({
                          ...prev,
                          filters: { ...prev.filters, min_engagement: value }
                        }))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          <SelectItem value="70+">High (70+)</SelectItem>
                          <SelectItem value="60+">Medium-High (60+)</SelectItem>
                          <SelectItem value="50+">Medium (50+)</SelectItem>
                          <SelectItem value="40+">Low-Medium (40+)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setState(prev => ({
                        ...prev,
                        filters: {
                          min_score: 'all',
                          verdict: 'all',
                          stale: false,
                          min_listeners: 'all',
                          categories: [],
                          min_engagement: 'all',
                          published_within: 'all'
                        }
                      }))}
                    >
                      Clear Filters
                    </Button>
                  </div>
                  
                  {/* Row 3: Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
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
                    <Button size="sm" onClick={saveBatchToHistory}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Save to History
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
            client={clients.find(c => c.id === state.client_id) || null}
          />
        </div>
      )}
    </div>
  );
};

export default Batch;
