import { bedrockClient } from './bedrock-client';
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from './comprehend';
import { calculateSpacedRepetitionSchedule, SpacedRepetitionData } from './spaced-repetition';

export interface FlashcardOptions {
  language?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  cardTypes?: ('definition' | 'concept' | 'example' | 'application' | 'comparison')[];
  maxCards?: number;
  includeImages?: boolean;
  focusAreas?: string[];
  learningObjectives?: string[];
  avoidDuplicates?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  type: 'definition' | 'concept' | 'example' | 'application' | 'comparison';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  hints?: string[];
  explanation?: string;
  relatedConcepts?: string[];
  examples?: string[];
  mnemonics?: string;
  imagePrompt?: string; // For AI image generation
  metadata: {
    confidence: number; // AI confidence in the card quality
    importance: number; // 1-10 scale
    complexity: number; // 1-10 scale
    memorability: number; // 1-10 scale
  };
  spacedRepetition: SpacedRepetitionData;
  quality: FlashcardQualityResult;
}

export interface FlashcardSet {
  cards: Flashcard[];
  metadata: {
    totalCards: number;
    difficultyDistribution: Record<string, number>;
    typeDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
    averageQuality: number;
    estimatedStudyTime: number; // in minutes
    learningObjectives: string[];
    prerequisites: string[];
  };
  organization: {
    byDifficulty: Record<string, Flashcard[]>;
    byType: Record<string, Flashcard[]>;
    byCategory: Record<string, Flashcard[]>;
    studySequence: string[]; // Optimal order of card IDs for studying
  };
  analytics: {
    conceptCoverage: number; // Percentage of key concepts covered
    redundancyScore: number; // Lower is better
    coherenceScore: number; // How well cards relate to each other
    completenessScore: number; // How comprehensive the set is
  };
}

export interface VideoMetadata {
  title: string;
  description: string;
  duration: number;
  channelTitle: string;
  tags?: string[];
}

/**
 * Generate flashcards from video content using AI and NLP analysis
 */
