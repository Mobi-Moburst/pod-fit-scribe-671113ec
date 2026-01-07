import { useState, useRef } from 'react';
import { Video, Music, Link, Upload, Trash2, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HighlightClip } from '@/types/reports';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HighlightUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingClips: HighlightClip[];
  onSave: (clips: HighlightClip[]) => void;
  podcasts?: string[];
  speakers?: string[];
}

type SourceType = 'youtube' | 'vimeo' | 'descript' | 'external' | 'upload';

function detectSourceType(url: string): SourceType {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('descript.com') || url.includes('share.descript.com')) return 'descript';
  return 'external';
}

function getYouTubeThumbnail(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
  }
  return null;
}

export default function HighlightUploadDialog({
  open,
  onOpenChange,
  existingClips,
  onSave,
  podcasts = [],
  speakers = [],
}: HighlightUploadDialogProps) {
  const [clips, setClips] = useState<HighlightClip[]>(existingClips);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [podcastName, setPodcastName] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useManualPodcast, setUseManualPodcast] = useState(false);

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setPodcastName('');
    setSpeakerName('');
    setDescription('');
    setMediaType('video');
    setSelectedFile(null);
    setUseManualPodcast(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddFromUrl = () => {
    if (!title.trim() || !url.trim()) {
      toast.error('Please provide a title and URL');
      return;
    }

    const sourceType = detectSourceType(url);
    const thumbnail = sourceType === 'youtube' ? getYouTubeThumbnail(url) : undefined;

    const newClip: HighlightClip = {
      id: crypto.randomUUID(),
      title: title.trim(),
      url: url.trim(),
      podcast_name: podcastName.trim() || undefined,
      speaker_name: speakerName.trim() || undefined,
      description: description.trim() || undefined,
      media_type: mediaType,
      source_type: sourceType,
      thumbnail_url: thumbnail || undefined,
      created_at: new Date().toISOString(),
    };

    setClips([...clips, newClip]);
    resetForm();
    toast.success('Clip added');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-detect media type from file
      if (file.type.startsWith('video/')) {
        setMediaType('video');
      } else if (file.type.startsWith('audio/')) {
        setMediaType('audio');
      }
    }
  };

  const handleUploadFile = async () => {
    if (!title.trim() || !selectedFile) {
      toast.error('Please provide a title and select a file');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `clips/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('report-highlights')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('report-highlights')
        .getPublicUrl(filePath);

      const newClip: HighlightClip = {
        id: crypto.randomUUID(),
        title: title.trim(),
        url: urlData.publicUrl,
        podcast_name: podcastName.trim() || undefined,
        speaker_name: speakerName.trim() || undefined,
        description: description.trim() || undefined,
        media_type: mediaType,
        source_type: 'upload',
        created_at: new Date().toISOString(),
      };

      setClips([...clips, newClip]);
      resetForm();
      toast.success('Clip uploaded and added');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClip = (clipId: string) => {
    setClips(clips.filter(c => c.id !== clipId));
    toast.success('Clip removed');
  };

  const handleSave = () => {
    onSave(clips);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Manage Interview Highlights
          </DialogTitle>
          <DialogDescription>
            Add video or audio clips from published interviews to showcase in the report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Existing Clips */}
          {clips.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Current Clips ({clips.length})</Label>
              <div className="space-y-2">
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      {clip.media_type === 'video' ? (
                        <Video className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Music className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{clip.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {clip.podcast_name || clip.source_type}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClip(clip.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Clip */}
          <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-sm font-medium">Add New Clip</Label>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'url' | 'upload')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Link className="w-4 h-4" /> External URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Clip title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="media-type">Media Type</Label>
                    <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'video' | 'audio')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">URL * (YouTube, Vimeo, Descript, or direct link)</Label>
                  <Input
                    id="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="podcast">Podcast Name</Label>
                      {podcasts.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setUseManualPodcast(!useManualPodcast);
                            setPodcastName('');
                          }}
                        >
                          {useManualPodcast ? 'Select from list' : 'Enter manually'}
                        </button>
                      )}
                    </div>
                    {podcasts.length > 0 && !useManualPodcast ? (
                      <Select value={podcastName} onValueChange={setPodcastName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select podcast" />
                        </SelectTrigger>
                        <SelectContent>
                          {podcasts.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="podcast"
                        placeholder="Podcast name"
                        value={podcastName}
                        onChange={(e) => setPodcastName(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="speaker">Speaker Name</Label>
                    {speakers.length > 0 ? (
                      <Select value={speakerName} onValueChange={setSpeakerName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select speaker" />
                        </SelectTrigger>
                        <SelectContent>
                          {speakers.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="speaker"
                        placeholder="Speaker name"
                        value={speakerName}
                        onChange={(e) => setSpeakerName(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the clip"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button onClick={handleAddFromUrl} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Clip
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="upload-title">Title *</Label>
                    <Input
                      id="upload-title"
                      placeholder="Clip title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-media-type">Media Type</Label>
                    <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'video' | 'audio')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Select File *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="video/*,audio/*"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="upload-podcast">Podcast Name</Label>
                      {podcasts.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setUseManualPodcast(!useManualPodcast);
                            setPodcastName('');
                          }}
                        >
                          {useManualPodcast ? 'Select from list' : 'Enter manually'}
                        </button>
                      )}
                    </div>
                    {podcasts.length > 0 && !useManualPodcast ? (
                      <Select value={podcastName} onValueChange={setPodcastName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select podcast" />
                        </SelectTrigger>
                        <SelectContent>
                          {podcasts.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="upload-podcast"
                        placeholder="Podcast name"
                        value={podcastName}
                        onChange={(e) => setPodcastName(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-speaker">Speaker Name</Label>
                    {speakers.length > 0 ? (
                      <Select value={speakerName} onValueChange={setSpeakerName}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select speaker" />
                        </SelectTrigger>
                        <SelectContent>
                          {speakers.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="upload-speaker"
                        placeholder="Speaker name"
                        value={speakerName}
                        onChange={(e) => setSpeakerName(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upload-description">Description (optional)</Label>
                  <Textarea
                    id="upload-description"
                    placeholder="Brief description of the clip"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button onClick={handleUploadFile} disabled={isUploading} className="w-full">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" /> Upload & Add Clip
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
