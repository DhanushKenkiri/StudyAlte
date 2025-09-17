import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import OpenAI from 'openai';
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from '../../services/comprehend';
import { organizeNotes, OrganizedNotes } from '../../services/notes-organization';
import { string } from 'zod';
import { string } from 'zod';
import { number } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { number } from 'zod';
import { string } from 'zod';
import { string } from 'zod';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateNotesRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoUrl: string;
  title?: string;
  options: {
    language?: string;
    format?: 'markdown' | 'outline' | 'structured' | 'bullet-points';
    includeTimestamps?: boolean;
    includeHighlights?: boolean;
    includeAnnotations?: boolean;
    categorizeByTopics?: boolean;
    generateTags?: boolean;
    includeKeyQuotes?: boolean;
    detailLevel?: 'brief' | 'detailed' | 'comprehensive';
  };
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

interface NoteSection {
  id: string;
  title: string;
  content: string;
  type: 'introduction' | 'main-point' | 'detail' | 'example' | 'conclusion' | 'key-quote';
  level: number; // Hierarchical level (0 = top level)
  order: number; // Order within the same level
  timestamp?: {
    start: number;
    end: number;
  };
  tags: string[];
  highlights: string[];
  annotations: Array<{
    id: string;
    text: string;
    type: 'note' | 'question' | 'important' | 'clarification';
    position: number; // Character position in content
  }>;
}

interface NotesResult {
  content: string; // Full formatted notes content
  format: string;
  sections: NoteSection[];
  metadata: {
    totalSections: number;
    wordCount: number;
    readingTime: number; // in minutes
    categories: string[];
    tags: string[];
    keyQuotes: string[];
    highlights: string[];
  };
  searchIndex: {
    keywords: string[];
    phrases: string[];
    entities: Record<string, string[]>;
    topics: string[];
  };
  structure: {
    outline: Array<{
      title: string;
      level: number;
      sectionIds: string[];
    }>;
    hierarchy: Record<string, string[]>; // parent -> children mapping
  };
}

/**
 * Generate intelligent notes from video content using AI
 */
