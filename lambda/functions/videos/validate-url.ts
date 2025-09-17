import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';
import { validateYouTubeUrl, extractYouTubeVideoId } from '../../shared/validation';

interface ValidateUrlRequest {
  videoUrl: string;
}

interface ValidateUrlResponse {
  valid: boolean;
  videoId?: string;
  metadata?: YouTubeVideoMetadata;
  error?: string;
  warnings?: string[];
}

interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: number;
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

/**
 * Validate YouTube URL and extract metadata
 */
async function validateUrlHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  try {
    const requestBody: ValidateUrlRequest = JSON.parse(event.body || '{}');
    
    if (!requestBody.videoUrl) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Video URL is required');
    }

    logger.info('Validating YouTube URL', {
      userId,
      videoUrl: requestBody.videoUrl,
    });

    // Step 1: Basic URL format validation
    if (!validateYouTubeUrl(requestBody.videoUrl)) {
      return createSuccessResponse({
        valid: false,
        error: 'Invalid YouTube URL format. Please provide a valid YouTube video URL.',
      });
    }

    // Step 2: Extract video ID
    let videoId: string;
    try {
      videoId = extractYouTubeVideoId(requestBody.videoUrl);
      if (!videoId) {
        throw new Error('Could not extract video ID');
      }
    } catch (error) {
      return createSuccessResponse({
        valid: false,
        error: 'Could not extract video ID from URL. Please check the URL format.',
      });
    }

    // Step 3: Fetch metadata from YouTube API
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      logger.error('YouTube API key not configured');
      return createErrorResponse(500, 'CONFIGURATION_ERROR', 'YouTube API not configured');
    }

    let metadata: YouTubeVideoMetadata;
    try {
      metadata = await fetchVideoMetadata(videoId, apiKey);
    } catch (error) {
      logger.error('Failed to fetch video metadata', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId,
        userId,
      });

      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('private')) {
          return createSuccessResponse({
            valid: false,
            videoId,
            error: 'Video not found or is private. Please ensure the video is public and accessible.',
          });
        }
        
        if (error.message.includes('quota exceeded')) {
          return createErrorResponse(503, 'QUOTA_EXCEEDED', 'YouTube API quota exceeded. Please try again later.');
        }
      }

      return createErrorResponse(500, 'API_ERROR', 'Failed to validate video. Please try again.');
    }

    // Step 4: Validate video for processing
    const validationResult = validateVideoForProcessing(metadata);
    
    if (!validationResult.valid) {
      return createSuccessResponse({
        valid: false,
        videoId,
        metadata,
        error: validationResult.error,
        warnings: validationResult.warnings,
      });
    }

    logger.info('Video validation successful', {
      userId,
      videoId,
      title: metadata.title,
      duration: metadata.duration,
      channelTitle: metadata.channelTitle,
    });

    const response: ValidateUrlResponse = {
      valid: true,
      videoId,
      metadata,
      warnings: validationResult.warnings,
    };

    return createSuccessResponse(response);
  } catch (error) {
    logger.error('Video URL validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to validate video URL');
  }
}

/**
 * Fetch video metadata from YouTube API
 */
async function fetchVideoMetadata(videoId: string, apiKey: string): Promise<YouTubeVideoMetadata> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails,statistics,status');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('YouTube API quota exceeded or invalid API key');
    }
    if (response.status === 404) {
      throw new Error('Video not found');
    }
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found or is private');
  }

  const video = data.items[0];
  
  // Check if video is available for processing
  if (video.status.privacyStatus !== 'public') {
    throw new Error('Video must be public to process');
  }

  if (!video.status.embeddable) {
    throw new Error('Video embedding is disabled');
  }

  return {
    videoId: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    duration: parseDuration(video.contentDetails.duration),
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
 * Validate video for processing
 */
function validateVideoForProcessing(metadata: YouTubeVideoMetadata): {
  valid: boolean;
  error?: string;
  warnings?: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check video duration (max 4 hours for processing efficiency)
  if (metadata.duration > 14400) { // 4 hours in seconds
    errors.push('Video is too long (maximum 4 hours)');
  }
  
  // Check if video is too short (minimum 30 seconds)
  if (metadata.duration < 30) {
    errors.push('Video is too short (minimum 30 seconds)');
  }
  
  // Check if video is live content
  if (metadata.liveBroadcastContent !== 'none') {
    errors.push('Live streams cannot be processed');
  }

  // Warnings for potential issues
  if (metadata.duration > 7200) { // 2 hours
    warnings.push('Long videos may take more time to process');
  }

  if (!metadata.defaultLanguage || metadata.defaultLanguage !== 'en') {
    warnings.push('Non-English videos may have limited AI processing capabilities');
  }

  if (metadata.tags.length === 0) {
    warnings.push('Video has no tags, which may affect content categorization');
  }

  if (metadata.viewCount < 1000) {
    warnings.push('Low view count videos may have limited metadata');
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join(', ') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Parse ISO 8601 duration format (PT4M13S) to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) {
    return 0;
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

export const handler = createHandler(validateUrlHandler);