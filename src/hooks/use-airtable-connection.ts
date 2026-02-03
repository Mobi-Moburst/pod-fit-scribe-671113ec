import { useState, useEffect, useCallback } from 'react';
import { supabase, TEAM_ORG_ID } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AirtableConnection {
  id: string;
  org_id: string;
  name: string;
  company_id?: string;
  speaker_id?: string;
  base_id: string;
  table_id: string;
  personal_access_token?: string;
  field_mapping: Record<string, string>;
  speaker_column_name?: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AirtableCSVRow {
  podcast_name: string;
  apple_podcast_link?: string;
  action: string;
  scheduled_date_time: string;
  show_notes?: string;
  date_booked?: string;
  date_published?: string;
  link_to_episode?: string;
}

interface UseAirtableConnectionOptions {
  companyId?: string;
  speakerId?: string;
}

export function useAirtableConnection({ companyId, speakerId }: UseAirtableConnectionOptions = {}) {
  const [connection, setConnection] = useState<AirtableConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Fetch connection for company or speaker
  // Priority: speaker-level connection > company-level connection (fallback)
  const fetchConnection = useCallback(async () => {
    if (!companyId && !speakerId) {
      setConnection(null);
      return;
    }

    setIsLoading(true);
    try {
      let foundConnection: AirtableConnection | null = null;

      // If speakerId provided, first try speaker-specific connection
      if (speakerId) {
        const { data: speakerConn, error: speakerErr } = await supabase
          .from('airtable_connections')
          .select('*')
          .eq('speaker_id', speakerId)
          .maybeSingle();
        
        if (speakerErr) throw speakerErr;
        foundConnection = speakerConn as AirtableConnection | null;
      }

      // Fallback to company-level connection if no speaker connection found
      if (!foundConnection && companyId) {
        const { data: companyConn, error: companyErr } = await supabase
          .from('airtable_connections')
          .select('*')
          .eq('company_id', companyId)
          .is('speaker_id', null)
          .maybeSingle();
        
        if (companyErr) throw companyErr;
        foundConnection = companyConn as AirtableConnection | null;
      }

      setConnection(foundConnection);
    } catch (error) {
      console.error('Failed to fetch Airtable connection:', error);
      setConnection(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, speakerId]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Save or update connection
  const saveConnection = async (data: {
    name: string;
    base_id: string;
    table_id: string;
    personal_access_token?: string;
    field_mapping: Record<string, string>;
    speaker_column_name?: string;
  }) => {
    setIsLoading(true);
    try {
      const payload = {
        org_id: TEAM_ORG_ID,
        company_id: companyId || null,
        speaker_id: speakerId || null,
        ...data,
      };

      if (connection) {
        // Update existing
        const { error } = await supabase
          .from('airtable_connections')
          .update(payload)
          .eq('id', connection.id);
        
        if (error) throw error;
        toast({ title: 'Connection updated' });
      } else {
        // Create new
        const { error } = await supabase
          .from('airtable_connections')
          .insert([payload]);
        
        if (error) throw error;
        toast({ title: 'Airtable connected', description: 'You can now sync data directly from Airtable.' });
      }

      await fetchConnection();
      return true;
    } catch (error) {
      console.error('Failed to save Airtable connection:', error);
      toast({
        title: 'Failed to save connection',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete connection
  const deleteConnection = async () => {
    if (!connection) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('airtable_connections')
        .delete()
        .eq('id', connection.id);

      if (error) throw error;
      
      setConnection(null);
      toast({ title: 'Connection removed' });
      return true;
    } catch (error) {
      console.error('Failed to delete Airtable connection:', error);
      toast({
        title: 'Failed to remove connection',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Sync data from Airtable
  const syncData = async (options: {
    dateRangeStart: string;
    dateRangeEnd: string;
    speakerName?: string;
  }): Promise<AirtableCSVRow[] | null> => {
    if (!connection) {
      toast({
        title: 'No Airtable connection',
        description: 'Please set up an Airtable connection first.',
        variant: 'destructive',
      });
      return null;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-airtable-data', {
        body: {
          connection_id: connection.id,
          date_range_start: options.dateRangeStart,
          date_range_end: options.dateRangeEnd,
          speaker_name: options.speakerName,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');

      toast({
        title: 'Sync complete',
        description: `Fetched ${data.count} records from Airtable.`,
      });

      // Refresh connection to update last_synced_at
      await fetchConnection();

      return data.data as AirtableCSVRow[];
    } catch (error) {
      console.error('Failed to sync Airtable data:', error);
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    connection,
    isLoading,
    isSyncing,
    hasConnection: !!connection,
    saveConnection,
    deleteConnection,
    syncData,
    refreshConnection: fetchConnection,
  };
}
