import { Logger } from '../shared/logger';
const logger = new Logger('notes-organization');
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from './comprehend';

// Note: OpenAI integration removed for now - using rule-based organization

export interface NoteSection {
  id: string;
  title: string;
  content: string;
  level: number; // 1 = main section, 2 = subsection, etc.
  type: 'introduction' | 'main-content' | 'example' | 'summary' | 'conclusion' | 'definition' | 'concept';
  timestamp?: {
    start: number;
    end: number;
  };
  keyPoints: string[];
  tags: string[];
  concepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  importance: number; // 1-10 scale
}

export interface OrganizedNotes {
  sections: NoteSection[];
  structure: {
    totalSections: number;
    maxDepth: number;
    hasIntroduction: boolean;
    hasConclusion: boolean;
    hasSummary: boolean;
  };
  metadata: {
    mainTopics: string[];
    keyTerms: string[];
    concepts: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedReadingTime: number; // in minutes
    wordCount: number;
  };
  categorization: {
    primaryCategory: string;
    secondaryCategories: string[];
    tags: string[];
    subjects: string[];
  };
  searchIndex: {
    keywords: string[];
    phrases: string[];
    entities: Record<string, string[]>;
  };
}

export interface OrganizationOptions {
  maxSections?: number;
  minSectionLength?: number;
  includeTimestamps?: boolean;
  organizationStyle?: 'hierarchical' | 'topical' | 'chronological' | 'difficulty-based';
  detailLevel?: 'high' | 'medium' | 'low';
  language?: string;
}

/**
 * Organize raw notes into structured, categorized, and searchable format
 */
export async function organizeNotes(
  rawNotes: string,
  videoMetadata: {
    title: string;
    description: string;
    duration: number;
    channelTitle: string;
    tags?: string[];
  },
  transcriptSegments?: Array<{ text: string; start: number; duration: number }>,
  options: OrganizationOptions = {}
): Promise<OrganizedNotes> {
  const {
    maxSections = 20,
    minSectionLength = 100,
    includeTimestamps = false,
    organizationStyle = 'hierarchical',
    detailLevel = 'medium',
    language = 'en',
  } = options;

  try {
    logger.info('Starting notes organization', {
      notesLength: rawNotes.length,
      videoTitle: videoMetadata.title,
      organizationStyle,
      detailLevel,
    });

    // Analyze content with AWS Comprehend for insights
    const comprehendAnalysis = await analyzeTextWithComprehend(rawNotes, language);
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 30);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);

    // Extract structured sections using rule-based approach
    const structuredSections = await extractStructuredSections(
      rawNotes,
      videoMetadata,
      {
        keyPhrases: topKeyPhrases,
        entities,
        sentiment: comprehendAnalysis.sentiment,
      },
      options
    );

    // Organize sections based on style
    const organizedSections = await organizeSectionsByStyle(
      structuredSections,
      organizationStyle,
      transcriptSegments
    );

    // Add timestamps if requested and available
    const sectionsWithTimestamps = includeTimestamps && transcriptSegments
      ? await addTimestampsToSections(organizedSections, transcriptSegments)
      : organizedSections;

    // Categorize and tag content
    const categorization = await categorizeContent(
      sectionsWithTimestamps,
      videoMetadata,
      { keyPhrases: topKeyPhrases, entities }
    );

    // Build search index
    const searchIndex = buildSearchIndex(sectionsWithTimestamps, topKeyPhrases, entities);

    // Calculate metadata
    const metadata = calculateNotesMetadata(sectionsWithTimestamps, topKeyPhrases, entities);

    // Analyze structure
    const structure = analyzeNotesStructure(sectionsWithTimestamps);

    const result: OrganizedNotes = {
      sections: sectionsWithTimestamps,
      structure,
      metadata,
      categorization,
      searchIndex,
    };

    logger.info('Notes organization completed', {
      totalSections: result.sections.length,
      primaryCategory: result.categorization.primaryCategory,
      difficulty: result.metadata.difficulty,
      readingTime: result.metadata.estimatedReadingTime,
    });

    return result;
  } catch (error) {
    logger.error('Failed to organize notes', {
      error: error instanceof Error ? error.message : 'Unknown error',
      notesLength: rawNotes.length,
      videoTitle: videoMetadata.title,
    });
    throw error;
  }
}

