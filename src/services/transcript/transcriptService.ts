import { ValidationError } from '../../types/errors';

export interface TranscriptSegment {
  start: number; // Start time in seconds
  end: number; // End time in seconds
  text: string; // Transcript text
  confidence?: number; // Confidence score (0-1)
}

export interface TranscriptData {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  duration: number;
  source: 'youtube' | 'aws-transcribe' | 'manual';
  confidence: number; // Average confidence score
  extractedAt: string; // ISO timestamp
}

export interface TranscriptOptions {
  language?: string;
  fallbackToTranscribe?: boolean;
  includeTimestamps?: boolean;
  cleanText?: boolean;
  maxRetries?: number;
}

/**
 * Service for extracting transcripts from YouTube videos
 */
export class TranscriptService {
  private static readonly YOUTUBE_TRANSCRIPT_API = 'https://www.googleapis.com/youtube/v3/captions';
  private static readonly DEFAULT_LANGUAGE = 'en';

  /**
   * Extract transcript from YouTube video
   */
  static async extractTranscript(
    videoId: string,
    apiKey: string,
    options: TranscriptOptions = {}
  ): Promise<TranscriptData> {
    const {
      language = this.DEFAULT_LANGUAGE,
      fallbackToTranscribe = true,
      includeTimestamps = true,
      cleanText = true,
      maxRetries = 3,
    } = options;

    try {
      // First, try to get transcript from YouTube's built-in captions
      const youtubeTranscript = await this.extractFromYouTube(
        videoId,
        apiKey,
        language,
        maxRetries
      );

      if (youtubeTranscript) {
        return this.processTranscript(youtubeTranscript, {
          videoId,
          language,
          source: 'youtube',
          includeTimestamps,
          cleanText,
        });
      }

      // If YouTube transcript is not available and fallback is enabled
      if (fallbackToTranscribe) {
        const transcribeResult = await this.extractWithTranscribe(videoId, language);
        return this.processTranscript(transcribeResult, {
          videoId,
          language,
          source: 'aws-transcribe',
          includeTimestamps,
          cleanText,
        });
      }

      throw new ValidationError(
        'No transcript available for this video',
        'TRANSCRIPT_NOT_AVAILABLE'
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new Error(
        error instanceof Error
          ? `Failed to extract transcript: ${error.message}`
          : 'Failed to extract transcript'
      );
    }
  }

  /**
   * Get available transcript languages for a video
   */
  static async getAvailableLanguages(videoId: string, apiKey: string): Promise<string[]> {
    try {
      const url = new URL(this.YOUTUBE_TRANSCRIPT_API);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('videoId', videoId);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('YouTube API quota exceeded or invalid API key');
        }
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return [];
      }

      return data.items.map((item: any) => item.snippet.language);
    } catch (error) {
      console.warn('Failed to get available languages:', error);
      return [];
    }
  }

  /**
   * Check if transcript is available for a video
   */
  static async isTranscriptAvailable(videoId: string, apiKey: string): Promise<boolean> {
    try {
      const languages = await this.getAvailableLanguages(videoId, apiKey);
      return languages.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Extract transcript from YouTube's built-in captions
   */
  private static async extractFromYouTube(
    videoId: string,
    apiKey: string,
    language: string,
    maxRetries: number
  ): Promise<RawTranscriptData | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get available captions
        const captionsUrl = new URL(this.YOUTUBE_TRANSCRIPT_API);
        captionsUrl.searchParams.set('part', 'snippet');
        captionsUrl.searchParams.set('videoId', videoId);
        captionsUrl.searchParams.set('key', apiKey);

        const captionsResponse = await fetch(captionsUrl.toString());

        if (!captionsResponse.ok) {
          throw new Error(`Captions API error: ${captionsResponse.status}`);
        }

        const captionsData = await captionsResponse.json();

        if (!captionsData.items || captionsData.items.length === 0) {
          return null; // No captions available
        }

        // Find the best matching caption track
        let captionTrack = captionsData.items.find(
          (item: any) => item.snippet.language === language
        );

        // Fallback to English if requested language not available
        if (!captionTrack && language !== 'en') {
          captionTrack = captionsData.items.find(
            (item: any) => item.snippet.language === 'en'
          );
        }

        // Fallback to first available track
        if (!captionTrack) {
          captionTrack = captionsData.items[0];
        }

        // Download the caption track
        const captionUrl = new URL(this.YOUTUBE_TRANSCRIPT_API + '/' + captionTrack.id);
        captionUrl.searchParams.set('key', apiKey);
        captionUrl.searchParams.set('tfmt', 'ttml'); // Get TTML format for timing info

        const transcriptResponse = await fetch(captionUrl.toString());

        if (!transcriptResponse.ok) {
          throw new Error(`Transcript download error: ${transcriptResponse.status}`);
        }

        const transcriptXml = await transcriptResponse.text();
        return this.parseTTMLTranscript(transcriptXml, captionTrack.snippet.language);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // If all retries failed, log the error but don't throw (allow fallback)
    console.warn(`Failed to extract YouTube transcript after ${maxRetries} attempts:`, lastError);
    return null;
  }

  /**
   * Extract transcript using AWS Transcribe (fallback method)
   */
  private static async extractWithTranscribe(
    videoId: string,
    language: string
  ): Promise<RawTranscriptData> {
    // This would typically involve:
    // 1. Downloading the audio from YouTube video
    // 2. Uploading to S3
    // 3. Starting a Transcribe job
    // 4. Polling for completion
    // 5. Processing the results

    // For now, we'll simulate this process
    // In a real implementation, this would be handled by a separate Lambda function
    throw new ValidationError(
      'AWS Transcribe fallback not yet implemented',
      'TRANSCRIBE_NOT_AVAILABLE'
    );
  }

  /**
   * Parse TTML (Timed Text Markup Language) transcript format
   */
  private static parseTTMLTranscript(ttml: string, language: string): RawTranscriptData {
    const segments: TranscriptSegment[] = [];
    
    try {
      // Parse TTML XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(ttml, 'text/xml');
      
      // Extract timing and text from <p> elements
      const paragraphs = doc.querySelectorAll('p');
      
      paragraphs.forEach(p => {
        const begin = p.getAttribute('begin');
        const end = p.getAttribute('end');
        const text = p.textContent?.trim();
        
        if (begin && end && text) {
          segments.push({
            start: this.parseTimeToSeconds(begin),
            end: this.parseTimeToSeconds(end),
            text: text,
            confidence: 1.0, // YouTube captions are generally high quality
          });
        }
      });
    } catch (error) {
      // Fallback: try to parse as simple text with basic timing
      const lines = ttml.split('\n').filter(line => line.trim());
      let currentTime = 0;
      const avgWordsPerSecond = 2.5; // Approximate speaking rate
      
      lines.forEach(line => {
        const text = line.trim();
        if (text) {
          const wordCount = text.split(' ').length;
          const duration = Math.max(wordCount / avgWordsPerSecond, 1);
          
          segments.push({
            start: currentTime,
            end: currentTime + duration,
            text: text,
            confidence: 0.8, // Lower confidence for estimated timing
          });
          
          currentTime += duration;
        }
      });
    }

    return {
      segments,
      language,
      confidence: segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / segments.length,
    };
  }

  /**
   * Parse time string to seconds
   */
  private static parseTimeToSeconds(timeStr: string): number {
    // Handle various time formats: HH:MM:SS.mmm, MM:SS.mmm, SS.mmm
    const parts = timeStr.split(':');
    let seconds = 0;
    
    if (parts.length === 3) {
      // HH:MM:SS.mmm
      seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS.mmm
      seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      // SS.mmm
      seconds = parseFloat(parts[0]);
    }
    
    return Math.max(0, seconds);
  }

  /**
   * Process and clean transcript data
   */
  private static processTranscript(
    rawData: RawTranscriptData,
    options: {
      videoId: string;
      language: string;
      source: 'youtube' | 'aws-transcribe';
      includeTimestamps: boolean;
      cleanText: boolean;
    }
  ): TranscriptData {
    let segments = rawData.segments;

    // Clean text if requested
    if (options.cleanText) {
      segments = segments.map(segment => ({
        ...segment,
        text: this.cleanTranscriptText(segment.text),
      }));
    }

    // Remove empty segments
    segments = segments.filter(segment => segment.text.trim().length > 0);

    // Sort segments by start time
    segments.sort((a, b) => a.start - b.start);

    // Merge overlapping or adjacent segments if they're very close
    segments = this.mergeAdjacentSegments(segments);

    // Generate full text
    const fullText = segments.map(segment => segment.text).join(' ');

    // Calculate duration
    const duration = segments.length > 0 
      ? Math.max(...segments.map(s => s.end))
      : 0;

    return {
      videoId: options.videoId,
      language: options.language,
      segments: options.includeTimestamps ? segments : segments.map(s => ({ ...s, start: 0, end: 0 })),
      fullText,
      duration,
      source: options.source,
      confidence: rawData.confidence,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Clean transcript text
   */
  private static cleanTranscriptText(text: string): string {
    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common transcript artifacts
      .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
      .replace(/\(.*?\)/g, '') // Remove (inaudible), etc.
      // Fix common OCR/transcription errors
      .replace(/\bi\b/g, 'I') // Fix lowercase 'i'
      .replace(/\bim\b/g, "I'm") // Fix "im" -> "I'm"
      .replace(/\bdont\b/g, "don't") // Fix "dont" -> "don't"
      .replace(/\bcant\b/g, "can't") // Fix "cant" -> "can't"
      .replace(/\bwont\b/g, "won't") // Fix "wont" -> "won't"
      // Clean up punctuation
      .replace(/\s+([,.!?;:])/g, '$1') // Remove space before punctuation
      .replace(/([.!?])\s*([a-z])/g, '$1 $2') // Ensure space after sentence endings
      // Trim and clean
      .trim();
  }

  /**
   * Merge adjacent segments that are very close together
   */
  private static mergeAdjacentSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length <= 1) return segments;

    const merged: TranscriptSegment[] = [];
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      
      // If segments are very close (within 0.5 seconds) and short, merge them
      if (next.start - current.end <= 0.5 && current.text.length < 100) {
        current.end = next.end;
        current.text += ' ' + next.text;
        current.confidence = Math.min(current.confidence || 1, next.confidence || 1);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    
    merged.push(current);
    return merged;
  }

  /**
   * Search within transcript
   */
  static searchTranscript(
    transcript: TranscriptData,
    query: string,
    options: {
      caseSensitive?: boolean;
      wholeWords?: boolean;
      includeContext?: boolean;
      contextWords?: number;
    } = {}
  ): Array<{
    segment: TranscriptSegment;
    match: string;
    context?: string;
    segmentIndex: number;
  }> {
    const {
      caseSensitive = false,
      wholeWords = false,
      includeContext = true,
      contextWords = 5,
    } = options;

    const results: Array<{
      segment: TranscriptSegment;
      match: string;
      context?: string;
      segmentIndex: number;
    }> = [];

    let searchQuery = query;
    if (!caseSensitive) {
      searchQuery = searchQuery.toLowerCase();
    }

    // Create regex pattern
    let pattern = wholeWords ? `\\b${searchQuery}\\b` : searchQuery;
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

    transcript.segments.forEach((segment, index) => {
      let text = segment.text;
      if (!caseSensitive) {
        text = text.toLowerCase();
      }

      const matches = text.match(regex);
      if (matches) {
        let context = segment.text;
        
        if (includeContext) {
          // Get surrounding segments for context
          const startIndex = Math.max(0, index - contextWords);
          const endIndex = Math.min(transcript.segments.length - 1, index + contextWords);
          
          const contextSegments = transcript.segments.slice(startIndex, endIndex + 1);
          context = contextSegments.map(s => s.text).join(' ');
        }

        results.push({
          segment,
          match: matches[0],
          context,
          segmentIndex: index,
        });
      }
    });

    return results;
  }

  /**
   * Get transcript segment at specific time
   */
  static getSegmentAtTime(transcript: TranscriptData, timeInSeconds: number): TranscriptSegment | null {
    return transcript.segments.find(
      segment => timeInSeconds >= segment.start && timeInSeconds <= segment.end
    ) || null;
  }

  /**
   * Export transcript in various formats
   */
  static exportTranscript(
    transcript: TranscriptData,
    format: 'txt' | 'srt' | 'vtt' | 'json'
  ): string {
    switch (format) {
      case 'txt':
        return transcript.fullText;
      
      case 'srt':
        return this.exportToSRT(transcript);
      
      case 'vtt':
        return this.exportToVTT(transcript);
      
      case 'json':
        return JSON.stringify(transcript, null, 2);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to SRT format
   */
  private static exportToSRT(transcript: TranscriptData): string {
    return transcript.segments
      .map((segment, index) => {
        const startTime = this.formatSRTTime(segment.start);
        const endTime = this.formatSRTTime(segment.end);
        
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
      })
      .join('\n');
  }

  /**
   * Export to WebVTT format
   */
  private static exportToVTT(transcript: TranscriptData): string {
    const header = 'WEBVTT\n\n';
    const cues = transcript.segments
      .map(segment => {
        const startTime = this.formatVTTTime(segment.start);
        const endTime = this.formatVTTTime(segment.end);
        
        return `${startTime} --> ${endTime}\n${segment.text}\n`;
      })
      .join('\n');
    
    return header + cues;
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private static formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format time for WebVTT (HH:MM:SS.mmm)
   */
  private static formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}

// Internal interface for raw transcript data
interface RawTranscriptData {
  segments: TranscriptSegment[];
  language: string;
  confidence: number;
}