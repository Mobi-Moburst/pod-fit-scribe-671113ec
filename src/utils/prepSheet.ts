import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';

export interface PrepSheetRequest {
  url: string;
  client: any;
  recordingDateTime: string;
  manualLinkedIn?: string;
}

export interface PrepSheetData {
  showTitle: string;
  hostName: string;
  hostLinkedIn?: string;
  hostBackground?: string;
  talkingPoints: string[];
  audienceInsights: string;
  metrics: string;
  needsManualLinkedIn?: boolean;
  socialMetrics?: {
    youtube?: { subscribers: number; url: string };
    instagram?: { followers: number; url: string };
    twitter?: { followers: number; url: string };
  };
}

export const callPrepSheetAnalyze = async (request: PrepSheetRequest) => {
  try {
    const { data, error } = await supabase.functions.invoke('prep-sheet-analyze', {
      body: request
    });

    if (error) {
      console.error('Supabase function error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error calling prep sheet analyze:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const generatePrepSheetPDF = async (data: PrepSheetData, client: any) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const margin = 20;
  let yPosition = 30;

  // Header
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Interview Prep Sheet', margin, yPosition);
  
  yPosition += 20;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Client: ${client.name}`, margin, yPosition);
  yPosition += 8;
  pdf.text(`Show: ${data.showTitle}`, margin, yPosition);
  yPosition += 15;

  // Host Information
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Host Information', margin, yPosition);
  yPosition += 10;
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Name: ${data.hostName}`, margin, yPosition);
  yPosition += 6;
  
  if (data.hostLinkedIn) {
    pdf.text(`LinkedIn: ${data.hostLinkedIn}`, margin, yPosition);
    yPosition += 6;
  }
  
  if (data.hostBackground) {
    const backgroundLines = pdf.splitTextToSize(`Background: ${data.hostBackground}`, pageWidth - 2 * margin);
    pdf.text(backgroundLines, margin, yPosition);
    yPosition += backgroundLines.length * 5 + 5;
  }
  
  yPosition += 10;

  // Talking Points
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Key Talking Points', margin, yPosition);
  yPosition += 10;
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  data.talkingPoints.forEach((point, index) => {
    const pointLines = pdf.splitTextToSize(`${index + 1}. ${point}`, pageWidth - 2 * margin);
    pdf.text(pointLines, margin, yPosition);
    yPosition += pointLines.length * 5 + 3;
    
    // Check if we need a new page
    if (yPosition > pdf.internal.pageSize.height - 30) {
      pdf.addPage();
      yPosition = 30;
    }
  });
  
  yPosition += 10;

  // Audience Insights
  if (data.audienceInsights) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Audience Insights', margin, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const audienceLines = pdf.splitTextToSize(data.audienceInsights, pageWidth - 2 * margin);
    pdf.text(audienceLines, margin, yPosition);
    yPosition += audienceLines.length * 5 + 10;
  }

  // Notable Metrics
  if (data.metrics) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Notable Metrics', margin, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const metricsLines = pdf.splitTextToSize(data.metrics, pageWidth - 2 * margin);
    pdf.text(metricsLines, margin, yPosition);
    yPosition += metricsLines.length * 5;
  }

  // Social Media Metrics
  if (data.socialMetrics) {
    yPosition += 10;
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Social Media Presence', margin, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    if (data.socialMetrics.youtube) {
      pdf.text(`YouTube: ${data.socialMetrics.youtube.subscribers.toLocaleString()} subscribers`, margin, yPosition);
      yPosition += 6;
    }
    
    if (data.socialMetrics.instagram) {
      pdf.text(`Instagram: ${data.socialMetrics.instagram.followers.toLocaleString()} followers`, margin, yPosition);
      yPosition += 6;
    }
    
    if (data.socialMetrics.twitter) {
      pdf.text(`Twitter/X: ${data.socialMetrics.twitter.followers.toLocaleString()} followers`, margin, yPosition);
      yPosition += 6;
    }
  }

  // Footer
  const now = new Date();
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.text(`Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, margin, pdf.internal.pageSize.height - 10);

  // Download
  const fileName = `prep-sheet-${client.name.replace(/\s+/g, '-').toLowerCase()}-${data.showTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  pdf.save(fileName);
};