/**
 * Extract structured sections from raw notes using rule-based approach
 */
async function extractStructuredSections(
  rawNotes: string,
  videoMetadata: any,
  comprehendInsights: any,
  options: OrganizationOptions
): Promise<NoteSection[]> {
  try {
    logger.info('Extracting structured sections using rule-based approach', {
      notesLength: rawNotes.length,
      keyPhrasesCount: comprehendInsights.keyPhrases.length,
    });

    // Use rule-based extraction with enhanced logic
    const sections = extractBasicSections(rawNotes, options);
    
    // Enhance sections with insights from Comprehend
    const enhancedSections = sections.map((section, index) => {
      // Extract concepts from key phrases that appear in this section
      const sectionText = section.content.toLowerCase();
      const relevantConcepts = comprehendInsights.keyPhrases
        .filter((phrase: string) => sectionText.includes(phrase.toLowerCase()))
        .slice(0, 5);

      // Extract entities that appear in this section
      const relevantEntities = Object.entries(comprehendInsights.entities)
        .flatMap(([type, items]: [string, any]) => 
          Array.isArray(items) ? items.filter((item: string) => 
            sectionText.includes(item.toLowerCase())
          ) : []
        )
        .slice(0, 3);

      // Determine difficulty based on content complexity
      const difficulty = determineSectionDifficulty(section.content, relevantConcepts);

      // Calculate importance based on position and content
      const importance = calculateSectionImportance(section, index, sections.length);

      return {
        ...section,
        concepts: [...relevantConcepts, ...relevantEntities],
        difficulty,
        importance,
        keyPoints: extractKeyPointsFromContent(section.content),
      };
    });

    return enhancedSections;
  } catch (error) {
    logger.error('Failed to extract structured sections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback to basic section extraction
    return extractBasicSections(rawNotes, options);
  }
}

/**
 * Fallback method to extract basic sections
 */
function extractBasicSections(rawNotes: string, options: OrganizationOptions): NoteSection[] {
  const sections: NoteSection[] = [];
  const paragraphs = rawNotes.split('\n\n').filter(p => p.trim().length > 50);

  // Create introduction
  if (paragraphs.length > 0) {
    sections.push({
      id: 'intro',
      title: 'Introduction',
      content: paragraphs[0],
      level: 1,
      type: 'introduction',
      keyPoints: [],
      tags: [],
      concepts: [],
      difficulty: 'beginner',
      importance: 8,
    });
  }

  // Create main content sections
  const mainParagraphs = paragraphs.slice(1, -1);
  mainParagraphs.forEach((paragraph, index) => {
    if (paragraph.length >= (options.minSectionLength || 100)) {
      sections.push({
        id: `section-${index}`,
        title: `Section ${index + 1}`,
        content: paragraph,
        level: 2,
        type: 'main-content',
        keyPoints: [],
        tags: [],
        concepts: [],
        difficulty: 'intermediate',
        importance: 5,
      });
    }
  });

  // Create conclusion
  if (paragraphs.length > 1) {
    sections.push({
      id: 'conclusion',
      title: 'Conclusion',
      content: paragraphs[paragraphs.length - 1],
      level: 1,
      type: 'conclusion',
      keyPoints: [],
      tags: [],
      concepts: [],
      difficulty: 'beginner',
      importance: 7,
    });
  }

  return sections;
}

/**
 * Organize sections based on specified style
 */
async function organizeSectionsByStyle(
  sections: NoteSection[],
  style: string,
  transcriptSegments?: Array<{ text: string; start: number; duration: number }>
): Promise<NoteSection[]> {
  switch (style) {
    case 'chronological':
      return organizeChronologically(sections, transcriptSegments);
    case 'topical':
      return organizeTopically(sections);
    case 'difficulty-based':
      return organizeDifficultyBased(sections);
    case 'hierarchical':
    default:
      return organizeHierarchically(sections);
  }
}

/**
 * Organize sections hierarchically
 */
function organizeHierarchically(sections: NoteSection[]): NoteSection[] {
  // Sort by level first, then by importance
  return sections.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    return b.importance - a.importance;
  });
}

