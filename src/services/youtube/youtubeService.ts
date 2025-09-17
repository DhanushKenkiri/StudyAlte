import { ValidationError } from '../../types/errors';

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnail: {
    default: string;
    medium: string;
    high: string;
    standard?: string;
    maxres?: string;
  };
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  tags: string[];
  categoryId: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  liveBroadcastContent: 'none' | 'upcoming' | 'live';
  embeddable: boolean;
  publicStatsViewable: boolean;
}

export interface YouTubeApiResponse {
  kind: string;
  etag: string;
  items: YouTubeApiItem[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeApiItem {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
      standard?: { url: string; width: number; height: number };
      maxres?: { url: string; width: number; height: number };
    };
    channelTitle: string;
    tags?: string[];
    categoryId: string;
    liveBroadcastContent: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  contentDetails: {
    duration: string; // ISO 8601 format (PT4M13S)
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: boolean;
    regionRestriction?: {
      allowed?: string[];
      blocked?: string[];
    };
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
    dislikeCount?: string;
    favoriteCount?: string;
    commentCount?: string;
  };
  status: {
    uploadStatus: string;
    privacyStatus: string;
    license: string;
    embeddable: boolean;
    publicStatsViewable: boolean;
    madeForKids: boolean;
  };
}

/**
 * YouTube Service for video metadata extraction and validation
 */
export class YouTubeService {
  private static readonly API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private static readonly VIDEO_URL_PATTERNS = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
  ];

  /**
   * Validate YouTube URL format
   */
  static validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    return this.VIDEO_URL_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Extract video ID from YouTube URL
   */
  static extractVideoId(url: string): string {
    if (!this.validateUrl(url)) {
      throw new ValidationError('Invalid YouTube URL format', 'INVALID_URL');
    }

    for (const pattern of this.VIDEO_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new ValidationError('Could not extract video ID from URL', 'INVALID_URL');
  }

  /**
   * Get video metadata from YouTube API
   */
  static async getVideoMetadata(videoId: string, apiKey: string): Promise<YouTubeVideoMetadata> {
    if (!apiKey) {
      throw new Error('YouTube API key is required');
    }

    try {
      const url = new URL(`${this.API_BASE_URL}/videos`);
      url.searchParams.set('part', 'snippet,contentDetails,statistics,status');
      url.searchParams.set('id', videoId);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('YouTube API quota exceeded or invalid API key');
        }
        if (response.status === 404) {
          throw new ValidationError('Video not found', 'VIDEO_NOT_FOUND');
        }
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data: YouTubeApiResponse = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new ValidationError('Video not found or is private', 'VIDEO_NOT_FOUND');
      }

      const video = data.items[0];
      
      // Check if video is available for processing
      if (video.status.privacyStatus !== 'public') {
        throw new ValidationError('Video must be public to process', 'VIDEO_NOT_PUBLIC');
      }

      if (!video.status.embeddable) {
        throw new ValidationError('Video embedding is disabled', 'VIDEO_NOT_EMBEDDABLE');
      }

      return this.transformApiResponse(video);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new Error(
        error instanceof Error 
          ? `Failed to fetch video metadata: ${error.message}`
          : 'Failed to fetch video metadata'
      );
    }
  }

  /**
   * Get video metadata from URL
   */
  static async getVideoMetadataFromUrl(url: string, apiKey: string): Promise<YouTubeVideoMetadata> {
    const videoId = this.extractVideoId(url);
    return this.getVideoMetadata(videoId, apiKey);
  }

  /**
   * Check if video has captions/subtitles available
   */
  static async hasSubtitles(videoId: string, apiKey: string): Promise<boolean> {
    try {
      const url = new URL(`${this.API_BASE_URL}/captions`);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('videoId', videoId);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        return false; // Assume no subtitles if we can't check
      }

      const data = await response.json();
      return data.items && data.items.length > 0;
    } catch {
      return false; // Assume no subtitles on error
    }
  }

  /**
   * Get available subtitle languages
   */
  static async getSubtitleLanguages(videoId: string, apiKey: string): Promise<string[]> {
    try {
      const url = new URL(`${this.API_BASE_URL}/captions`);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('videoId', videoId);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      if (!data.items) {
        return [];
      }

      return data.items.map((item: any) => item.snippet.language);
    } catch {
      return [];
    }
  }

  /**
   * Validate video for processing
   */
  static async validateVideoForProcessing(
    url: string, 
    apiKey: string
  ): Promise<{ valid: boolean; metadata?: YouTubeVideoMetadata; error?: string }> {
    try {
      // Extract and validate video ID
      const videoId = this.extractVideoId(url);
      
      // Get metadata
      const metadata = await this.getVideoMetadata(videoId, apiKey);
      
      // Additional validation checks
      const validationErrors: string[] = [];
      
      // Check video duration (max 4 hours for processing efficiency)
      if (metadata.duration > 14400) { // 4 hours in seconds
        validationErrors.push('Video is too long (maximum 4 hours)');
      }
      
      // Check if video is too short (minimum 30 seconds)
      if (metadata.duration < 30) {
        validationErrors.push('Video is too short (minimum 30 seconds)');
      }
      
      // Check if video is live content
      if (metadata.liveBroadcastContent !== 'none') {
        validationErrors.push('Live streams cannot be processed');
      }
      
      if (validationErrors.length > 0) {
        return {
          valid: false,
          error: validationErrors.join(', '),
        };
      }
      
      return {
        valid: true,
        metadata,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Transform YouTube API response to our metadata format
   */
  private static transformApiResponse(video: YouTubeApiItem): YouTubeVideoMetadata {
    return {
      videoId: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      duration: this.parseDuration(video.contentDetails.duration),
      thumbnail: {
        default: video.snippet.thumbnails.default.url,
        medium: video.snippet.thumbnails.medium.url,
        high: video.snippet.thumbnails.high.url,
        standard: video.snippet.thumbnails.standard?.url,
        maxres: video.snippet.thumbnails.maxres?.url,
      },
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      viewCount: parseInt(video.statistics.viewCount, 10),
      likeCount: video.statistics.likeCount ? parseInt(video.statistics.likeCount, 10) : undefined,
      commentCount: video.statistics.commentCount ? parseInt(video.statistics.commentCount, 10) : undefined,
      tags: video.snippet.tags || [],
      categoryId: video.snippet.categoryId,
      defaultLanguage: video.snippet.defaultLanguage,
      defaultAudioLanguage: video.snippet.defaultAudioLanguage,
      liveBroadcastContent: video.snippet.liveBroadcastContent as 'none' | 'upcoming' | 'live',
      embeddable: video.status.embeddable,
      publicStatsViewable: video.status.publicStatsViewable,
    };
  }

  /**
   * Parse ISO 8601 duration format (PT4M13S) to seconds
   */
  private static parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) {
      return 0;
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format duration in seconds to human-readable format
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Generate thumbnail URL for specific size
   */
  static getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'high'): string {
    const qualityMap = {
      default: 'default',
      medium: 'mqdefault',
      high: 'hqdefault',
      standard: 'sddefault',
      maxres: 'maxresdefault',
    };

    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
  }
}