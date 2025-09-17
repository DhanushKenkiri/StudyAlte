import { bedrockClient } from './bedrock-client';
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from './comprehend';

export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  color?: string;
  description?: string;
  createdAt: string;
  createdBy: 'user' | 'system';
  confidence?: number; // For auto-generated tags
  parentTagId?: string; // For hierarchical tags
  isCustom: boolean;
}

export type TagCategory = 
  | 'subject' // Math, Science, Programming, etc.
  | 'difficulty' // Beginner, Intermediate, Advanced
  | 'format' // Tutorial, Lecture, Demo, etc.
  | 'duration' // Short, Medium, Long
  | 'language' // English, Spanish, etc.
  | 'topic' // Specific topics within subjects
  | 'skill' // Skills being taught
  | 'custom'; // User-defined categories

export interface TaggingOptions {
  includeAutoTags?: boolean;
  includeSubjectTags?: boolean;
  includeDifficultyTags?: boolean;
  includeFormatTags?: boolean;
  includeTopicTags?: boolean;
  maxAutoTags?: number;
  confidenceThreshold?: number;
  customCategories?: string[];
}

export interface TagSuggestion {
  tag: Omit<Tag, 'id' | 'createdAt'>;
  confidence: number;
  reasoning: string;
  source: 'ai' | 'nlp' | 'metadata' | 'pattern';
}

export interface CapsuleTagging {
  capsuleId: string;
  tags: Tag[];
  suggestedTags: TagSuggestion[];
  categories: Record<TagCategory, Tag[]>;
  lastUpdated: string;
  autoTaggingEnabled: boolean;
}

export interface VideoMetadata {
  title: string;
  description: string;
  duration: number;
  channelTitle: string;
  tags: string[];
  categoryId?: string;
  language: string;
}

/**
 * Generate automatic tags for a learning capsule using AI and NLP analysis
 */
export async function generateAutoTags(
  transcript: string,
  summary: string,
  keyPoints: string[],
  videoMetadata: VideoMetadata,
  options: TaggingOptions = {}
): Promise<TagSuggestion[]> {
  try {
    const {
      includeAutoTags = true,
      includeSubjectTags = true,
      includeDifficultyTags = true,
      includeFormatTags = true,
      includeTopicTags = true,
      maxAutoTags = 20,
      confidenceThreshold = 0.6,
    } = options;

    const suggestions: TagSuggestion[] = [];

    // Analyze content with AWS Comprehend
    const comprehendAnalysis = await analyzeTextWithComprehend(
      `${transcript} ${summary} ${keyPoints.join(' ')}`,
      videoMetadata.language || 'en'
    );

    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 15);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);

    // Generate AI-powered tags
    if (includeAutoTags) {
      const aiTags = await generateAITags(
        {
          transcript,
          summary,
          keyPoints,
          keyPhrases: topKeyPhrases,
          entities,
        },
        videoMetadata,
        { maxTags: Math.floor(maxAutoTags * 0.6) }
      );
      suggestions.push(...aiTags);
    }

    // Generate subject tags
    if (includeSubjectTags) {
      const subjectTags = generateSubjectTags(
        topKeyPhrases,
        entities,
        videoMetadata
      );
      suggestions.push(...subjectTags);
    }

    // Generate difficulty tags
    if (includeDifficultyTags) {
      const difficultyTag = await generateDifficultyTag(
        transcript,
        summary,
        videoMetadata
      );
      if (difficultyTag) {
        suggestions.push(difficultyTag);
      }
    }

    // Generate format tags
    if (includeFormatTags) {
      const formatTags = generateFormatTags(
        transcript,
        videoMetadata
      );
      suggestions.push(...formatTags);
    }

    // Generate topic tags from key phrases
    if (includeTopicTags) {
      const topicTags = generateTopicTags(
        topKeyPhrases,
        entities
      );
      suggestions.push(...topicTags);
    }

    // Filter by confidence threshold and limit results
    const filteredSuggestions = suggestions
      .filter(suggestion => suggestion.confidence >= confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxAutoTags);

    // Auto tags generated successfully
    return filteredSuggestions;
  } catch (error) {
    // Failed to generate auto tags
    throw error;
  }
}

/**
 * Generate AI-powered tags using OpenAI
 */