/**
 * Organize sections topically
 */
function organizeTopically(sections: NoteSection[]): NoteSection[] {
  // Group by concepts and topics
  const topicGroups = new Map<string, NoteSection[]>();
  
  sections.forEach(section => {
    const primaryConcept = section.concepts[0] || 'general';
    if (!topicGroups.has(primaryConcept)) {
      topicGroups.set(primaryConcept, []);
    }
    topicGroups.get(primaryConcept)!.push(section);
  });

  // Flatten groups back to array
  const organized: NoteSection[] = [];
  topicGroups.forEach(group => {
    organized.push(...group.sort((a, b) => b.importance - a.importance));
  });

  return organized;
}

/**
 * Organize sections by difficulty
 */
function organizeDifficultyBased(sections: NoteSection[]): NoteSection[] {
  const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
  
  return sections.sort((a, b) => {
    const diffA = difficultyOrder[a.difficulty];
    const diffB = difficultyOrder[b.difficulty];
    
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    return b.importance - a.importance;
  });
}

/**
 * Organize sections chronologically based on transcript
 */
function organizeChronologically(
  sections: NoteSection[],
  transcriptSegments?: Array<{ text: string; start: number; duration: number }>
): NoteSection[] {
  if (!transcriptSegments) {
    return sections;
  }

  // Try to match sections with transcript segments
  const sectionsWithTime = sections.map(section => {
    const matchingSegment = findBestMatchingSegment(section.content, transcriptSegments);
    return {
      ...section,
      estimatedTime: matchingSegment?.start || 0,
    };
  });

  return sectionsWithTime
    .sort((a, b) => a.estimatedTime - b.estimatedTime)
    .map(({ estimatedTime, ...section }) => section);
}

/**
 * Find best matching transcript segment for a section
 */
function findBestMatchingSegment(
  sectionContent: string,
  segments: Array<{ text: string; start: number; duration: number }>
): { text: string; start: number; duration: number } | null {
  const sectionWords = sectionContent.toLowerCase().split(/\s+/).slice(0, 20);
  let bestMatch = { segment: segments[0], score: 0 };

  segments.forEach(segment => {
    const segmentWords = segment.text.toLowerCase().split(/\s+/);
    const commonWords = sectionWords.filter(word => 
      word.length > 3 && segmentWords.includes(word)
    );
    const score = commonWords.length / Math.max(sectionWords.length, segmentWords.length);

    if (score > bestMatch.score) {
      bestMatch = { segment, score };
    }
  });

  return bestMatch.score > 0.1 ? bestMatch.segment : null;
}

/**
 * Add timestamps to sections based on transcript
 */
async function addTimestampsToSections(
  sections: NoteSection[],
  transcriptSegments: Array<{ text: string; start: number; duration: number }>
): Promise<NoteSection[]> {
  return sections.map(section => {
    const matchingSegment = findBestMatchingSegment(section.content, transcriptSegments);
    
    if (matchingSegment) {
      // Find end time by looking at next few segments
      const segmentIndex = transcriptSegments.indexOf(matchingSegment);
      const endIndex = Math.min(segmentIndex + 3, transcriptSegments.length - 1);
      const endSegment = transcriptSegments[endIndex];
      
      return {
        ...section,
        timestamp: {
          start: matchingSegment.start,
          end: endSegment.start + endSegment.duration,
        },
      };
    }

    return section;
  });
}