async function generateNotesHandler(event: GenerateNotesRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting notes generation', {
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
      throw new Error('No content available for notes generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoTitle = metadata?.title || event.title || 'Unknown Video';

    // Analyze content with Comprehend for additional insights
    const comprehendAnalysis = await analyzeTextWithComprehend(
      contentSources.transcript || contentSources.summary,
      options.language || 'en'
    );

    // Generate notes using OpenAI
    const notesResult = await generateNotesWithOpenAI(
      contentSources,
      {
        title: videoTitle,
        description: metadata?.description || '',
        channelTitle: metadata?.channelTitle || '',
        duration: metadata?.duration || 0,
        tags: metadata?.tags || [],
      },
      options,
      comprehendAnalysis,
      transcriptResult?.Payload?.segments
    );

    // Organize notes for better structure and searchability
    const organizedNotes = await organizeNotes(
      notesResult.content,
      {
        title: videoTitle,
        description: metadata?.description || '',
        channelTitle: metadata?.channelTitle || '',
        duration: metadata?.duration || 0,
        tags: metadata?.tags || [],
      },
      transcriptResult?.Payload?.segments,
      {
        organizationStyle: options.format === 'outline' ? 'hierarchical' : 'topical',
        includeTimestamps: options.includeTimestamps,
        detailLevel: options.style === 'detailed' ? 'high' : options.style === 'concise' ? 'low' : 'medium',
        language: options.language,
      }
    );

    // Store notes in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.notes = :notes,
          learningContent.organizedNotes = :organizedNotes,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':notes': {
          ...notesResult,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':organizedNotes': {
          ...organizedNotes,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Notes generated successfully', {
      userId,
      capsuleId,
      videoId,
      totalSections: notesResult.metadata.totalSections,
      wordCount: notesResult.metadata.wordCount,
      readingTime: notesResult.metadata.readingTime,
      format: notesResult.format,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        notes: notesResult,
        organizedNotes,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate notes', {
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
 * Generate notes using OpenAI GPT-4
 */
async function generateNotesWithOpenAI(
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
  options: GenerateNotesRequest['options'],
  comprehendAnalysis?: any,
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<NotesResult> {
  const {
    language = 'en',
    format = 'markdown',
    includeTimestamps = true,
    includeHighlights = true,
    includeAnnotations = false,
    categorizeByTopics = true,
    generateTags = true,
    includeKeyQuotes = true,
    detailLevel = 'detailed',
  } = options;

  // Extract insights from Comprehend analysis
  let comprehendInsights = '';
  if (comprehendAnalysis) {
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 20);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);
    
    comprehendInsights = `
Key Concepts for Notes:
- Important Terms: ${topKeyPhrases.join(', ')}
- Named Entities: ${Object.entries(entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
`;
  }

  // Build the prompt
  const prompt = `
You are an expert note-taking specialist creating comprehensive study notes from educational video content. Create well-structured, organized notes that facilitate learning and review.

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
${content.transcript.substring(0, 8000)}${content.transcript.length > 8000 ? '...' : ''}

Please create structured notes in the following JSON format:
{
  "sections": [
    {
      "id": "unique-section-id",
      "title": "Section title",
      "content": "Detailed section content",
      "type": "introduction|main-point|detail|example|conclusion|key-quote",
      "level": 0-3,
      "order": 0,
      "tags": ["relevant", "tags"],
      "highlights": ["important phrases to highlight"],
      "keyQuotes": ["memorable quotes from the content"]
    }
  ],
  "tags": ["comprehensive", "list", "of", "tags"],
  "categories": ["Main Category 1", "Main Category 2"],
  "keyQuotes": ["Important quotes from the video"],
  "keywords": ["searchable", "keywords"]
}

Requirements:
- Write in ${language === 'en' ? 'English' : language}
- Format: ${format}
- Detail level: ${detailLevel}
- Create a logical hierarchy with clear sections
- Start with an introduction section summarizing the main topic
- Organize content by main topics and subtopics
- Include specific details and examples where relevant
- End with a conclusion section summarizing key takeaways
${includeKeyQuotes ? '- Include memorable quotes and important statements' : '- Focus on concepts rather than quotes'}
${includeHighlights ? '- Highlight important terms and concepts' : '- Keep formatting simple'}
${categorizeByTopics ? '- Organize content by topic categories' : '- Use chronological organization'}
${generateTags ? '- Generate comprehensive tags for searchability' : '- Use minimal tagging'}
- Ensure notes are comprehensive yet concise
- Make content scannable with clear headings and structure
- Include practical applications and examples
- Ensure notes can stand alone without the video
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert note-taking specialist. Always respond with valid JSON format containing well-structured educational notes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for consistent structure
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseContent);
    const rawSections = result.sections || [];

    // Process and enhance notes
    const processedNotes = await processNotes(
      rawSections,
      result,
      options,
      segments
    );

    return processedNotes;
  } catch (error) {
    logger.error('OpenAI notes generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.transcript.length + content.summary.length,
      options,
    });

    // Fallback to basic notes generation
    return generateFallbackNotes(content, metadata, options);
  }
}

/**
 * Process and enhance raw notes data from OpenAI
 */
async function processNotes(
  rawSections: any[],
  rawResult: any,
  options: GenerateNotesRequest['options'],
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<NotesResult> {
  const processedSections: NoteSection[] = [];

  // Process sections
  rawSections.forEach((rawSection, index) => {
    if (!rawSection.title || !rawSection.content) {
      logger.warn('Skipping invalid section', { index, section: rawSection });
      return;
    }

    // Find timestamp if available
    const timestamp = findTimestamp(rawSection.content, segments);

    const processedSection: NoteSection = {
      id: rawSection.id || `section-${index}`,
      title: rawSection.title,
      content: rawSection.content,
      type: rawSection.type || 'main-point',
      level: Math.max(0, Math.min(3, rawSection.level || 0)),
      order: rawSection.order || index,
      timestamp,
      tags: Array.isArray(rawSection.tags) ? rawSection.tags : [],
      highlights: Array.isArray(rawSection.highlights) ? rawSection.highlights : [],
      annotations: [], // Will be populated if annotations are enabled
    };

    processedSections.push(processedSection);
  });

  // Sort sections by level and order
  processedSections.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.order - b.order;
  });

  // Generate formatted content
  const formattedContent = generateFormattedContent(processedSections, options.format || 'markdown');

  // Create search index
  const searchIndex = createSearchIndex(processedSections, rawResult);

  // Create structure outline
  const structure = createStructureOutline(processedSections);

  // Calculate metadata
  const wordCount = formattedContent.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // Assume 200 words per minute

  return {
    content: formattedContent,
    format: options.format || 'markdown',
    sections: processedSections,
    metadata: {
      totalSections: processedSections.length,
      wordCount,
      readingTime,
      categories: rawResult.categories || [],
      tags: rawResult.tags || [],
      keyQuotes: rawResult.keyQuotes || [],
      highlights: processedSections.flatMap(section => section.highlights),
    },
    searchIndex,
    structure,
  };
}

/**
 * Find timestamp for content in transcript segments
 */
function findTimestamp(
  content: string,
  segments?: Array<{ text: string; start: number; duration: number }>
): { start: number; end: number } | undefined {
  if (!segments || segments.length === 0) return undefined;

  const contentWords = content.toLowerCase().split(/\s+/).slice(0, 10); // First 10 words
  let bestMatch = { segment: segments[0], score: 0 };

  for (const segment of segments) {
    const segmentWords = segment.text.toLowerCase().split(/\s+/);
    const commonWords = contentWords.filter(word => 
      word.length > 3 && segmentWords.includes(word)
    );
    const score = commonWords.length / Math.max(contentWords.length, segmentWords.length);

    if (score > bestMatch.score) {
      bestMatch = { segment, score };
    }
  }

  if (bestMatch.score > 0.2) {
    return {
      start: bestMatch.segment.start,
      end: bestMatch.segment.start + bestMatch.segment.duration,
    };
  }

  return undefined;
}

/**
 * Generate formatted content based on format type
 */
function generateFormattedContent(sections: NoteSection[], format: string): string {
  switch (format) {
    case 'markdown':
      return generateMarkdownContent(sections);
    case 'outline':
      return generateOutlineContent(sections);
    case 'structured':
      return generateStructuredContent(sections);
    case 'bullet-points':
      return generateBulletPointsContent(sections);
    default:
      return generateMarkdownContent(sections);
  }
}

/**
 * Generate markdown formatted content
 */
function generateMarkdownContent(sections: NoteSection[]): string {
  let content = '';

  sections.forEach(section => {
    const headerLevel = '#'.repeat(Math.min(6, section.level + 1));
    content += `${headerLevel} ${section.title}\n\n`;
    
    if (section.timestamp) {
      content += `*Timestamp: ${formatTimestamp(section.timestamp.start)} - ${formatTimestamp(section.timestamp.end)}*\n\n`;
    }
    
    content += `${section.content}\n\n`;
    
    if (section.highlights.length > 0) {
      content += `**Key Points:**\n`;
      section.highlights.forEach(highlight => {
        content += `- **${highlight}**\n`;
      });
      content += '\n';
    }
    
    if (section.tags.length > 0) {
      content += `*Tags: ${section.tags.join(', ')}*\n\n`;
    }
    
    content += '---\n\n';
  });

  return content;
}

/**
 * Generate outline formatted content
 */
function generateOutlineContent(sections: NoteSection[]): string {
  let content = '';

  sections.forEach(section => {
    const indent = '  '.repeat(section.level);
    content += `${indent}${section.level + 1}. ${section.title}\n`;
    
    const contentLines = section.content.split('\n');
    contentLines.forEach(line => {
      if (line.trim()) {
        content += `${indent}   ${line.trim()}\n`;
      }
    });
    
    if (section.highlights.length > 0) {
      section.highlights.forEach(highlight => {
        content += `${indent}   • ${highlight}\n`;
      });
    }
    
    content += '\n';
  });

  return content;
}

/**
 * Generate structured content
 */
function generateStructuredContent(sections: NoteSection[]): string {
  let content = '';

  const sectionsByLevel = sections.reduce((acc, section) => {
    if (!acc[section.level]) acc[section.level] = [];
    acc[section.level].push(section);
    return acc;
  }, {} as Record<number, NoteSection[]>);

  Object.entries(sectionsByLevel).forEach(([level, levelSections]) => {
    content += `\n${'='.repeat(50)}\n`;
    content += `LEVEL ${parseInt(level) + 1} SECTIONS\n`;
    content += `${'='.repeat(50)}\n\n`;

    levelSections.forEach(section => {
      content += `[${section.type.toUpperCase()}] ${section.title}\n`;
      content += `${'-'.repeat(section.title.length + section.type.length + 3)}\n`;
      content += `${section.content}\n\n`;
      
      if (section.highlights.length > 0) {
        content += `HIGHLIGHTS:\n`;
        section.highlights.forEach(highlight => {
          content += `  ★ ${highlight}\n`;
        });
        content += '\n';
      }
    });
  });

  return content;
}

/**
 * Generate bullet points content
 */
function generateBulletPointsContent(sections: NoteSection[]): string {
  let content = '';

  sections.forEach(section => {
    const bullet = '•'.repeat(section.level + 1);
    content += `${bullet} ${section.title}\n`;
    
    const contentLines = section.content.split('\n');
    contentLines.forEach(line => {
      if (line.trim()) {
        content += `  ${bullet} ${line.trim()}\n`;
      }
    });
    
    section.highlights.forEach(highlight => {
      content += `    ★ ${highlight}\n`;
    });
    
    content += '\n';
  });

  return content;
}

/**
 * Create search index for notes
 */
function createSearchIndex(sections: NoteSection[], rawResult: any): NotesResult['searchIndex'] {
  const keywords = new Set<string>();
  const phrases = new Set<string>();

  // Extract keywords from content
  sections.forEach(section => {
    const words = section.content.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 3) {
        keywords.add(cleanWord);
      }
    });

    // Extract phrases (2-3 word combinations)
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + 2).join(' ').replace(/[^\w\s]/g, '');
      if (phrase.length > 6) {
        phrases.add(phrase);
      }
    }

    // Add highlights and tags
    section.highlights.forEach(highlight => keywords.add(highlight.toLowerCase()));
    section.tags.forEach(tag => keywords.add(tag.toLowerCase()));
  });

  return {
    keywords: Array.from(keywords),
    phrases: Array.from(phrases),
    entities: rawResult.entities || {},
    topics: rawResult.categories || [],
  };
}

/**
 * Create structure outline
 */
function createStructureOutline(sections: NoteSection[]): NotesResult['structure'] {
  const outline: Array<{ title: string; level: number; sectionIds: string[] }> = [];
  const hierarchy: Record<string, string[]> = {};

  // Group sections by level and create outline
  const sectionsByLevel = sections.reduce((acc, section) => {
    if (!acc[section.level]) acc[section.level] = [];
    acc[section.level].push(section);
    return acc;
  }, {} as Record<number, NoteSection[]>);

  Object.entries(sectionsByLevel).forEach(([level, levelSections]) => {
    const levelNum = parseInt(level);
    
    outline.push({
      title: `Level ${levelNum + 1}`,
      level: levelNum,
      sectionIds: levelSections.map(s => s.id),
    });

    // Build hierarchy
    if (levelNum === 0) {
      levelSections.forEach(section => {
        hierarchy[section.id] = [];
      });
    } else {
      // Find parent sections (previous level)
      const parentSections = sectionsByLevel[levelNum - 1] || [];
      parentSections.forEach(parent => {
        if (!hierarchy[parent.id]) hierarchy[parent.id] = [];
        levelSections.forEach(child => {
          hierarchy[parent.id].push(child.id);
        });
      });
    }
  });

  return { outline, hierarchy };
}

/**
 * Format timestamp in MM:SS format
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
 * Generate basic fallback notes if OpenAI fails
 */
function generateFallbackNotes(
  content: { transcript: string; summary: string; keyPoints: string[]; topics: string[] },
  metadata: { title: string; description: string },
  options: GenerateNotesRequest['options']
): NotesResult {
  const sections: NoteSection[] = [];

  // Create introduction section
  sections.push({
    id: 'intro',
    title: 'Introduction',
    content: `These are notes for "${metadata.title}". ${metadata.description}`,
    type: 'introduction',
    level: 0,
    order: 0,
    tags: ['introduction'],
    highlights: [],
    annotations: [],
  });

  // Create sections from key points
  content.keyPoints.forEach((point, index) => {
    sections.push({
      id: `keypoint-${index}`,
      title: `Key Point ${index + 1}`,
      content: point,
      type: 'main-point',
      level: 1,
      order: index + 1,
      tags: ['key-point'],
      highlights: [point.substring(0, 50)],
      annotations: [],
    });
  });

  // Create conclusion section
  sections.push({
    id: 'conclusion',
    title: 'Summary',
    content: content.summary || 'Summary of the main concepts covered in this video.',
    type: 'conclusion',
    level: 0,
    order: sections.length,
    tags: ['summary'],
    highlights: [],
    annotations: [],
  });

  const formattedContent = generateFormattedContent(sections, options.format || 'markdown');
  const searchIndex = createSearchIndex(sections, { categories: content.topics, tags: [] });
  const structure = createStructureOutline(sections);

  return {
    content: formattedContent,
    format: options.format || 'markdown',
    sections,
    metadata: {
      totalSections: sections.length,
      wordCount: formattedContent.split(/\s+/).length,
      readingTime: Math.ceil(formattedContent.split(/\s+/).length / 200),
      categories: content.topics,
      tags: ['fallback', 'basic'],
      keyQuotes: [],
      highlights: sections.flatMap(s => s.highlights),
    },
    searchIndex,
    structure,
  };
}

// Export handler
export const handler = createHandler(generateNotesHandler);  }
;
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

interface NotesResult {
  content: string;
  format: string;
  metadata: {
    wordCount: number;
    readingTime: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    topics: string[];
    keyTerms: string[];
    tags: string[];
  };
  structure: {
    sections: Array<{
      id: string;
      title: string;
      content: string;
      type: string;
      level: number;
      timestamp?: {
        start: number;
        end: number;
      };
    }>;
    hasIntroduction: boolean;
    hasConclusion: boolean;
    totalSections: number;
  };
}

/**
 * Generate structured notes from video content
 */
async function generateNotesHandler(event: GenerateNotesRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting notes generation', {
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
      throw new Error('No content available for notes generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoTitle = metadata?.title || event.title || 'Unknown Video';

    // Analyze content with Comprehend for additional insights
    const comprehendAnalysis = await analyzeTextWithComprehend(
      contentSources.transcript || contentSources.summary,
      options.language || 'en'
    );

    // Generate notes using OpenAI
    const notesResult = await generateNotesWithOpenAI(
      contentSources,
      {
        title: videoTitle,
        description: metadata?.description || '',
        channelTitle: metadata?.channelTitle || '',
        duration: metadata?.duration || 0,
        tags: metadata?.tags || [],
      },
      options,
      comprehendAnalysis,
      transcriptResult?.Payload?.segments
    );

    // Organize notes for better structure and searchability
    const organizedNotes = await organizeNotes(
      notesResult.content,
      {
        title: videoTitle,
        description: metadata?.description || '',
        channelTitle: metadata?.channelTitle || '',
        duration: metadata?.duration || 0,
        tags: metadata?.tags || [],
      },
      transcriptResult?.Payload?.segments,
      {
        organizationStyle: options.format === 'outline' ? 'hierarchical' : 'topical',
        includeTimestamps: options.includeTimestamps,
        detailLevel: options.detailLevel === 'comprehensive' ? 'high' : options.detailLevel === 'brief' ? 'low' : 'medium',
        language: options.language,
      }
    );

    // Store notes in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.notes = :notes,
          learningContent.organizedNotes = :organizedNotes,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':notes': {
          ...notesResult,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':organizedNotes': {
          ...organizedNotes,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Notes generated successfully', {
      userId,
      capsuleId,
      videoId,
      format: notesResult.format,
      wordCount: notesResult.metadata.wordCount,
      sectionsCount: organizedNotes.sections.length,
      readingTime: notesResult.metadata.readingTime,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        notes: notesResult,
        organizedNotes,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate notes', {
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
 * Generate notes using OpenAI GPT-4
 */
async function generateNotesWithOpenAI(
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
    tags: string[];
  },
  options: GenerateNotesRequest['options'],
  comprehendAnalysis?: any,
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<NotesResult> {
  const {
    language = 'en',
    format = 'markdown',
    includeTimestamps = false,
    includeHighlights = true,
    includeAnnotations = false,
    categorizeByTopics = true,
    generateTags = true,
    includeKeyQuotes = false,
    detailLevel = 'detailed',
  } = options;

  // Extract insights from Comprehend analysis
  let comprehendInsights = '';
  if (comprehendAnalysis) {
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 20);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);
    
    comprehendInsights = `
Key Terms and Concepts:
- Important Terms: ${topKeyPhrases.join(', ')}
- Named Entities: ${Object.entries(entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
`;
  }

  // Build the prompt
  const prompt = `
You are an expert note-taker specializing in creating comprehensive, well-structured notes for learning. Create detailed notes from the following video content.

Video Information:
- Title: ${metadata.title}
- Channel: ${metadata.channelTitle}
- Duration: ${Math.round(metadata.duration / 60)} minutes
- Description: ${metadata.description}
- Tags: ${metadata.tags.join(', ')}

Content Summary:
${content.summary}

Key Points:
${content.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Main Topics:
${content.topics.join(', ')}

${comprehendInsights}

Full Transcript:
${content.transcript.substring(0, 8000)}${content.transcript.length > 8000 ? '...' : ''}

Please create comprehensive notes in the following JSON format:
{
  "content": "Full formatted notes content",
  "sections": [
    {
      "id": "unique-section-id",
      "title": "Section Title",
      "content": "Detailed section content",
      "type": "introduction|main-content|example|summary|conclusion",
      "level": 1
    }
  ],
  "metadata": {
    "topics": ["topic1", "topic2"],
    "keyTerms": ["term1", "term2"],
    "tags": ["tag1", "tag2"],
    "difficulty": "beginner|intermediate|advanced"
  }
}

Format Requirements:
- Use ${format} formatting
- Detail level: ${detailLevel}
- Language: ${language === 'en' ? 'English' : language}
${includeTimestamps ? '- Include timestamps where relevant' : '- Do not include timestamps'}
${includeHighlights ? '- Highlight important concepts' : '- Use plain formatting'}
${categorizeByTopics ? '- Organize by topics' : '- Use chronological organization'}
${generateTags ? '- Generate relevant tags' : '- Minimal tagging'}
${includeKeyQuotes ? '- Include key quotes from the content' : '- Paraphrase content'}

General Requirements:
- Create logical sections with clear hierarchy
- Include introduction and conclusion sections
- Ensure content is educational and well-organized
- Focus on key concepts and learning objectives
- Make notes suitable for study and review
- Include practical applications where relevant
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational note-taker. Always respond with valid JSON format containing well-structured notes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseContent);
    
    // Process the result
    const sections = result.sections || [];
    const notesContent = result.content || '';
    const resultMetadata = result.metadata || {};

    // Calculate additional metadata
    const wordCount = notesContent.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed

    return {
      content: notesContent,
      format,
      metadata: {
        wordCount,
        readingTime,
        difficulty: resultMetadata.difficulty || 'intermediate',
        topics: resultMetadata.topics || content.topics,
        keyTerms: resultMetadata.keyTerms || [],
        tags: resultMetadata.tags || [],
      },
      structure: {
        sections: sections.map((section: any, index: number) => ({
          id: section.id || `section-${index}`,
          title: section.title || `Section ${index + 1}`,
          content: section.content || '',
          type: section.type || 'main-content',
          level: section.level || 1,
          timestamp: includeTimestamps ? findSectionTimestamp(section.content, segments) : undefined,
        })),
        hasIntroduction: sections.some((s: any) => s.type === 'introduction'),
        hasConclusion: sections.some((s: any) => s.type === 'conclusion'),
        totalSections: sections.length,
      },
    };
  } catch (error) {
    logger.error('OpenAI notes generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.transcript.length + content.summary.length,
      options,
    });

    // Fallback to basic notes generation
    return generateFallbackNotes(content, metadata, options);
  }
}

/**
 * Find timestamp for a section based on content
 */
function findSectionTimestamp(
  sectionContent: string,
  segments?: Array<{ text: string; start: number; duration: number }>
): { start: number; end: number } | undefined {
  if (!segments || segments.length === 0) return undefined;

  const contentWords = sectionContent.toLowerCase().split(/\s+/).slice(0, 20);
  let bestMatch = { segment: segments[0], score: 0, index: 0 };

  segments.forEach((segment, index) => {
    const segmentWords = segment.text.toLowerCase().split(/\s+/);
    const commonWords = contentWords.filter(word => 
      word.length > 3 && segmentWords.includes(word)
    );
    const score = commonWords.length / Math.max(contentWords.length, segmentWords.length);

    if (score > bestMatch.score) {
      bestMatch = { segment, score, index };
    }
  });

  if (bestMatch.score > 0.15) {
    const endIndex = Math.min(bestMatch.index + 3, segments.length - 1);
    const endSegment = segments[endIndex];
    
    return {
      start: bestMatch.segment.start,
      end: endSegment.start + endSegment.duration,
    };
  }

  return undefined;
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
 * Generate basic fallback notes if OpenAI fails
 */
function generateFallbackNotes(
  content: { transcript: string; summary: string; keyPoints: string[]; topics: string[] },
  metadata: { title: string; description: string },
  options: GenerateNotesRequest['options']
): NotesResult {
  const sections = [];

  // Create introduction section
  sections.push({
    id: 'intro',
    title: 'Introduction',
    content: `These are notes from "${metadata.title}". ${metadata.description}`,
    type: 'introduction',
    level: 1,
  });

  // Create sections from topics
  content.topics.forEach((topic, index) => {
    sections.push({
      id: `topic-${index}`,
      title: topic,
      content: `Key concepts and information about ${topic}.`,
      type: 'main-content',
      level: 2,
    });
  });

  // Create summary section
  if (content.summary) {
    sections.push({
      id: 'summary',
      title: 'Summary',
      content: content.summary,
      type: 'summary',
      level: 1,
    });
  }

  const notesContent = sections.map(section => 
    `${'#'.repeat(section.level)} ${section.title}\n\n${section.content}\n\n`
  ).join('');

  const wordCount = notesContent.split(/\s+/).length;

  return {
    content: notesContent,
    format: options.format || 'markdown',
    metadata: {
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      difficulty: 'intermediate',
      topics: content.topics,
      keyTerms: content.keyPoints.slice(0, 10),
      tags: [],
    },
    structure: {
      sections,
      hasIntroduction: true,
      hasConclusion: false,
      totalSections: sections.length,
    },
  };
}

export const handler = createHandler(generateNotesHandler);