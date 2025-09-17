import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ExtractTranscriptRequest {
  videoId: string;
  language?: string;
  fallbackToTranscribe?: boolean;
  cleanText?: boolean;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

interface TranscriptData {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  duration: number;
  source: 'youtube' | 'aws-transcribe' | 'manual';
  confidence: number;
  extractedAt: string;
}

/**
 * Extract transcript from YouTube video
 */
async function extractTranscriptHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  try {
    const requestBody: ExtractTranscriptRequest = JSON.parse(event.body || '{}');
    
    if (!requestBody.videoId) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Video ID is required');
    }

    const {
      videoId,
      language = 'en',
      fallbackToTranscribe = true,
      cleanText = true,
    } = requestBody;

    logger.info('Extracting transcript', {
      userId,
      videoId,
      language,
      fallbackToTranscribe,
    });

    // Get YouTube API key
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      logger.error('YouTube API key not configured');
      return createErrorResponse(500, 'CONFIGURATION_ERROR', 'YouTube API not configured');
    }

    // Extract transcript
    const transcript = await extractTranscriptFromYouTube(
      videoId,
      youtubeApiKey,
      language,
      cleanText
    );

    if (!transcript) {
      if (fallbackToTranscribe) {
        // TODO: Implement AWS Transcribe fallback
        return createErrorResponse(501, 'NOT_IMPLEMENTED', 'AWS Transcribe fallback not yet implemented');
      } else {
        return createErrorResponse(404, 'TRANSCRIPT_NOT_FOUND', 'No transcript available for this video');
      }
    }

    // Store transcript in S3
    const s3Key = `transcripts/${userId}/${videoId}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
      Body: JSON.stringify(transcript),
      ContentType: 'application/json',
      Metadata: {
        userId,
        videoId,
        language: transcript.language,
        source: transcript.source,
        extractedAt: transcript.extractedAt,
      },
    }));

    // Update learning capsule with transcript information
    const capsuleUpdateResult = await updateCapsuleWithTranscript(userId, videoId, {
      transcriptS3Key: s3Key,
      transcriptLanguage: transcript.language,
      transcriptSource: transcript.source,
      transcriptConfidence: transcript.confidence,
      transcriptDuration: transcript.duration,
      transcriptSegmentCount: transcript.segments.length,
    });

    logger.info('Transcript extracted and stored successfully', {
      userId,
      videoId,
      language: transcript.language,
      source: transcript.source,
      confidence: transcript.confidence,
      segmentCount: transcript.segments.length,
      s3Key,
      capsuleUpdated: capsuleUpdateResult,
    });

    // Return transcript data (without storing full segments in response for performance)
    const response = {
      videoId: transcript.videoId,
      language: transcript.language,
      fullText: transcript.fullText,
      duration: transcript.duration,
      source: transcript.source,
      confidence: transcript.confidence,
      extractedAt: transcript.extractedAt,
      segmentCount: transcript.segments.length,
      s3Key,
      // Include first few segments as preview
      previewSegments: transcript.segments.slice(0, 5),
    };

    return createSuccessResponse(response);
  } catch (error) {
    logger.error('Transcript extraction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });

    if (error instanceof Error) {
      if (error.message.includes('quota exceeded')) {
        return createErrorResponse(503, 'QUOTA_EXCEEDED', 'YouTube API quota exceeded. Please try again later.');
      }
      
      if (error.message.includes('not found')) {
        return createErrorResponse(404, 'VIDEO_NOT_FOUND', 'Video not found or transcript not available');
      }
    }

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to extract transcript');
  }
}

/**
 * Extract transcript from YouTube's built-in captions
 */
async function extractTranscriptFromYouTube(
  videoId: string,
  apiKey: string,
  language: string,
  cleanText: boolean
): Promise<TranscriptData | null> {
  try {
    // Get available captions
    const captionsUrl = new URL('https://www.googleapis.com/youtube/v3/captions');
    captionsUrl.searchParams.set('part', 'snippet');
    captionsUrl.searchParams.set('videoId', videoId);
    captionsUrl.searchParams.set('key', apiKey);

    const captionsResponse = await fetch(captionsUrl.toString());

    if (!captionsResponse.ok) {
      if (captionsResponse.status === 403) {
        throw new Error('YouTube API quota exceeded or invalid API key');
      }
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
    const captionUrl = new URL(`https://www.googleapis.com/youtube/v3/captions/${captionTrack.id}`);
    captionUrl.searchParams.set('key', apiKey);
    captionUrl.searchParams.set('tfmt', 'ttml'); // Get TTML format for timing info

    const transcriptResponse = await fetch(captionUrl.toString());

    if (!transcriptResponse.ok) {
      throw new Error(`Transcript download error: ${transcriptResponse.status}`);
    }

    const transcriptXml = await transcriptResponse.text();
    return parseTTMLTranscript(transcriptXml, videoId, captionTrack.snippet.language, cleanText);
  } catch (error) {
    logger.error('Failed to extract YouTube transcript', {
      error: error instanceof Error ? error.message : 'Unknown error',
      videoId,
      language,
    });
    return null;
  }
}