/**
 * Categorize content and generate tags
 */
async function categorizeContent(
  sections: NoteSection[],
  videoMetadata: any,
  comprehendInsights: any
): Promise<OrganizedNotes['categorization']> {
  // Extract all concepts and key points
  const allConcepts = sections.flatMap(s => s.concepts);
  const allKeyPoints = sections.flatMap(s => s.keyPoints);
  const videoTags = videoMetadata.tags || [];

  // Determine primary category based on content analysis
  const primaryCategory = determinePrimaryCategory(
    allConcepts,
    comprehendInsights.keyPhrases,
    videoMetadata.title,
    videoMetadata.channelTitle
  );

  // Generate secondary categories
  const secondaryCategories = generateSecondaryCategories(
    allConcepts,
    comprehendInsights.entities
  );

  // Generate comprehensive tags
  const tags = generateTags(
    allConcepts,
    allKeyPoints,
    comprehendInsights.keyPhrases,
    videoTags
  );

  // Identify academic subjects
  const subjects = identifySubjects(
    primaryCategory,
    allConcepts,
    comprehendInsights.entities
  );

  return {
    primaryCategory,
    secondaryCategories,
    tags,
    subjects,
  };
}

/**
 * Determine primary category for the content
 */
function determinePrimaryCategory(
  concepts: string[],
  keyPhrases: string[],
  title: string,
  channelTitle: string
): string {
  const categoryKeywords = {
    'Technology': ['programming', 'software', 'computer', 'tech', 'coding', 'development', 'algorithm'],
    'Science': ['physics', 'chemistry', 'biology', 'research', 'experiment', 'theory', 'scientific'],
    'Mathematics': ['math', 'equation', 'formula', 'calculation', 'geometry', 'algebra', 'statistics'],
    'Business': ['business', 'marketing', 'finance', 'management', 'strategy', 'economics', 'entrepreneurship'],
    'Education': ['learning', 'teaching', 'education', 'tutorial', 'lesson', 'course', 'academic'],
    'Health': ['health', 'medical', 'fitness', 'nutrition', 'wellness', 'exercise', 'medicine'],
    'Arts': ['art', 'design', 'creative', 'music', 'painting', 'drawing', 'artistic'],
    'History': ['history', 'historical', 'ancient', 'civilization', 'culture', 'heritage', 'past'],
    'Language': ['language', 'grammar', 'vocabulary', 'linguistics', 'communication', 'writing', 'speaking'],
  };

  const allText = [title, channelTitle, ...concepts, ...keyPhrases].join(' ').toLowerCase();
  
  let bestCategory = 'General';
  let bestScore = 0;

  Object.entries(categoryKeywords).forEach(([category, keywords]) => {
    const score = keywords.reduce((acc, keyword) => {
      return acc + (allText.includes(keyword) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return bestCategory;
}

/**
 * Generate secondary categories
 */
function generateSecondaryCategories(
  concepts: string[],
  entities: Record<string, string[]>
): string[] {
  const categories = new Set<string>();

  // Add categories based on entity types
  Object.keys(entities).forEach(entityType => {
    switch (entityType) {
      case 'PERSON':
        categories.add('Biography');
        break;
      case 'LOCATION':
        categories.add('Geography');
        break;
      case 'ORGANIZATION':
        categories.add('Organizations');
        break;
      case 'EVENT':
        categories.add('Events');
        break;
      case 'DATE':
        categories.add('Timeline');
        break;
    }
  });

  // Add categories based on concepts
  concepts.forEach(concept => {
    if (concept.toLowerCase().includes('theory')) {
      categories.add('Theory');
    }
    if (concept.toLowerCase().includes('practical') || concept.toLowerCase().includes('application')) {
      categories.add('Practical');
    }
    if (concept.toLowerCase().includes('example')) {
      categories.add('Examples');
    }
  });

  return Array.from(categories).slice(0, 5); // Limit to 5 secondary categories
}

/**
 * Determine section difficulty based on content complexity
 */
function determineSectionDifficulty(
  content: string,
  concepts: string[]
): 'beginner' | 'intermediate' | 'advanced' {
  const complexityIndicators = {
    beginner: ['introduction', 'basic', 'simple', 'overview', 'what is', 'definition'],
    intermediate: ['implementation', 'example', 'practice', 'application', 'how to'],
    advanced: ['optimization', 'advanced', 'complex', 'theory', 'algorithm', 'research'],
  };

  const contentLower = content.toLowerCase();
  let beginnerScore = 0;
  let intermediateScore = 0;
  let advancedScore = 0;

  // Score based on keywords
  complexityIndicators.beginner.forEach(keyword => {
    if (contentLower.includes(keyword)) beginnerScore++;
  });
  complexityIndicators.intermediate.forEach(keyword => {
    if (contentLower.includes(keyword)) intermediateScore++;
  });
  complexityIndicators.advanced.forEach(keyword => {
    if (contentLower.includes(keyword)) advancedScore++;
  });

  // Score based on content length and concept density
  const wordCount = content.split(/\s+/).length;
  const conceptDensity = concepts.length / Math.max(wordCount / 100, 1);

  if (conceptDensity > 3 || advancedScore > intermediateScore + beginnerScore) {
    return 'advanced';
  } else if (conceptDensity > 1.5 || intermediateScore > beginnerScore) {
    return 'intermediate';
  } else {
    return 'beginner';
  }
}

/**
 * Calculate section importance based on position and content
 */
function calculateSectionImportance(
  section: NoteSection,
  index: number,
  totalSections: number
): number {
  let importance = 5; // Base importance

  // Introduction and conclusion are more important
  if (section.type === 'introduction' || section.type === 'conclusion') {
    importance += 3;
  }

  // First and last sections are more important
  if (index === 0 || index === totalSections - 1) {
    importance += 2;
  }

  // Longer content is generally more important
  const wordCount = section.content.split(/\s+/).length;
  if (wordCount > 200) {
    importance += 1;
  }

  // Sections with more concepts are more important
  if (section.concepts.length > 3) {
    importance += 1;
  }

  return Math.min(10, Math.max(1, importance));
}

/**
 * Extract key points from content
 */
function extractKeyPointsFromContent(content: string): string[] {
  const keyPoints: string[] = [];
  
  // Look for bullet points or numbered lists
  const bulletRegex = /^[\s]*[-•*]\s*(.+)$/gm;
  const numberedRegex = /^[\s]*\d+[\.)]\s*(.+)$/gm;
  
  let match;
  while ((match = bulletRegex.exec(content)) !== null) {
    keyPoints.push(match[1].trim());
  }
  
  while ((match = numberedRegex.exec(content)) !== null) {
    keyPoints.push(match[1].trim());
  }
  
  // If no explicit lists found, extract sentences that seem important
  if (keyPoints.length === 0) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const importantSentences = sentences.filter(sentence => {
      const lower = sentence.toLowerCase();
      return lower.includes('important') || 
             lower.includes('key') || 
             lower.includes('main') ||
             lower.includes('primary') ||
             lower.includes('essential') ||
             lower.includes('crucial');
    });
    
    keyPoints.push(...importantSentences.slice(0, 3).map(s => s.trim()));
  }
  
  return keyPoints.slice(0, 5); // Limit to 5 key points
}

/**
 * Generate comprehensive tags
 */
function generateTags(
  concepts: string[],
  keyPoints: string[],
  keyPhrases: string[],
  videoTags: string[]
): string[] {
  const tags = new Set<string>();

  // Add concepts as tags
  concepts.forEach(concept => {
    if (concept.length > 2 && concept.length < 30) {
      tags.add(concept.toLowerCase());
    }
  });

  // Add key phrases as tags
  keyPhrases.slice(0, 15).forEach(phrase => {
    if (phrase.length > 2 && phrase.length < 30) {
      tags.add(phrase.toLowerCase());
    }
  });

  // Add video tags
  videoTags.forEach(tag => {
    if (tag.length > 2 && tag.length < 30) {
      tags.add(tag.toLowerCase());
    }
  });

  // Extract tags from key points
  keyPoints.forEach(point => {
    const words = point.split(/\s+/).filter(word => word.length > 4);
    words.slice(0, 2).forEach(word => {
      tags.add(word.toLowerCase());
    });
  });

  return Array.from(tags).slice(0, 20); // Limit to 20 tags
}

/**
 * Identify academic subjects
 */
function identifySubjects(
  primaryCategory: string,
  concepts: string[],
  entities: Record<string, string[]>
): string[] {
  const subjects = new Set<string>();

  // Add primary category as subject
  subjects.add(primaryCategory);

  // Map concepts to subjects
  const subjectKeywords = {
    'Computer Science': ['algorithm', 'programming', 'data structure', 'software', 'computing'],
    'Physics': ['physics', 'mechanics', 'thermodynamics', 'quantum', 'relativity'],
    'Chemistry': ['chemistry', 'molecule', 'reaction', 'compound', 'element'],
    'Biology': ['biology', 'cell', 'organism', 'genetics', 'evolution'],
    'Mathematics': ['mathematics', 'calculus', 'algebra', 'geometry', 'statistics'],
    'Psychology': ['psychology', 'behavior', 'cognitive', 'mental', 'brain'],
    'Economics': ['economics', 'market', 'supply', 'demand', 'finance'],
    'Philosophy': ['philosophy', 'ethics', 'logic', 'metaphysics', 'epistemology'],
  };

  const allText = concepts.join(' ').toLowerCase();

  Object.entries(subjectKeywords).forEach(([subject, keywords]) => {
    const hasKeywords = keywords.some(keyword => allText.includes(keyword));
    if (hasKeywords) {
      subjects.add(subject);
    }
  });

  return Array.from(subjects).slice(0, 5); // Limit to 5 subjects
}

/**
 * Build search index for the notes
 */
function buildSearchIndex(
  sections: NoteSection[],
  keyPhrases: string[],
  entities: Record<string, string[]>
): OrganizedNotes['searchIndex'] {
  const keywords = new Set<string>();
  const phrases = new Set<string>();

  // Extract keywords from sections
  sections.forEach(section => {
    // Add section title words
    section.title.split(/\s+/).forEach(word => {
      if (word.length > 3) {
        keywords.add(word.toLowerCase());
      }
    });

    // Add key points
    section.keyPoints.forEach(point => {
      point.split(/\s+/).forEach(word => {
        if (word.length > 3) {
          keywords.add(word.toLowerCase());
        }
      });
    });

    // Add concepts
    section.concepts.forEach(concept => {
      keywords.add(concept.toLowerCase());
    });

    // Add content words (first 100 words)
    const contentWords = section.content.split(/\s+/).slice(0, 100);
    contentWords.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      if (cleanWord.length > 4) {
        keywords.add(cleanWord);
      }
    });
  });

  // Add key phrases
  keyPhrases.forEach(phrase => {
    phrases.add(phrase.toLowerCase());
  });

  return {
    keywords: Array.from(keywords).slice(0, 100), // Limit to 100 keywords
    phrases: Array.from(phrases).slice(0, 50), // Limit to 50 phrases
    entities,
  };
}

/**
 * Calculate notes metadata
 */
function calculateNotesMetadata(
  sections: NoteSection[],
  keyPhrases: string[],
  entities: Record<string, string[]>
): OrganizedNotes['metadata'] {
  const allContent = sections.map(s => s.content).join(' ');
  const wordCount = allContent.split(/\s+/).length;
  const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute

  // Extract main topics from section titles and concepts
  const mainTopics = [
    ...new Set([
      ...sections.filter(s => s.level === 1).map(s => s.title),
      ...sections.flatMap(s => s.concepts).slice(0, 10),
    ])
  ].slice(0, 8);

  // Get key terms from key phrases and concepts
  const keyTerms = [
    ...new Set([
      ...keyPhrases.slice(0, 15),
      ...sections.flatMap(s => s.concepts),
    ])
  ].slice(0, 20);

  // Get all concepts
  const concepts = [...new Set(sections.flatMap(s => s.concepts))];

  // Determine overall difficulty
  const difficultyCounts = { beginner: 0, intermediate: 0, advanced: 0 };
  sections.forEach(section => {
    difficultyCounts[section.difficulty]++;
  });

  const overallDifficulty = Object.entries(difficultyCounts)
    .sort(([,a], [,b]) => b - a)[0][0] as 'beginner' | 'intermediate' | 'advanced';

  return {
    mainTopics,
    keyTerms,
    concepts,
    difficulty: overallDifficulty,
    estimatedReadingTime,
    wordCount,
  };
}

/**
 * Analyze notes structure
 */
function analyzeNotesStructure(sections: NoteSection[]): OrganizedNotes['structure'] {
  const totalSections = sections.length;
  const maxDepth = Math.max(...sections.map(s => s.level));
  const hasIntroduction = sections.some(s => s.type === 'introduction');
  const hasConclusion = sections.some(s => s.type === 'conclusion');
  const hasSummary = sections.some(s => s.type === 'summary');

  return {
    totalSections,
    maxDepth,
    hasIntroduction,
    hasConclusion,
    hasSummary,
  };
}

/**
 * Search within organized notes
 */
export function searchNotes(
  organizedNotes: OrganizedNotes,
  query: string,
  options: {
    searchType?: 'keywords' | 'phrases' | 'semantic';
    maxResults?: number;
    includeContent?: boolean;
  } = {}
): Array<{
  section: NoteSection;
  relevanceScore: number;
  matchedTerms: string[];
}> {
  const { searchType = 'keywords', maxResults = 10, includeContent = true } = options;
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

  const results = organizedNotes.sections.map(section => {
    let relevanceScore = 0;
    const matchedTerms: string[] = [];

    // Search in title (highest weight)
    if (section.title.toLowerCase().includes(queryLower)) {
      relevanceScore += 10;
      matchedTerms.push('title');
    }

    // Search in key points (high weight)
    section.keyPoints.forEach(point => {
      if (point.toLowerCase().includes(queryLower)) {
        relevanceScore += 5;
        matchedTerms.push('keyPoint');
      }
    });

    // Search in concepts (medium weight)
    section.concepts.forEach(concept => {
      if (concept.toLowerCase().includes(queryLower)) {
        relevanceScore += 3;
        matchedTerms.push('concept');
      }
    });

    // Search in tags (medium weight)
    section.tags.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower)) {
        relevanceScore += 3;
        matchedTerms.push('tag');
      }
    });

    // Search in content (lower weight)
    if (includeContent && section.content.toLowerCase().includes(queryLower)) {
      relevanceScore += 1;
      matchedTerms.push('content');
    }

    // Keyword matching
    queryWords.forEach(word => {
      const titleMatches = (section.title.toLowerCase().match(new RegExp(word, 'g')) || []).length;
      const contentMatches = includeContent 
        ? (section.content.toLowerCase().match(new RegExp(word, 'g')) || []).length 
        : 0;
      
      relevanceScore += titleMatches * 2 + contentMatches * 0.5;
    });

    return {
      section,
      relevanceScore,
      matchedTerms: [...new Set(matchedTerms)],
    };
  })
  .filter(result => result.relevanceScore > 0)
  .sort((a, b) => b.relevanceScore - a.relevanceScore)
  .slice(0, maxResults);

  return results;
}