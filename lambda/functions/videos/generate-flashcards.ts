import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import OpenAI from 'openai';
import { generateFlashcards, FlashcardOptions, VideoMetadata } from '../../services/flashcard-generation';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);



interface GenerateFlashcardsRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoUrl: string;
  title?: string;
  options: FlashcardOptions;
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
  summaryResult?: {
    Payload: {
      summary: string;
      keyPoints: string[];
      topics: string[];
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

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'definition' | 'concept' | 'example' | 'process' | 'comparison';
  tags: string[];
  confidence: number;
  spacedRepetition: {
    interval: number;
    repetition: number;
    easeFactor: number;
    nextReview: string;
    lastReviewed?: string;
  };
  qualityScore: number;
  sourceSegment?: {
    start: number;
    end: number;
    text: string;
  };
}

interface FlashcardsResult {
  flashcards: Flashcard[];
  totalCount: number;
  categories: string[];
  difficultyDistribution: Record<string, number>;
  averageQuality: number;
  spacedRepetitionSchedule: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

/**
 * Generate intelligent flashcards from video content using AI
 */
async function generateFlashcardsHandler(event: GenerateFlashcardsRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting flashcard generation', {
      userId,
      capsuleId,
      videoId,
      options,
      hasTranscript: !!transcriptResult?.Payload?.transcript,
      hasSummary: !!summaryResult?.Payload?.summary,
    });

    // Get content sources
    const transcript = transcriptResult?.Payload?.transcript || '';
    const summary = summaryResult?.Payload?.summary || '';
    const keyPoints = summaryResult?.Payload?.keyPoints || [];
    const topics = summaryResult?.Payload?.topics || [];

    // If no content available, try to get from database
    let contentSources = { transcript, summary, keyPoints, topics };
    if (!transcript && !summary) {
      contentSources = await getContentFromDatabase(userId, capsuleId);
    }

    if (!contentSources.transcript && !contentSources.summary) {
      throw new Error('No content available for flashcard generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoTitle = metadata?.title || event.title || 'Unknown Video';

    // Analyze content with Comprehend for additional insights
    const comprehendAnalysis = await analyzeTextWithComprehend(
      contentSources.transcript || contentSources.summary,
      options.language || 'en'
    );

    // Generate flashcards using OpenAI
    const flashcardsResult = await generateFlashcardsWithOpenAI(
      contentSources,
      {
        title: videoTitle,
        description: metadata?.description || '',
        channelTitle: metadata?.channelTitle || '',
        duration: metadata?.duration || 0,
      },
      options,
      comprehendAnalysis,
      transcriptResult?.Payload?.segments
    );

    // Store flashcards in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.flashcards = :flashcards,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':flashcards': {
          ...flashcardsResult,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Flashcards generated successfully', {
      userId,
      capsuleId,
      videoId,
      totalCards: flashcardsResult.totalCount,
      categories: flashcardsResult.categories,
      averageQuality: flashcardsResult.averageQuality,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        flashcards: flashcardsResult,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate flashcards', {
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
 * Generate flashcards using OpenAI GPT-4
 */
async function generateFlashcardsWithOpenAI(
  content: {
    transcript: string;
    summary: string;
    keyPoints: string[];
    topics: string[];
  },
  metadata: {
    title: string;
    description: string;
    channelTitle: string;
    duration: number;
  },
  options: GenerateFlashcardsRequest['options'],
  comprehendAnalysis?: any,
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<FlashcardsResult> {
  const {
    language = 'en',
    cardCount = 20,
    difficulty = 'mixed',
    categories = [],
    includeDefinitions = true,
    includeExamples = true,
    includeConceptual = true,
  } = options;

  // Extract insights from Comprehend analysis
  let comprehendInsights = '';
  if (comprehendAnalysis) {
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 15);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);
    
    comprehendInsights = `
Key Concepts Identified:
- Important Terms: ${topKeyPhrases.join(', ')}
- Named Entities: ${Object.entries(entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
`;
  }

  // Build the prompt
  const prompt = `
You are an expert educational content creator specializing in creating effective flashcards for learning. Create high-quality flashcards from the following video content.

Video Information:
- Title: ${metadata.title}
- Channel: ${metadata.channelTitle}
- Duration: ${Math.round(metadata.duration / 60)} minutes

Content Summary:
${content.summary}

Key Points:
${content.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Main Topics:
${content.topics.join(', ')}

${comprehendInsights}

Full Transcript (for reference):
${content.transcript.substring(0, 6000)}${content.transcript.length > 6000 ? '...' : ''}

Please create ${cardCount} flashcards in the following JSON format:
{
  "flashcards": [
    {
      "front": "Question or term to be learned",
      "back": "Answer or definition with clear explanation",
      "category": "Category name (e.g., 'Definitions', 'Concepts', 'Examples', 'Processes')",
      "difficulty": "easy|medium|hard",
      "type": "definition|concept|example|process|comparison",
      "tags": ["relevant", "tags", "for", "organization"],
      "confidence": 0.95
    }
  ]
}

Requirements:
- Write in ${language === 'en' ? 'English' : language}
- Target difficulty: ${difficulty === 'mixed' ? 'Mix of easy (30%), medium (50%), hard (20%)' : difficulty}
- Card types to include: ${[
    includeDefinitions && 'Definitions',
    includeExamples && 'Examples', 
    includeConceptual && 'Conceptual understanding'
  ].filter(Boolean).join(', ')}
${categories.length > 0 ? `- Focus on these categories: ${categories.join(', ')}` : ''}
- Front side: Clear, concise question or term (max 100 characters)
- Back side: Comprehensive answer with explanation (max 300 characters)
- Ensure each card tests a single, specific concept
- Make cards progressively build understanding
- Include practical applications where relevant
- Confidence score should reflect how well the card tests the concept (0.0-1.0)
- Categories should be logical groupings of related concepts
- Tags should help with organization and review
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content creator. Always respond with valid JSON format containing well-structured flashcards.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4, // Slightly higher for creativity in card creation
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseContent);
    const rawFlashcards = result.flashcards || [];

    // Process and enhance flashcards
    const processedFlashcards = await processFlashcards(
      rawFlashcards,
      segments,
      options
    );

    // Validate and improve flashcard quality
    const validationResult = validateFlashcardCollection(processedFlashcards);
    
    // Use only valid cards and improve low-quality ones
    const finalFlashcards = validationResult.validCards.map(card => {
      if (card.qualityAssessment.category === 'fair' || card.qualityAssessment.category === 'poor') {
        return improveFlashcard(card, card.qualityAssessment);
      }
      return card;
    });

    // Calculate statistics
    const categories = [...new Set(finalFlashcards.map(card => card.category))];
    const difficultyDistribution = finalFlashcards.reduce((acc, card) => {
      acc[card.difficulty] = (acc[card.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageQuality = validationResult.averageQuality;

    // Calculate spaced repetition schedule
    const spacedRepetitionSchedule = calculateInitialSchedule(finalFlashcards);

    return {
      flashcards: finalFlashcards,
      totalCount: finalFlashcards.length,
      categories,
      difficultyDistribution,
      averageQuality,
      spacedRepetitionSchedule,
      qualityValidation: {
        totalGenerated: rawFlashcards.length,
        validCards: validationResult.validCards.length,
        invalidCards: validationResult.invalidCards.length,
        qualityDistribution: validationResult.qualityDistribution,
        recommendations: validationResult.recommendations,
      },
    };
  } catch (error) {
    logger.error('OpenAI flashcard generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.transcript.length + content.summary.length,
      options,
    });

    // Fallback to basic flashcard generation
    return generateFallbackFlashcards(content, metadata, options);
  }
}

/**
 * Process and enhance raw flashcards from OpenAI
 */
async function processFlashcards(
  rawFlashcards: any[],
  segments?: Array<{ text: string; start: number; duration: number }>,
  options?: GenerateFlashcardsRequest['options']
): Promise<Flashcard[]> {
  const processedCards: Flashcard[] = [];

  for (let i = 0; i < rawFlashcards.length; i++) {
    const rawCard = rawFlashcards[i];
    
    // Validate required fields
    if (!rawCard.front || !rawCard.back) {
      logger.warn('Skipping invalid flashcard', { index: i, card: rawCard });
      continue;
    }

    // Generate unique ID
    const cardId = `card_${Date.now()}_${i}`;

    // Find source segment if available
    const sourceSegment = findSourceSegment(rawCard.front + ' ' + rawCard.back, segments);

    // Calculate quality score
    const qualityScore = calculateFlashcardQuality(rawCard);

    // Initialize spaced repetition
    const spacedRepetition = initializeSpacedRepetition(rawCard.difficulty || 'medium');

    const processedCard: Flashcard = {
      id: cardId,
      front: rawCard.front.trim(),
      back: rawCard.back.trim(),
      category: rawCard.category || 'General',
      difficulty: rawCard.difficulty || 'medium',
      type: rawCard.type || 'concept',
      tags: Array.isArray(rawCard.tags) ? rawCard.tags : [],
      confidence: typeof rawCard.confidence === 'number' ? rawCard.confidence : 0.8,
      spacedRepetition,
      qualityScore,
      sourceSegment,
    };

    processedCards.push(processedCard);
  }

  return processedCards;
}

/**
 * Find the source segment in transcript that relates to the flashcard
 */
function findSourceSegment(
  cardContent: string,
  segments?: Array<{ text: string; start: number; duration: number }>
): Flashcard['sourceSegment'] {
  if (!segments || segments.length === 0) return undefined;

  const cardWords = cardContent.toLowerCase().split(/\s+/);
  let bestMatch = { segment: segments[0], score: 0 };

  for (const segment of segments) {
    const segmentWords = segment.text.toLowerCase().split(/\s+/);
    const commonWords = cardWords.filter(word => 
      word.length > 3 && segmentWords.includes(word)
    );
    const score = commonWords.length / Math.max(cardWords.length, segmentWords.length);

    if (score > bestMatch.score) {
      bestMatch = { segment, score };
    }
  }

  if (bestMatch.score > 0.1) {
    return {
      start: bestMatch.segment.start,
      end: bestMatch.segment.start + bestMatch.segment.duration,
      text: bestMatch.segment.text,
    };
  }

  return undefined;
}

/**
 * Calculate quality score for a flashcard
 */
function calculateFlashcardQuality(card: any): number {
  let score = 0.5; // Base score

  // Front side quality (clear, concise question)
  const frontLength = card.front?.length || 0;
  if (frontLength >= 10 && frontLength <= 100) score += 0.2;
  if (card.front?.includes('?') || card.front?.includes('What') || card.front?.includes('How')) score += 0.1;

  // Back side quality (comprehensive answer)
  const backLength = card.back?.length || 0;
  if (backLength >= 20 && backLength <= 300) score += 0.2;
  if (card.back?.includes('because') || card.back?.includes('example') || card.back?.includes('means')) score += 0.1;

  // Category and type appropriateness
  if (card.category && card.category !== 'General') score += 0.1;
  if (card.type && ['definition', 'concept', 'example', 'process', 'comparison'].includes(card.type)) score += 0.1;

  // Tags quality
  if (Array.isArray(card.tags) && card.tags.length > 0 && card.tags.length <= 5) score += 0.1;

  return Math.min(1.0, score);
}

/**
 * Initialize spaced repetition parameters for a new flashcard
 */
function initializeSpacedRepetition(difficulty: string): Flashcard['spacedRepetition'] {
  // Initial intervals based on difficulty (in days)
  const initialIntervals = {
    easy: 4,
    medium: 1,
    hard: 1,
  };

  const interval = initialIntervals[difficulty as keyof typeof initialIntervals] || 1;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    interval,
    repetition: 0,
    easeFactor: 2.5, // Standard SM-2 algorithm starting value
    nextReview: nextReview.toISOString(),
  };
}

/**
 * Calculate initial spaced repetition schedule
 */
function calculateInitialSchedule(flashcards: Flashcard[]): FlashcardsResult['spacedRepetitionSchedule'] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() + 7);
  const thisMonth = new Date(today);
  thisMonth.setMonth(thisMonth.getMonth() + 1);

  let todayCount = 0;
  let thisWeekCount = 0;
  let thisMonthCount = 0;

  flashcards.forEach(card => {
    const reviewDate = new Date(card.spacedRepetition.nextReview);
    
    if (reviewDate <= today) {
      todayCount++;
    } else if (reviewDate <= thisWeek) {
      thisWeekCount++;
    } else if (reviewDate <= thisMonth) {
      thisMonthCount++;
    }
  });

  return {
    today: todayCount,
    thisWeek: thisWeekCount,
    thisMonth: thisMonthCount,
  };
}

/**
 * Get content from database if not provided in event
 */
async function getContentFromDatabase(userId: string, capsuleId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  const item = result.Item;
  return {
    transcript: item?.learningContent?.transcript?.text || '',
    summary: item?.learningContent?.summary?.summary || '',
    keyPoints: item?.learningContent?.summary?.keyPoints || [],
    topics: item?.learningContent?.summary?.topics || [],
  };
}

/**
 * Generate basic fallback flashcards if OpenAI fails
 */
function generateFallbackFlashcards(
  content: { transcript: string; summary: string; keyPoints: string[]; topics: string[] },
  metadata: { title: string; description: string },
  options: GenerateFlashcardsRequest['options']
): FlashcardsResult {
  const fallbackCards: Flashcard[] = [];
  
  // Create cards from key points
  content.keyPoints.forEach((point, index) => {
    if (index < (options.cardCount || 20)) {
      const card: Flashcard = {
        id: `fallback_${index}`,
        front: `What is the key concept: ${point.substring(0, 50)}...?`,
        back: point,
        category: 'Key Concepts',
        difficulty: 'medium',
        type: 'concept',
        tags: ['key-point'],
        confidence: 0.6,
        spacedRepetition: initializeSpacedRepetition('medium'),
        qualityScore: 0.6,
      };
      fallbackCards.push(card);
    }
  });

  // Create cards from topics
  content.topics.forEach((topic, index) => {
    if (fallbackCards.length < (options.cardCount || 20)) {
      const card: Flashcard = {
        id: `fallback_topic_${index}`,
        front: `What is ${topic}?`,
        back: `${topic} is a main topic covered in "${metadata.title}"`,
        category: 'Topics',
        difficulty: 'easy',
        type: 'definition',
        tags: ['topic'],
        confidence: 0.5,
        spacedRepetition: initializeSpacedRepetition('easy'),
        qualityScore: 0.5,
      };
      fallbackCards.push(card);
    }
  });

  return {
    flashcards: fallbackCards,
    totalCount: fallbackCards.length,
    categories: ['Key Concepts', 'Topics'],
    difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
    averageQuality: 0.55,
    spacedRepetitionSchedule: calculateInitialSchedule(fallbackCards),
  };
}

// Export handler
export const handler = createHandler(generateFlashcardsHandler); 
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

/**
 * Generate flashcards from video content
 */
async function generateFlashcardsHandler(event: GenerateFlashcardsRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting flashcard generation', {
      userId,
      capsuleId,
      videoId,
      options,
      hasTranscript: !!transcriptResult?.Payload?.transcript,
      hasSummary: !!summaryResult?.Payload?.summary,
    });

    // Get content sources
    const transcript = transcriptResult?.Payload?.transcript || '';
    const summary = summaryResult?.Payload?.summary || '';
    const keyPoints = summaryResult?.Payload?.keyPoints || [];
    const topics = summaryResult?.Payload?.topics || [];

    // If no content available, try to get from database
    let contentSources = { transcript, summary, keyPoints, topics };
    if (!transcript && !summary) {
      contentSources = await getContentFromDatabase(userId, capsuleId);
    }

    if (!contentSources.transcript && !contentSources.summary) {
      throw new Error('No content available for flashcard generation');
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

    // Generate flashcards using the service
    const flashcardSet = await generateFlashcards(
      contentSources.transcript,
      contentSources.summary,
      contentSources.keyPoints,
      contentSources.topics,
      videoMetadata,
      options
    );

    // Store flashcards in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.flashcards = :flashcards,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':flashcards': {
          ...flashcardSet,
          generatedAt: new Date().toISOString(),
          videoTitle: videoMetadata.title,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Flashcards generated successfully', {
      userId,
      capsuleId,
      videoId,
      totalCards: flashcardSet.cards.length,
      averageQuality: flashcardSet.metadata.averageQuality,
      difficultyDistribution: flashcardSet.metadata.difficultyDistribution,
      estimatedStudyTime: flashcardSet.metadata.estimatedStudyTime,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        flashcards: flashcardSet,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate flashcards', {
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
 * Get content from database if not provided in event
 */
async function getContentFromDatabase(userId: string, capsuleId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  const item = result.Item;
  return {
    transcript: item?.learningContent?.transcript?.text || '',
    summary: item?.learningContent?.summary?.summary || '',
    keyPoints: item?.learningContent?.summary?.keyPoints || [],
    topics: item?.learningContent?.summary?.topics || [],
  };
}

export const handler = createHandler(generateFlashcardsHandler);