async function generateAITags(
  content: {
    transcript: string;
    summary: string;
    keyPoints: string[];
    keyPhrases: string[];
    entities: Record<string, any[]>;
  },
  videoMetadata: VideoMetadata,
  options: { maxTags: number }
): Promise<TagSuggestion[]> {
  try {
    const prompt = `
Analyze this educational video content and suggest relevant tags for categorization and search.

Video Title: ${videoMetadata.title}
Channel: ${videoMetadata.channelTitle}
Duration: ${Math.floor(videoMetadata.duration / 60)} minutes

Content Summary: ${content.summary}

Key Points:
${content.keyPoints.map(point => `- ${point}`).join('\n')}

Key Phrases: ${content.keyPhrases.join(', ')}

Please suggest up to ${options.maxTags} tags that would help users find and categorize this content. Focus on:
1. Main subject areas and disciplines
2. Specific topics and concepts covered
3. Skills or techniques taught
4. Target audience or difficulty level
5. Learning objectives

For each tag, provide:
- name: The tag name (2-3 words max)
- category: One of "subject", "topic", "skill", "difficulty", "format"
- confidence: Score from 0.0 to 1.0
- reasoning: Brief explanation why this tag is relevant

Return as JSON array of objects with these fields.
`;

    const systemPrompt = 'You are an expert educational content analyzer. Generate accurate, helpful tags for learning materials.';
    
    const response = await bedrockClient.generateStructuredResponse(
      `${systemPrompt}\n\n${prompt}`,
      JSON.stringify({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string' },
            confidence: { type: 'number' },
            relevance: { type: 'string' }
          }
        }
      }),
      {
        temperature: 0.3,
        maxTokens: 1500
      }
    );

    if (!response || !Array.isArray(response)) {
      throw new Error('No valid response from Bedrock for tag generation');
    }

    const aiTags = response;
    
    return aiTags.map((tag: any) => ({
      tag: {
        name: tag.name,
        category: tag.category as TagCategory,
        createdBy: 'system' as const,
        isCustom: false,
        confidence: tag.confidence,
      },
      confidence: tag.confidence,
      reasoning: tag.reasoning,
      source: 'ai' as const,
    }));
  } catch (error) {
    // Failed to generate AI tags
    return [];
  }
}

/**
 * Generate subject tags based on content analysis
 */
function generateSubjectTags(
  keyPhrases: string[],
  entities: Record<string, any[]>,
  videoMetadata: VideoMetadata
): TagSuggestion[] {
  const subjectMappings: Record<string, { subjects: string[]; confidence: number }> = {
    'programming|coding|software|development|javascript|python|java|react|node': {
      subjects: ['Programming', 'Software Development'],
      confidence: 0.9,
    },
    'mathematics|math|algebra|calculus|geometry|statistics': {
      subjects: ['Mathematics'],
      confidence: 0.9,
    },
    'physics|chemistry|biology|science': {
      subjects: ['Science'],
      confidence: 0.9,
    },
    'machine learning|ai|artificial intelligence|data science|neural network': {
      subjects: ['Machine Learning', 'Data Science'],
      confidence: 0.9,
    },
    'business|marketing|finance|economics|management': {
      subjects: ['Business'],
      confidence: 0.8,
    },
    'design|ui|ux|graphic|creative': {
      subjects: ['Design'],
      confidence: 0.8,
    },
    'language|english|spanish|french|linguistics': {
      subjects: ['Languages'],
      confidence: 0.8,
    },
  };

  const suggestions: TagSuggestion[] = [];
  const allText = `${videoMetadata.title} ${videoMetadata.description} ${keyPhrases.join(' ')}`.toLowerCase();

  for (const [pattern, mapping] of Object.entries(subjectMappings)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(allText)) {
      mapping.subjects.forEach(subject => {
        suggestions.push({
          tag: {
            name: subject,
            category: 'subject',
            createdBy: 'system',
            isCustom: false,
          },
          confidence: mapping.confidence,
          reasoning: `Detected subject-related keywords in content`,
          source: 'nlp',
        });
      });
    }
  }

  return suggestions;
}

/**
 * Generate difficulty tag based on content complexity
 */
async function generateDifficultyTag(
  transcript: string,
  summary: string,
  videoMetadata: VideoMetadata
): Promise<TagSuggestion | null> {
  try {
    // Simple heuristics for difficulty assessment
    const content = `${transcript} ${summary}`.toLowerCase();
    
    // Beginner indicators
    const beginnerKeywords = ['intro', 'introduction', 'basics', 'fundamentals', 'getting started', 'beginner', 'basic'];
    const beginnerScore = beginnerKeywords.filter(keyword => content.includes(keyword)).length;

    // Advanced indicators
    const advancedKeywords = ['advanced', 'complex', 'optimization', 'algorithm', 'architecture', 'framework', 'deep dive'];
    const advancedScore = advancedKeywords.filter(keyword => content.includes(keyword)).length;

    // Technical complexity indicators
    const technicalTerms = (content.match(/\b[A-Z]{2,}\b/g) || []).length; // Acronyms
    const longSentences = transcript.split('.').filter(s => s.split(' ').length > 20).length;

    let difficulty: string;
    let confidence: number;

    if (beginnerScore > 2 || videoMetadata.title.toLowerCase().includes('intro')) {
      difficulty = 'Beginner';
      confidence = 0.8;
    } else if (advancedScore > 2 || technicalTerms > 10 || longSentences > 5) {
      difficulty = 'Advanced';
      confidence = 0.7;
    } else {
      difficulty = 'Intermediate';
      confidence = 0.6;
    }

    return {
      tag: {
        name: difficulty,
        category: 'difficulty',
        createdBy: 'system',
        isCustom: false,
      },
      confidence,
      reasoning: `Based on content complexity analysis and keyword patterns`,
      source: 'nlp',
    };
  } catch (error) {
    // Failed to generate difficulty tag
    return null;
  }
}

