import { ComprehendClient, DetectKeyPhrasesCommand, DetectEntitiesCommand, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import { logger } from '../shared/logger';

const comprehendClient = new ComprehendClient({ region: process.env.AWS_REGION });

export interface KeyPhrase {
  text: string;
  score: number;
  beginOffset: number;
  endOffset: number;
}

export interface Entity {
  text: string;
  type: string;
  score: number;
  beginOffset: number;
  endOffset: number;
}

export interface SentimentAnalysis {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  sentimentScore: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
}

export interface ComprehendAnalysis {
  keyPhrases: KeyPhrase[];
  entities: Entity[];
  sentiment: SentimentAnalysis;
}

/**
 * Analyze text using AWS Comprehend for key phrases, entities, and sentiment
 */
export async function analyzeTextWithComprehend(
  text: string,
  languageCode: string = 'en'
): Promise<ComprehendAnalysis> {
  try {
    // Truncate text if too long (Comprehend has limits)
    const maxLength = 5000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    logger.info('Starting Comprehend analysis', {
      textLength: text.length,
      truncatedLength: truncatedText.length,
      languageCode,
    });

    // Run all analyses in parallel
    const [keyPhrasesResult, entitiesResult, sentimentResult] = await Promise.allSettled([
      comprehendClient.send(new DetectKeyPhrasesCommand({
        Text: truncatedText,
        LanguageCode: languageCode,
      })),
      comprehendClient.send(new DetectEntitiesCommand({
        Text: truncatedText,
        LanguageCode: languageCode,
      })),
      comprehendClient.send(new DetectSentimentCommand({
        Text: truncatedText,
        LanguageCode: languageCode,
      })),
    ]);

    // Process key phrases
    const keyPhrases: KeyPhrase[] = keyPhrasesResult.status === 'fulfilled' 
      ? (keyPhrasesResult.value.KeyPhrases || []).map(phrase => ({
          text: phrase.Text || '',
          score: phrase.Score || 0,
          beginOffset: phrase.BeginOffset || 0,
          endOffset: phrase.EndOffset || 0,
        }))
      : [];

    // Process entities
    const entities: Entity[] = entitiesResult.status === 'fulfilled'
      ? (entitiesResult.value.Entities || []).map(entity => ({
          text: entity.Text || '',
          type: entity.Type || 'OTHER',
          score: entity.Score || 0,
          beginOffset: entity.BeginOffset || 0,
          endOffset: entity.EndOffset || 0,
        }))
      : [];

    // Process sentiment
    const sentiment: SentimentAnalysis = sentimentResult.status === 'fulfilled'
      ? {
          sentiment: sentimentResult.value.Sentiment as SentimentAnalysis['sentiment'] || 'NEUTRAL',
          sentimentScore: {
            positive: sentimentResult.value.SentimentScore?.Positive || 0,
            negative: sentimentResult.value.SentimentScore?.Negative || 0,
            neutral: sentimentResult.value.SentimentScore?.Neutral || 0,
            mixed: sentimentResult.value.SentimentScore?.Mixed || 0,
          },
        }
      : {
          sentiment: 'NEUTRAL',
          sentimentScore: { positive: 0, negative: 0, neutral: 1, mixed: 0 },
        };

    // Log any failures
    if (keyPhrasesResult.status === 'rejected') {
      logger.warn('Key phrases detection failed', { error: keyPhrasesResult.reason });
    }
    if (entitiesResult.status === 'rejected') {
      logger.warn('Entity detection failed', { error: entitiesResult.reason });
    }
    if (sentimentResult.status === 'rejected') {
      logger.warn('Sentiment analysis failed', { error: sentimentResult.reason });
    }

    logger.info('Comprehend analysis completed', {
      keyPhrasesCount: keyPhrases.length,
      entitiesCount: entities.length,
      sentiment: sentiment.sentiment,
    });

    return {
      keyPhrases,
      entities,
      sentiment,
    };
  } catch (error) {
    logger.error('Comprehend analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      textLength: text.length,
      languageCode,
    });

    // Return empty analysis on failure
    return {
      keyPhrases: [],
      entities: [],
      sentiment: {
        sentiment: 'NEUTRAL',
        sentimentScore: { positive: 0, negative: 0, neutral: 1, mixed: 0 },
      },
    };
  }
}

/**
 * Extract top key phrases from Comprehend analysis
 */
export function extractTopKeyPhrases(
  keyPhrases: KeyPhrase[],
  limit: number = 10,
  minScore: number = 0.8
): string[] {
  return keyPhrases
    .filter(phrase => phrase.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(phrase => phrase.text);
}

/**
 * Extract entities by type from Comprehend analysis
 */
export function extractEntitiesByType(
  entities: Entity[],
  types: string[] = ['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT'],
  minScore: number = 0.8
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  
  types.forEach(type => {
    result[type] = entities
      .filter(entity => entity.type === type && entity.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .map(entity => entity.text);
  });

  return result;
}

/**
 * Generate content quality score based on Comprehend analysis
 */
export function calculateContentQuality(analysis: ComprehendAnalysis): {
  score: number;
  factors: {
    keyPhrasesDensity: number;
    entityRichness: number;
    sentimentBalance: number;
  };
} {
  // Calculate key phrases density (higher is better, up to a point)
  const keyPhrasesDensity = Math.min(analysis.keyPhrases.length / 20, 1);
  
  // Calculate entity richness (variety of entity types)
  const entityTypes = new Set(analysis.entities.map(e => e.type));
  const entityRichness = Math.min(entityTypes.size / 5, 1);
  
  // Calculate sentiment balance (neutral to positive is better for educational content)
  const { positive, neutral } = analysis.sentiment.sentimentScore;
  const sentimentBalance = (positive + neutral) / 2;
  
  // Weighted average
  const score = (
    keyPhrasesDensity * 0.4 +
    entityRichness * 0.3 +
    sentimentBalance * 0.3
  );

  return {
    score,
    factors: {
      keyPhrasesDensity,
      entityRichness,
      sentimentBalance,
    },
  };
}