export async function generateFlashcards(
  transcript: string,
  summary: string,
  keyPoints: string[],
  topics: string[],
  videoMetadata: VideoMetadata,
  options: FlashcardOptions = {}
): Promise<FlashcardSet> {
  const {
    language = 'en',
    difficulty = 'mixed',
    cardTypes = ['definition', 'concept', 'example', 'application'],
    maxCards = 20,
    includeImages = false,
    focusAreas = [],
    learningObjectives = [],
    avoidDuplicates = true,
  } = options;

  try {
    logger.info('Starting flashcard generation', {
      transcriptLength: transcript.length,
      summaryLength: summary.length,
      keyPointsCount: keyPoints.length,
      topicsCount: topics.length,
      videoTitle: videoMetadata.title,
      options,
    });

    // Validate input
    if (!transcript && !summary) {
      throw new Error('Either transcript or summary is required for flashcard generation');
    }

    const contentToAnalyze = transcript || summary;
    if (contentToAnalyze.length < 200) {
      throw new Error('Content is too short for meaningful flashcard generation');
    }

    // Analyze content with AWS Comprehend for insights
    const comprehendAnalysis = await analyzeTextWithComprehend(contentToAnalyze, language);
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 30);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);

    // Generate flashcards using OpenAI
    const rawFlashcards = await generateFlashcardsWithOpenAI(
      {
        transcript,
        summary,
        keyPoints,
        topics,
      },
      videoMetadata,
      {
        keyPhrases: topKeyPhrases,
        entities,
        sentiment: comprehendAnalysis.sentiment,
      },
      options
    );

    // Process and enhance flashcards
    const processedFlashcards = await processFlashcards(
      rawFlashcards,
      {
        keyPhrases: topKeyPhrases,
        entities,
        topics,
      },
      options
    );

    // Validate flashcard quality
    const validatedFlashcards = await validateFlashcards(processedFlashcards);

    // Remove duplicates if requested
    const finalFlashcards = avoidDuplicates 
      ? removeDuplicateFlashcards(validatedFlashcards)
      : validatedFlashcards;

    // Organize flashcards
    const flashcardSet = organizeFlashcards(finalFlashcards, options);

    logger.info('Flashcard generation completed', {
      totalCards: flashcardSet.cards.length,
      averageQuality: flashcardSet.metadata.averageQuality,
      difficultyDistribution: flashcardSet.metadata.difficultyDistribution,
      typeDistribution: flashcardSet.metadata.typeDistribution,
      estimatedStudyTime: flashcardSet.metadata.estimatedStudyTime,
    });

    return flashcardSet;
  } catch (error) {
    logger.error('Failed to generate flashcards', {
      error: error instanceof Error ? error.message : 'Unknown error',
      transcriptLength: transcript.length,
      videoTitle: videoMetadata.title,
      options,
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
  videoMetadata: VideoMetadata,
  comprehendInsights: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    sentiment: any;
  },
  options: FlashcardOptions
): Promise<any[]> {
  const {
    language = 'en',
    difficulty = 'mixed',
    cardTypes = ['definition', 'concept', 'example', 'application'],
    maxCards = 20,
    includeImages = false,
    focusAreas = [],
    learningObjectives = [],
  } = options;

  // Build insights context
  const insightsContext = `
Content Analysis Insights:
- Key Phrases: ${comprehendInsights.keyPhrases.join(', ')}
- Named Entities: ${Object.entries(comprehendInsights.entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
- Content Sentiment: ${comprehendInsights.sentiment.Sentiment}
`;

  // Build focus context
  const focusContext = focusAreas.length > 0 
    ? `\nSpecial focus areas: ${focusAreas.join(', ')}`
    : '';

  // Build learning objectives context
  const objectivesContext = learningObjectives.length > 0
    ? `\nLearning objectives: ${learningObjectives.join(', ')}`
    : '';

  const prompt = `
You are an expert educational content creator specializing in creating effective flashcards for learning. Create high-quality flashcards from the following video content.

Video Information:
- Title: ${videoMetadata.title}
- Channel: ${videoMetadata.channelTitle}
- Duration: ${Math.round(videoMetadata.duration / 60)} minutes
- Description: ${videoMetadata.description}
- Tags: ${videoMetadata.tags?.join(', ') || 'None'}

Content Summary:
${content.summary}

Key Points:
${content.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Main Topics:
${content.topics.join(', ')}

${insightsContext}${focusContext}${objectivesContext}

Source Content:
${content.transcript.substring(0, 6000)}${content.transcript.length > 6000 ? '...' : ''}

Please create ${maxCards} flashcards in the following JSON format:
{
  "flashcards": [
    {
      "front": "Question or prompt",
      "back": "Answer or explanation",
      "type": "definition|concept|example|application|comparison",
      "difficulty": "beginner|intermediate|advanced",
      "category": "Main topic category",
      "tags": ["tag1", "tag2"],
      "hints": ["hint1", "hint2"],
      "explanation": "Detailed explanation of the concept",
      "relatedConcepts": ["concept1", "concept2"],
      "examples": ["example1", "example2"],
      "mnemonics": "Memory aid or mnemonic device",
      "imagePrompt": "Description for AI image generation (if applicable)",
      "importance": 8,
      "complexity": 6,
      "memorability": 7
    }
  ]
}

Flashcard Requirements:
- Card types to include: ${cardTypes.join(', ')}
- Difficulty level: ${difficulty}
- Language: ${language === 'en' ? 'English' : language}
- Maximum cards: ${maxCards}
${includeImages ? '- Include image prompts for visual learning aids' : '- Focus on text-based cards'}

Quality Guidelines:
- Front side should be clear, concise questions or prompts
- Back side should provide complete, accurate answers
- Use active recall principles (test knowledge, don't just present information)
- Ensure each card tests a single concept or fact
- Make cards challenging but fair
- Include context and examples where helpful
- Use clear, unambiguous language
- Avoid trick questions or overly complex wording
- Ensure answers are factually correct and complete
- Create cards that build upon each other logically

Card Type Guidelines:
- Definition: "What is X?" or "Define Y"
- Concept: "Explain the concept of X" or "How does Y work?"
- Example: "Give an example of X" or "What is an example of Y?"
- Application: "How would you apply X?" or "When would you use Y?"
- Comparison: "What's the difference between X and Y?" or "Compare A and B"

Difficulty Guidelines:
- Beginner: Basic definitions and simple concepts
- Intermediate: Relationships between concepts and applications
- Advanced: Complex analysis, synthesis, and evaluation
- Mixed: Combination of all difficulty levels

Educational Best Practices:
- Use spaced repetition principles
- Create cards that promote deep understanding
- Include memory aids and mnemonics where appropriate
- Ensure cards are self-contained (don't require external context)
- Test understanding, not just memorization
- Include practical applications and real-world examples
`;

  try {
    const systemPrompt = 'You are an expert educational flashcard creator. Always respond with valid JSON format containing well-designed flashcards.';
    
    const result = await bedrockClient.generateStructuredResponse(
      `${systemPrompt}\n\n${prompt}`,
      JSON.stringify({
        type: 'object',
        properties: {
          flashcards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                front: { type: 'string' },
                back: { type: 'string' },
                type: { type: 'string' },
                difficulty: { type: 'string' },
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }),
      {
        temperature: 0.4,
        maxTokens: 4000
      }
    );

    if (!result) {
      throw new Error('No response from Bedrock');
    }

    const flashcardData = result as {
      flashcards?: Array<{
        id: string;
        front: string;
        back: string;
        type: string;
        difficulty: string;
        tags: string[];
      }>;
    };

    return flashcardData.flashcards || [];
  } catch (error) {
    // Bedrock flashcard generation failed
    return generateFallbackFlashcards(content, videoMetadata, options);
  }
}

/**
 * Process and enhance raw flashcards from OpenAI
 */
async function processFlashcards(
  rawFlashcards: any[],
  insights: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    topics: string[];
  },
  options: FlashcardOptions
): Promise<Flashcard[]> {
  const processedFlashcards: Flashcard[] = [];

  for (let i = 0; i < rawFlashcards.length; i++) {
    const rawCard = rawFlashcards[i];
    
    if (!rawCard.front || !rawCard.back) {
      logger.warn('Skipping invalid flashcard', { index: i, card: rawCard });
      continue;
    }

    // Generate unique ID
    const cardId = `card-${Date.now()}-${i}`;

    // Initialize spaced repetition data
    const spacedRepetition = calculateSpacedRepetitionSchedule({
      difficulty: rawCard.difficulty || 'intermediate',
      previousPerformance: [],
    });

    // Process and validate card data
    const processedCard: Flashcard = {
      id: cardId,
      front: rawCard.front.trim(),
      back: rawCard.back.trim(),
      type: rawCard.type || 'concept',
      difficulty: rawCard.difficulty || 'intermediate',
      category: rawCard.category || determineCategory(rawCard, insights.topics),
      tags: Array.isArray(rawCard.tags) ? rawCard.tags : [],
      hints: Array.isArray(rawCard.hints) ? rawCard.hints : [],
      explanation: rawCard.explanation || '',
      relatedConcepts: Array.isArray(rawCard.relatedConcepts) ? rawCard.relatedConcepts : [],
      examples: Array.isArray(rawCard.examples) ? rawCard.examples : [],
      mnemonics: rawCard.mnemonics || '',
      imagePrompt: options.includeImages ? rawCard.imagePrompt : undefined,
      metadata: {
        confidence: 0.8, // Will be updated by quality validation
        importance: Math.max(1, Math.min(10, rawCard.importance || 5)),
        complexity: Math.max(1, Math.min(10, rawCard.complexity || 5)),
        memorability: Math.max(1, Math.min(10, rawCard.memorability || 5)),
      },
      spacedRepetition,
      quality: {
        overallScore: 0, // Will be set by validation
        clarityScore: 0,
        accuracyScore: 0,
        difficultyScore: 0,
        engagementScore: 0,
        issues: [],
        suggestions: [],
      },
    };

    // Enhance tags with insights
    processedCard.tags = enhanceCardTags(processedCard, insights);

    processedFlashcards.push(processedCard);
  }

  return processedFlashcards;
}

/**
 * Validate flashcard quality
 */
async function validateFlashcards(flashcards: Flashcard[]): Promise<Flashcard[]> {
  const validatedFlashcards: Flashcard[] = [];

  for (const card of flashcards) {
    try {
      // Validate flashcard quality
      const qualityResult = await validateFlashcardQuality(card, {
        checkClarity: true,
        checkAccuracy: true,
        checkDifficulty: true,
        checkEngagement: true,
        minFrontLength: 10,
        maxFrontLength: 200,
        minBackLength: 5,
        maxBackLength: 500,
      });

      // Update card with quality results
      card.quality = qualityResult;
      card.metadata.confidence = qualityResult.overallScore / 10;

      // Only include cards that meet minimum quality threshold
      if (qualityResult.overallScore >= 6.0) {
        validatedFlashcards.push(card);
      } else {
        logger.warn('Excluding low-quality flashcard', {
          cardId: card.id,
          qualityScore: qualityResult.overallScore,
          issues: qualityResult.issues,
        });
      }
    } catch (error) {
      logger.error('Failed to validate flashcard quality', {
        cardId: card.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Include card with default quality scores if validation fails
      card.quality = {
        overallScore: 5.0,
        clarityScore: 5.0,
        accuracyScore: 5.0,
        difficultyScore: 5.0,
        engagementScore: 5.0,
        issues: ['Quality validation failed'],
        suggestions: ['Manual review recommended'],
      };
      validatedFlashcards.push(card);
    }
  }

  return validatedFlashcards;
}

/**
 * Remove duplicate flashcards based on content similarity
 */
function removeDuplicateFlashcards(flashcards: Flashcard[]): Flashcard[] {
  const uniqueFlashcards: Flashcard[] = [];
  const seenContent = new Set<string>();

  for (const card of flashcards) {
    // Create a normalized content signature
    const contentSignature = normalizeCardContent(card.front + ' ' + card.back);
    
    if (!seenContent.has(contentSignature)) {
      seenContent.add(contentSignature);
      uniqueFlashcards.push(card);
    } else {
      logger.debug('Removing duplicate flashcard', {
        cardId: card.id,
        front: card.front.substring(0, 50),
      });
    }
  }

  return uniqueFlashcards;
}

/**
 * Organize flashcards into a structured set
 */
function organizeFlashcards(flashcards: Flashcard[], options: FlashcardOptions): FlashcardSet {
  // Calculate distributions
  const difficultyDistribution = calculateDistribution(flashcards, 'difficulty');
  const typeDistribution = calculateDistribution(flashcards, 'type');
  const categoryDistribution = calculateDistribution(flashcards, 'category');

  // Calculate average quality
  const averageQuality = flashcards.reduce((sum, card) => sum + card.quality.overallScore, 0) / flashcards.length;

  // Estimate study time (2-3 minutes per card on average)
  const estimatedStudyTime = Math.ceil(flashcards.length * 2.5);

  // Extract learning objectives and prerequisites
  const learningObjectives = extractLearningObjectives(flashcards);
  const prerequisites = extractPrerequisites(flashcards);

  // Organize by different criteria
  const byDifficulty = groupBy(flashcards, 'difficulty');
  const byType = groupBy(flashcards, 'type');
  const byCategory = groupBy(flashcards, 'category');

  // Create optimal study sequence
  const studySequence = createOptimalStudySequence(flashcards);

  // Calculate analytics
  const analytics = calculateFlashcardAnalytics(flashcards);

  return {
    cards: flashcards,
    metadata: {
      totalCards: flashcards.length,
      difficultyDistribution,
      typeDistribution,
      categoryDistribution,
      averageQuality,
      estimatedStudyTime,
      learningObjectives,
      prerequisites,
    },
    organization: {
      byDifficulty,
      byType,
      byCategory,
      studySequence,
    },
    analytics,
  };
}

/**
 * Generate fallback flashcards if OpenAI fails
 */
function generateFallbackFlashcards(
  content: {
    transcript: string;
    summary: string;
    keyPoints: string[];
    topics: string[];
  },
  videoMetadata: VideoMetadata,
  options: FlashcardOptions
): any[] {
  const fallbackCards: any[] = [];

  // Create cards from key points
  content.keyPoints.forEach((point, index) => {
    if (index < (options.maxCards || 20) / 2) {
      fallbackCards.push({
        front: `What is the key point about: ${point.split(' ').slice(0, 5).join(' ')}...?`,
        back: point,
        type: 'concept',
        difficulty: 'intermediate',
        category: 'Key Concepts',
        tags: ['key-point'],
        importance: 7,
        complexity: 5,
        memorability: 6,
      });
    }
  });

  // Create cards from topics
  content.topics.forEach((topic, index) => {
    if (index < (options.maxCards || 20) / 2) {
      fallbackCards.push({
        front: `Define or explain: ${topic}`,
        back: `${topic} is one of the main topics covered in this video about ${videoMetadata.title}`,
        type: 'definition',
        difficulty: 'beginner',
        category: topic,
        tags: ['topic'],
        importance: 6,
        complexity: 4,
        memorability: 7,
      });
    }
  });

  return fallbackCards.slice(0, options.maxCards || 20);
}

/**
 * Helper functions
 */

function determineCategory(card: any, topics: string[]): string {
  if (card.category) return card.category;
  
  // Try to match with topics
  const cardText = (card.front + ' ' + card.back).toLowerCase();
  for (const topic of topics) {
    if (cardText.includes(topic.toLowerCase())) {
      return topic;
    }
  }
  
  return 'General';
}

function enhanceCardTags(card: Flashcard, insights: any): string[] {
  const tags = new Set(card.tags);
  
  // Add tags based on card type and difficulty
  tags.add(card.type);
  tags.add(card.difficulty);
  
  // Add tags based on content analysis
  const cardText = (card.front + ' ' + card.back).toLowerCase();
  insights.keyPhrases.forEach((phrase: string) => {
    if (cardText.includes(phrase.toLowerCase())) {
      tags.add(phrase);
    }
  });
  
  return Array.from(tags).slice(0, 8); // Limit to 8 tags
}

function normalizeCardContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateDistribution(items: any[], field: string): Record<string, number> {
  const distribution: Record<string, number> = {};
  items.forEach(item => {
    const value = item[field] || 'unknown';
    distribution[value] = (distribution[value] || 0) + 1;
  });
  return distribution;
}

function groupBy(items: Flashcard[], field: keyof Flashcard): Record<string, Flashcard[]> {
  const groups: Record<string, Flashcard[]> = {};
  items.forEach(item => {
    const value = String(item[field]) || 'unknown';
    if (!groups[value]) groups[value] = [];
    groups[value].push(item);
  });
  return groups;
}

function extractLearningObjectives(flashcards: Flashcard[]): string[] {
  const objectives = new Set<string>();
  
  flashcards.forEach(card => {
    // Extract objectives from card categories and types
    objectives.add(`Understand ${card.category}`);
    if (card.type === 'application') {
      objectives.add(`Apply concepts of ${card.category}`);
    }
  });
  
  return Array.from(objectives).slice(0, 5);
}

function extractPrerequisites(flashcards: Flashcard[]): string[] {
  const prerequisites = new Set<string>();
  
  flashcards.forEach(card => {
    card.relatedConcepts.forEach(concept => {
      if (concept !== card.category) {
        prerequisites.add(concept);
      }
    });
  });
  
  return Array.from(prerequisites).slice(0, 5);
}

function createOptimalStudySequence(flashcards: Flashcard[]): string[] {
  // Sort by difficulty (beginner first), then by importance
  const sortedCards = [...flashcards].sort((a, b) => {
    const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
    const diffA = difficultyOrder[a.difficulty];
    const diffB = difficultyOrder[b.difficulty];
    
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    
    return b.metadata.importance - a.metadata.importance;
  });
  
  return sortedCards.map(card => card.id);
}

function calculateFlashcardAnalytics(flashcards: Flashcard[]): FlashcardSet['analytics'] {
  // Calculate concept coverage (simplified)
  const uniqueCategories = new Set(flashcards.map(card => card.category));
  const conceptCoverage = Math.min(100, (uniqueCategories.size / 10) * 100); // Assume 10 is ideal

  // Calculate redundancy score
  const contentHashes = flashcards.map(card => normalizeCardContent(card.front + card.back));
  const uniqueContent = new Set(contentHashes);
  const redundancyScore = Math.max(0, 100 - (uniqueContent.size / flashcards.length) * 100);

  // Calculate coherence score (how well cards relate to each other)
  const coherenceScore = calculateCoherenceScore(flashcards);

  // Calculate completeness score
  const completenessScore = calculateCompletenessScore(flashcards);

  return {
    conceptCoverage,
    redundancyScore,
    coherenceScore,
    completenessScore,
  };
}

function calculateCoherenceScore(flashcards: Flashcard[]): number {
  // Simplified coherence calculation based on shared tags and categories
  let totalConnections = 0;
  let possibleConnections = 0;

  for (let i = 0; i < flashcards.length; i++) {
    for (let j = i + 1; j < flashcards.length; j++) {
      possibleConnections++;
      
      const card1 = flashcards[i];
      const card2 = flashcards[j];
      
      // Check for shared tags, categories, or related concepts
      const sharedTags = card1.tags.filter(tag => card2.tags.includes(tag));
      const sameCategory = card1.category === card2.category;
      const relatedConcepts = card1.relatedConcepts.some(concept => 
        card2.relatedConcepts.includes(concept)
      );
      
      if (sharedTags.length > 0 || sameCategory || relatedConcepts) {
        totalConnections++;
      }
    }
  }

  return possibleConnections > 0 ? (totalConnections / possibleConnections) * 100 : 0;
}

function calculateCompletenessScore(flashcards: Flashcard[]): number {
  // Simplified completeness calculation based on card types and difficulty distribution
  const hasDefinitions = flashcards.some(card => card.type === 'definition');
  const hasConcepts = flashcards.some(card => card.type === 'concept');
  const hasExamples = flashcards.some(card => card.type === 'example');
  const hasApplications = flashcards.some(card => card.type === 'application');
  
  const typeScore = [hasDefinitions, hasConcepts, hasExamples, hasApplications]
    .filter(Boolean).length / 4 * 50;
  
  const hasBeginner = flashcards.some(card => card.difficulty === 'beginner');
  const hasIntermediate = flashcards.some(card => card.difficulty === 'intermediate');
  const hasAdvanced = flashcards.some(card => card.difficulty === 'advanced');
  
  const difficultyScore = [hasBeginner, hasIntermediate, hasAdvanced]
    .filter(Boolean).length / 3 * 50;
  
  return typeScore + difficultyScore;
}

/**
 * Update flashcard based on user performance
 */
export async function updateFlashcardPerformance(
  flashcard: Flashcard,
  performance: {
    correct: boolean;
    responseTime: number; // in seconds
    difficulty: number; // 1-5 scale (1 = very easy, 5 = very hard)
    confidence: number; // 1-5 scale
  }
): Promise<Flashcard> {
  // Update spaced repetition schedule
  const updatedSpacedRepetition = calculateSpacedRepetitionSchedule({
    difficulty: flashcard.difficulty,
    previousPerformance: [
      ...flashcard.spacedRepetition.performanceHistory,
      {
        date: new Date().toISOString(),
        correct: performance.correct,
        responseTime: performance.responseTime,
        difficulty: performance.difficulty,
        confidence: performance.confidence,
      },
    ],
  });

  return {
    ...flashcard,
    spacedRepetition: updatedSpacedRepetition,
  };
}