/**
 * Generate format tags based on video characteristics
 */
function generateFormatTags(
  transcript: string,
  videoMetadata: VideoMetadata
): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];

  // Duration-based tags
  const duration = videoMetadata.duration;
  if (duration < 300) { // 5 minutes
    suggestions.push({
      tag: { name: 'Quick Tutorial', category: 'format', createdBy: 'system', isCustom: false },
      confidence: 0.9,
      reasoning: 'Video duration is under 5 minutes',
      source: 'metadata',
    });
  } else if (duration > 3600) { // 1 hour
    suggestions.push({
      tag: { name: 'In-Depth Course', category: 'format', createdBy: 'system', isCustom: false },
      confidence: 0.8,
      reasoning: 'Video duration is over 1 hour',
      source: 'metadata',
    });
  }

  // Content format detection
  const content = transcript.toLowerCase();
  
  if (content.includes('demo') || content.includes('demonstration')) {
    suggestions.push({
      tag: { name: 'Demo', category: 'format', createdBy: 'system', isCustom: false },
      confidence: 0.8,
      reasoning: 'Contains demonstration keywords',
      source: 'nlp',
    });
  }

  if (content.includes('step by step') || content.includes('tutorial')) {
    suggestions.push({
      tag: { name: 'Step-by-Step', category: 'format', createdBy: 'system', isCustom: false },
      confidence: 0.8,
      reasoning: 'Contains step-by-step instruction patterns',
      source: 'nlp',
    });
  }

  return suggestions;
}

/**
 * Generate topic tags from key phrases
 */
function generateTopicTags(
  keyPhrases: string[],
  entities: Record<string, any[]>
): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];

  // Convert top key phrases to topic tags
  keyPhrases.slice(0, 10).forEach(phrase => {
    if (phrase.length > 3 && phrase.length < 25) {
      suggestions.push({
        tag: {
          name: toTitleCase(phrase),
          category: 'topic',
          createdBy: 'system',
          isCustom: false,
        },
        confidence: 0.7,
        reasoning: `Identified as key phrase in content analysis`,
        source: 'nlp',
      });
    }
  });

  // Convert entities to topic tags
  if (entities.PERSON) {
    entities.PERSON.slice(0, 3).forEach((person: any) => {
      suggestions.push({
        tag: {
          name: person.Text,
          category: 'topic',
          createdBy: 'system',
          isCustom: false,
        },
        confidence: person.Score || 0.6,
        reasoning: `Identified person mentioned in content`,
        source: 'nlp',
      });
    });
  }

  return suggestions;
}

/**
 * Apply tags to a learning capsule
 */
export async function applyCapsuleTags(
  capsuleId: string,
  tags: Tag[],
  suggestedTags: TagSuggestion[] = []
): Promise<CapsuleTagging> {
  const categories: Record<TagCategory, Tag[]> = {
    subject: [],
    difficulty: [],
    format: [],
    duration: [],
    language: [],
    topic: [],
    skill: [],
    custom: [],
  };

  // Organize tags by category
  tags.forEach(tag => {
    if (categories[tag.category]) {
      categories[tag.category].push(tag);
    }
  });

  return {
    capsuleId,
    tags,
    suggestedTags,
    categories,
    lastUpdated: new Date().toISOString(),
    autoTaggingEnabled: true,
  };
}

/**
 * Get tag suggestions for user input
 */
export async function getTagSuggestions(
  query: string,
  existingTags: Tag[],
  limit: number = 10
): Promise<Tag[]> {
  // This would typically query a database of existing tags
  // For now, return filtered existing tags that match the query
  const queryLower = query.toLowerCase();
  
  return existingTags
    .filter(tag => 
      tag.name.toLowerCase().includes(queryLower) ||
      tag.description?.toLowerCase().includes(queryLower)
    )
    .slice(0, limit);
}

/**
 * Utility function to convert text to title case
 */
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Create a hierarchical tag structure
 */
export function createTagHierarchy(tags: Tag[]): Record<string, Tag[]> {
  const hierarchy: Record<string, Tag[]> = {};
  
  tags.forEach(tag => {
    if (!tag.parentTagId) {
      // Root level tag
      if (!hierarchy[tag.id]) {
        hierarchy[tag.id] = [];
      }
    } else {
      // Child tag
      if (!hierarchy[tag.parentTagId]) {
        hierarchy[tag.parentTagId] = [];
      }
      hierarchy[tag.parentTagId].push(tag);
    }
  });

  return hierarchy;
}