/**
 * Parse TTML (Timed Text Markup Language) transcript format
 */
function parseTTMLTranscript(
  ttml: string,
  videoId: string,
  language: string,
  cleanText: boolean
): TranscriptData {
  const segments: TranscriptSegment[] = [];
  
  try {
    // Simple regex-based parsing for TTML (since DOMParser might not be available in Lambda)
    const pTagRegex = /<p[^>]*begin="([^"]*)"[^>]*end="([^"]*)"[^>]*>(.*?)<\/p>/gs;
    let match;

    while ((match = pTagRegex.exec(ttml)) !== null) {
      const [, begin, end, content] = match;
      
      // Clean HTML tags from content
      const text = content.replace(/<[^>]*>/g, '').trim();
      
      if (text) {
        segments.push({
          start: parseTimeToSeconds(begin),
          end: parseTimeToSeconds(end),
          text: cleanText ? cleanTranscriptText(text) : text,
          confidence: 1.0, // YouTube captions are generally high quality
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to parse TTML, falling back to simple text parsing', {
      error: error instanceof Error ? error.message : 'Unknown error',
      videoId,
    });

    // Fallback: try to parse as simple text with basic timing
    const lines = ttml.split('\n').filter(line => line.trim());
    let currentTime = 0;
    const avgWordsPerSecond = 2.5; // Approximate speaking rate
    
    lines.forEach(line => {
      const text = line.replace(/<[^>]*>/g, '').trim();
      if (text) {
        const wordCount = text.split(' ').length;
        const duration = Math.max(wordCount / avgWordsPerSecond, 1);
        
        segments.push({
          start: currentTime,
          end: currentTime + duration,
          text: cleanText ? cleanTranscriptText(text) : text,
          confidence: 0.8, // Lower confidence for estimated timing
        });
        
        currentTime += duration;
      }
    });
  }

  // Sort segments by start time
  segments.sort((a, b) => a.start - b.start);

  // Generate full text
  const fullText = segments.map(segment => segment.text).join(' ');

  // Calculate duration and confidence
  const duration = segments.length > 0 
    ? Math.max(...segments.map(s => s.end))
    : 0;
  
  const confidence = segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / segments.length;

  return {
    videoId,
    language,
    segments,
    fullText,
    duration,
    source: 'youtube',
    confidence,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Parse time string to seconds
 */
function parseTimeToSeconds(timeStr: string): number {
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
 * Clean transcript text
 */
function cleanTranscriptText(text: string): string {
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
 * Update learning capsule with transcript information
 */
async function updateCapsuleWithTranscript(
  userId: string,
  videoId: string,
  transcriptInfo: {
    transcriptS3Key: string;
    transcriptLanguage: string;
    transcriptSource: string;
    transcriptConfidence: number;
    transcriptDuration: number;
    transcriptSegmentCount: number;
  }
): Promise<boolean> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${videoId}`,
      },
      UpdateExpression: `
        SET 
          transcript = :transcript,
          #updatedAt = :updatedAt,
          processingStatus.transcript = :transcriptStatus
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':transcript': transcriptInfo,
        ':updatedAt': new Date().toISOString(),
        ':transcriptStatus': 'completed',
      },
      ConditionExpression: 'attribute_exists(PK)',
    }));

    return true;
  } catch (error) {
    logger.error('Failed to update capsule with transcript info', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      videoId,
    });
    return false;
  }
}

export const handler = createHandler(extractTranscriptHandler);