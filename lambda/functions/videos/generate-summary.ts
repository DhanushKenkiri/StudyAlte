import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import OpenAI from 'openai';
import { generateSummary, SummaryOptions, VideoMetadata } from '../../services/summary-generation';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);



interface GenerateSummaryRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoUrl: string;
  title?: string;
  options: SummaryOptions;
  transcriptResult?: {
    Payload: {
      transcript: string;
      segments?: Array<{
        text: string;
        start: number;
        duration: number;
      }>;
      language?: string;
    };
  };
  validationResult?: {
    Payload: {
      metadata: {
        title: string;
        description: string;
        duration: number;
        channelTitle: string;
        tags: string[];
      };
    };
  };
}

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  topics: string[];
  readingTime: number;
  confidence: number;
  language: string;
  comprehendAnalysis?: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    sentiment: string;
    qualityScore: number;
  };
  qualityValidation?: {
    isValid: boolean;
    overall: number;
    issues: string[];
    recommendations: string[];
  };
}

/**
 * Generate intelligent summary from video transcript using OpenAI GPT-4
 */
async function generateSummaryHandler(event: GenerateSummaryRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, validationResult } = event;

  try {
    logger.info('Starting summary generation', {
      userId,
      capsuleId,
      videoId,
      options,
      hasTranscript: !!transcriptResult?.Payload?.transcript,
      hasMetadata: !!validationResult?.Payload?.metadata,
    });

    // Get transcript text
    let transcriptText = transcriptResult?.Payload?.transcript;
    
    // If no transcript from previous step, try to get it from the database
    if (!transcriptText) {
      const capsule = await docClient.send(new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Key: {
          PK: `USER#${userId}`,
          SK: `CAPSULE#${capsuleId}`,
        },
      }));

      if (capsule.Item?.learningContent?.transcript?.text) {
        transcriptText = capsule.Item.learningContent.transcript.text;
      }
    }

    if (!transcriptText) {
      throw new Error('No transcript available for summary generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoTitle = metadata?.title || event.title || 'Unknown Video';
    const videoDescription = metadata?.description || '';
    const channelTitle = metadata?.channelTitle || '';
    const duration = metadata?.duration || 0;

    // Analyze transcript with AWS Comprehend for additional insights
    const comprehendAnalysis = await analyzeTextWithComprehend(transcriptText, options.language || 'en');
    
    // Generate summary using OpenAI
    const summaryResult = await generateSummaryWithOpenAI(
      transcriptText,
      {
        title: videoTitle,
        description: videoDescription,
        channelTitle,
        duration,
      },
      options,
      comprehendAnalysis
    );

    // Store summary in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.summary = :summary,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':summary': {
          ...summaryResult,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Summary generated successfully', {
      userId,
      capsuleId,
      videoId,
      summaryLength: summaryResult.summary.length,
      keyPointsCount: summaryResult.keyPoints.length,
      topicsCount: summaryResult.topics.length,
      confidence: summaryResult.confidence,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        summary: summaryResult,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate summary', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      videoId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Generate summary using OpenAI GPT-4
 */
async function generateSummaryWithOpenAI(
  transcript: string,
  metadata: {
    title: string;
    description: string;
    channelTitle: string;
    duration: number;
  },
  options: GenerateSummaryRequest['options'],
  comprehendAnalysis?: any
): Promise<SummaryResult> {
  const { language = 'en', summaryLength = 'medium', includeKeyPoints = true, includeTopics = true } = options;

  // Determine summary length parameters
  const lengthParams = {
    short: { words: 150, sentences: '3-5' },
    medium: { words: 300, sentences: '5-8' },
    long: { words: 500, sentences: '8-12' },
  };

  const targetLength = lengthParams[summaryLength];

  // Extract insights from Comprehend analysis
  let comprehendInsights = '';
  if (comprehendAnalysis) {
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 10);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);
    const qualityScore = calculateContentQuality(comprehendAnalysis);
    
    comprehendInsights = `
Additional Context from Content Analysis:
- Key Phrases: ${topKeyPhrases.join(', ')}
- Important Entities: ${Object.entries(entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
- Content Sentiment: ${comprehendAnalysis.sentiment.sentiment}
- Content Quality Score: ${qualityScore.score.toFixed(2)}
`;
  }

  // Build the prompt
  const prompt = `
You are an expert educational content summarizer. Please analyze the following video transcript and create a comprehensive learning summary.

Video Information:
- Title: ${metadata.title}
- Channel: ${metadata.channelTitle}
- Duration: ${Math.round(metadata.duration / 60)} minutes
- Description: ${metadata.description.substring(0, 200)}...

Transcript:
${transcript.substring(0, 8000)} ${transcript.length > 8000 ? '...' : ''}

${comprehendInsights}

Please provide a response in the following JSON format:
{
  "summary": "A ${summaryLength} summary in approximately ${targetLength.words} words that captures the main concepts, key insights, and learning objectives. Write ${targetLength.sentences} clear, informative sentences.",
  "keyPoints": ["Array of 5-8 key learning points or takeaways from the video"],
  "topics": ["Array of 3-6 main topics or subjects covered"],
  "confidence": 0.95
}

Requirements:
- Write in ${language === 'en' ? 'English' : language}
- Focus on educational value and learning outcomes
- Use clear, concise language suitable for study notes
- Ensure the summary is self-contained and informative
- Extract actionable insights and key concepts
- Maintain factual accuracy based on the transcript content
${includeKeyPoints ? '- Include specific, actionable key points' : ''}
${includeTopics ? '- Identify and categorize main topics covered' : ''}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content summarizer. Always respond with valid JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseContent);

    // Validate and clean the response
    const summaryResult: SummaryResult = {
      summary: result.summary || '',
      keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
      topics: Array.isArray(result.topics) ? result.topics : [],
      readingTime: Math.ceil(result.summary?.split(' ').length / 200) || 1, // Approximate reading time
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8,
      language: language,
    };

    // Add Comprehend analysis if available
    if (comprehendAnalysis) {
      const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 15);
      const entities = extractEntitiesByType(comprehendAnalysis.entities);
      const qualityScore = calculateContentQuality(comprehendAnalysis);
      
      summaryResult.comprehendAnalysis = {
        keyPhrases: topKeyPhrases,
        entities,
        sentiment: comprehendAnalysis.sentiment.sentiment,
        qualityScore: qualityScore.score,
      };
    }

    // Validate and improve summary quality
    const qualityValidation = validateSummaryQuality(
      summaryResult.summary,
      transcript,
      summaryResult.keyPoints,
      summaryResult.topics
    );

    // Improve summary if quality is low
    if (!qualityValidation.isValid || qualityValidation.quality.overall < 0.7) {
      summaryResult.summary = improveSummaryQuality(summaryResult.summary, qualityValidation);
      
      // Adjust confidence based on quality
      summaryResult.confidence = Math.min(summaryResult.confidence, qualityValidation.quality.overall + 0.2);
    }

    summaryResult.qualityValidation = {
      isValid: qualityValidation.isValid,
      overall: qualityValidation.quality.overall,
      issues: qualityValidation.issues,
      recommendations: qualityValidation.recommendations,
    };

    // Validate required fields
    if (!summaryResult.summary) {
      throw new Error('Generated summary is empty');
    }

    if (summaryResult.keyPoints.length === 0 && includeKeyPoints) {
      logger.warn('No key points generated', { transcript: transcript.substring(0, 100) });
    }

    if (summaryResult.topics.length === 0 && includeTopics) {
      logger.warn('No topics generated', { transcript: transcript.substring(0, 100) });
    }

    return summaryResult;
  } catch (error) {
    logger.error('OpenAI API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      transcriptLength: transcript.length,
      options,
    });

    // Fallback to basic summary if OpenAI fails
    return generateFallbackSummary(transcript, metadata, options);
  }
}

/**
 * Generate a basic fallback summary if OpenAI fails
 */
function generateFallbackSummary(
  transcript: string,
  metadata: { title: string; description: string },
  options: GenerateSummaryRequest['options']
): SummaryResult {
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const words = transcript.split(/\s+/);
  
  // Extract key sentences (first, middle, and last portions)
  const keyIndices = [
    0,
    Math.floor(sentences.length * 0.3),
    Math.floor(sentences.length * 0.6),
    sentences.length - 1,
  ].filter(i => i < sentences.length);

  const keySentences = keyIndices.map(i => sentences[i]?.trim()).filter(Boolean);
  
  const summary = `This video titled "${metadata.title}" covers the following content: ${keySentences.join(' ')}`;

  // Basic key points extraction
  const keyPoints = sentences
    .filter(s => s.includes('important') || s.includes('key') || s.includes('main'))
    .slice(0, 5)
    .map(s => s.trim());

  // Basic topic extraction from title and description
  const topics = [
    ...metadata.title.split(/[\s,]+/).filter(word => word.length > 4),
    ...metadata.description.split(/[\s,]+/).filter(word => word.length > 4),
  ].slice(0, 6);

  return {
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : ['Key concepts from the video content'],
    topics: topics.length > 0 ? topics : ['General topic'],
    readingTime: Math.ceil(summary.split(' ').length / 200),
    confidence: 0.6, // Lower confidence for fallback
    language: options.language || 'en',
  };
}

// Export handler
export const handler = createHandler(generateSummaryHandler);}


/**
 * Generate intelligent summary from video content
 */
async function generateSummaryHandler(event: GenerateSummaryRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, validationResult } = event;

  try {
    logger.info('Starting summary generation', {
      userId,
      capsuleId,
      videoId,
      options,
      hasTranscript: !!transcriptResult?.Payload?.transcript,
    });

    // Get transcript content
    const transcript = transcriptResult?.Payload?.transcript || '';
    
    // If no transcript available, try to get from database
    let transcriptContent = transcript;
    if (!transcriptContent) {
      transcriptContent = await getTranscriptFromDatabase(userId, capsuleId);
    }

    if (!transcriptContent) {
      throw new Error('No transcript available for summary generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoMetadata: VideoMetadata = {
      title: metadata?.title || event.title || 'Unknown Video',
      description: metadata?.description || '',
      duration: metadata?.duration || 0,
      channelTitle: metadata?.channelTitle || '',
      tags: metadata?.tags || [],
    };

    // Generate summary using the service
    const summaryResult = await generateSummary(
      transcriptContent,
      videoMetadata,
      options
    );

    // Store summary in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.summary = :summary,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':summary': {
          ...summaryResult,
          generatedAt: new Date().toISOString(),
          videoTitle: videoMetadata.title,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Summary generated successfully', {
      userId,
      capsuleId,
      videoId,
      summaryLength: summaryResult.summary.length,
      keyPointsCount: summaryResult.keyPoints.length,
      topicsCount: summaryResult.topics.length,
      difficulty: summaryResult.difficulty,
      qualityScore: summaryResult.quality.overallScore,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        summary: summaryResult,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate summary', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      videoId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Get transcript from database if not provided in event
 */
async function getTranscriptFromDatabase(userId: string, capsuleId: string): Promise<string> {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  const item = result.Item;
  return item?.learningContent?.transcript?.text || '';
}

export const handler = createHandler(generateSummaryHandler);