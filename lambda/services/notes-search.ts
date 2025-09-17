import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';
const logger = new Logger('notes-search');
import { searchNotes as searchOrganizedNotes, OrganizedNotes } from './notes-organization';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface NoteSection {
  id: string;
  title: string;
  content: string;
  type: 'introduction' | 'main-point' | 'detail' | 'example' | 'conclusion' | 'key-quote';
  level: number;
  order: number;
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
    position: number;
  }>;
}

export interface SearchQuery {
  query: string;
  filters?: {
    tags?: string[];
    categories?: string[];
    sectionTypes?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
    hasTimestamp?: boolean;
    hasHighlights?: boolean;
  };
  options?: {
    fuzzy?: boolean;
    caseSensitive?: boolean;
    wholeWords?: boolean;
    includeContext?: boolean;
    maxResults?: number;
  };
}

export interface SearchResult {
  sectionId: string;
  title: string;
  content: string;
  type: string;
  score: number;
  matches: Array<{
    text: string;
    position: number;
    length: number;
    context: string;
  }>;
  highlights: string[];
  tags: string[];
  timestamp?: {
    start: number;
    end: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  suggestions: string[];
  facets: {
    tags: Record<string, number>;
    categories: Record<string, number>;
    sectionTypes: Record<string, number>;
  };
}

export interface NotesIndex {
  keywords: Map<string, Set<string>>; // keyword -> section IDs
  phrases: Map<string, Set<string>>; // phrase -> section IDs
  tags: Map<string, Set<string>>; // tag -> section IDs
  categories: Map<string, Set<string>>; // category -> section IDs
  sectionTypes: Map<string, Set<string>>; // type -> section IDs
  fullText: Map<string, string>; // section ID -> full text content
  metadata: Map<string, any>; // section ID -> metadata
}

/**
 * Create searchable index from notes sections
 */
export function createNotesIndex(
  sections: NoteSection[],
  metadata: {
    categories: string[];
    tags: string[];
  }
): NotesIndex {
  const index: NotesIndex = {
    keywords: new Map(),
    phrases: new Map(),
    tags: new Map(),
    categories: new Map(),
    sectionTypes: new Map(),
    fullText: new Map(),
    metadata: new Map(),
  };

  sections.forEach(section => {
    const sectionId = section.id;
    const fullText = `${section.title} ${section.content} ${section.highlights.join(' ')}`;
    
    // Store full text
    index.fullText.set(sectionId, fullText.toLowerCase());
    
    // Store metadata
    index.metadata.set(sectionId, {
      title: section.title,
      type: section.type,
      level: section.level,
      order: section.order,
      timestamp: section.timestamp,
      tags: section.tags,
      highlights: section.highlights,
    });

    // Index keywords
    const words = fullText.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 2) {
        if (!index.keywords.has(cleanWord)) {
          index.keywords.set(cleanWord, new Set());
        }
        index.keywords.get(cleanWord)!.add(sectionId);
      }
    });

    // Index phrases (2-3 word combinations)
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + 2).join(' ').replace(/[^\w\s]/g, '');
      if (phrase.length > 5) {
        if (!index.phrases.has(phrase)) {
          index.phrases.set(phrase, new Set());
        }
        index.phrases.get(phrase)!.add(sectionId);
      }
    }

    // Index tags
    section.tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      if (!index.tags.has(normalizedTag)) {
        index.tags.set(normalizedTag, new Set());
      }
      index.tags.get(normalizedTag)!.add(sectionId);
    });

    // Index section type
    if (!index.sectionTypes.has(section.type)) {
      index.sectionTypes.set(section.type, new Set());
    }
    index.sectionTypes.get(section.type)!.add(sectionId);
  });

  // Index categories
  metadata.categories.forEach(category => {
    const normalizedCategory = category.toLowerCase();
    if (!index.categories.has(normalizedCategory)) {
      index.categories.set(normalizedCategory, new Set());
    }
    // Associate all sections with their categories
    sections.forEach(section => {
      index.categories.get(normalizedCategory)!.add(section.id);
    });
  });

  logger.info('Notes index created', {
    totalSections: sections.length,
    keywordsCount: index.keywords.size,
    phrasesCount: index.phrases.size,
    tagsCount: index.tags.size,
    categoriesCount: index.categories.size,
  });

  return index;
}

/**
 * Search notes using the created index
 */
export function searchNotes(
  query: SearchQuery,
  index: NotesIndex,
  sections: NoteSection[]
): SearchResponse {
  const startTime = Date.now();
  const results: SearchResult[] = [];
  const sectionScores = new Map<string, number>();
  const matchDetails = new Map<string, Array<{ text: string; position: number; length: number; context: string }>>();

  const {
    fuzzy = true,
    caseSensitive = false,
    wholeWords = false,
    includeContext = true,
    maxResults = 50,
  } = query.options || {};

  // Normalize query
  const normalizedQuery = caseSensitive ? query.query : query.query.toLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);

  // Search keywords
  queryTerms.forEach(term => {
    const matchingSections = findMatchingSections(term, index.keywords, fuzzy);
    matchingSections.forEach(sectionId => {
      const currentScore = sectionScores.get(sectionId) || 0;
      sectionScores.set(sectionId, currentScore + 1);
    });
  });

  // Search phrases
  if (queryTerms.length > 1) {
    const queryPhrase = queryTerms.join(' ');
    const matchingSections = findMatchingSections(queryPhrase, index.phrases, fuzzy);
    matchingSections.forEach(sectionId => {
      const currentScore = sectionScores.get(sectionId) || 0;
      sectionScores.set(sectionId, currentScore + 2); // Higher score for phrase matches
    });
  }

  // Search full text for exact matches
  index.fullText.forEach((content, sectionId) => {
    const matches = findTextMatches(normalizedQuery, content, wholeWords);
    if (matches.length > 0) {
      const currentScore = sectionScores.get(sectionId) || 0;
      sectionScores.set(sectionId, currentScore + matches.length);
      
      if (includeContext) {
        matchDetails.set(sectionId, matches.map(match => ({
          text: match.text,
          position: match.position,
          length: match.length,
          context: extractContext(content, match.position, match.length),
        })));
      }
    }
  });

  // Apply filters
  const filteredSections = applyFilters(Array.from(sectionScores.keys()), query.filters, index);

  // Create search results
  filteredSections.forEach(sectionId => {
    const section = sections.find(s => s.id === sectionId);
    const metadata = index.metadata.get(sectionId);
    const score = sectionScores.get(sectionId) || 0;
    const matches = matchDetails.get(sectionId) || [];

    if (section && metadata) {
      results.push({
        sectionId,
        title: section.title,
        content: section.content,
        type: section.type,
        score,
        matches,
        highlights: section.highlights,
        tags: section.tags,
        timestamp: section.timestamp,
      });
    }
  });

  // Sort by score (descending)
  results.sort((a, b) => b.score - a.score);

  // Limit results
  const limitedResults = results.slice(0, maxResults);

  // Generate suggestions
  const suggestions = generateSearchSuggestions(normalizedQuery, index);

  // Calculate facets
  const facets = calculateFacets(filteredSections, index);

  const searchTime = Date.now() - startTime;

  logger.debug('Notes search completed', {
    query: query.query,
    totalResults: results.length,
    returnedResults: limitedResults.length,
    searchTime,
  });

  return {
    results: limitedResults,
    totalResults: results.length,
    searchTime,
    suggestions,
    facets,
  };
}

/**
 * Find sections matching a term with optional fuzzy matching
 */
function findMatchingSections(
  term: string,
  indexMap: Map<string, Set<string>>,
  fuzzy: boolean
): string[] {
  const matchingSections = new Set<string>();

  if (indexMap.has(term)) {
    indexMap.get(term)!.forEach(sectionId => matchingSections.add(sectionId));
  }

  if (fuzzy) {
    // Find similar terms using edit distance
    indexMap.forEach((sectionIds, indexedTerm) => {
      if (calculateEditDistance(term, indexedTerm) <= Math.max(1, Math.floor(term.length * 0.2))) {
        sectionIds.forEach(sectionId => matchingSections.add(sectionId));
      }
    });
  }

  return Array.from(matchingSections);
}

/**
 * Find text matches in content
 */
function findTextMatches(
  query: string,
  content: string,
  wholeWords: boolean
): Array<{ text: string; position: number; length: number }> {
  const matches: Array<{ text: string; position: number; length: number }> = [];
  
  let searchPattern: RegExp;
  if (wholeWords) {
    searchPattern = new RegExp(`\\b${escapeRegExp(query)}\\b`, 'gi');
  } else {
    searchPattern = new RegExp(escapeRegExp(query), 'gi');
  }

  let match;
  while ((match = searchPattern.exec(content)) !== null) {
    matches.push({
      text: match[0],
      position: match.index,
      length: match[0].length,
    });
  }

  return matches;
}

/**
 * Extract context around a match
 */
function extractContext(content: string, position: number, length: number, contextSize: number = 100): string {
  const start = Math.max(0, position - contextSize);
  const end = Math.min(content.length, position + length + contextSize);
  
  let context = content.substring(start, end);
  
  // Add ellipsis if truncated
  if (start > 0) context = '...' + context;
  if (end < content.length) context = context + '...';
  
  return context;
}

/**
 * Apply search filters
 */
function applyFilters(
  sectionIds: string[],
  filters: SearchQuery['filters'],
  index: NotesIndex
): string[] {
  if (!filters) return sectionIds;

  let filteredIds = new Set(sectionIds);

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    const tagFilteredIds = new Set<string>();
    filters.tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      if (index.tags.has(normalizedTag)) {
        index.tags.get(normalizedTag)!.forEach(id => {
          if (filteredIds.has(id)) {
            tagFilteredIds.add(id);
          }
        });
      }
    });
    filteredIds = tagFilteredIds;
  }

  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    const categoryFilteredIds = new Set<string>();
    filters.categories.forEach(category => {
      const normalizedCategory = category.toLowerCase();
      if (index.categories.has(normalizedCategory)) {
        index.categories.get(normalizedCategory)!.forEach(id => {
          if (filteredIds.has(id)) {
            categoryFilteredIds.add(id);
          }
        });
      }
    });
    filteredIds = categoryFilteredIds;
  }

  // Filter by section types
  if (filters.sectionTypes && filters.sectionTypes.length > 0) {
    const typeFilteredIds = new Set<string>();
    filters.sectionTypes.forEach(type => {
      if (index.sectionTypes.has(type)) {
        index.sectionTypes.get(type)!.forEach(id => {
          if (filteredIds.has(id)) {
            typeFilteredIds.add(id);
          }
        });
      }
    });
    filteredIds = typeFilteredIds;
  }

  // Filter by timestamp presence
  if (filters.hasTimestamp !== undefined) {
    const timestampFilteredIds = new Set<string>();
    filteredIds.forEach(id => {
      const metadata = index.metadata.get(id);
      const hasTimestamp = metadata && metadata.timestamp;
      if ((filters.hasTimestamp && hasTimestamp) || (!filters.hasTimestamp && !hasTimestamp)) {
        timestampFilteredIds.add(id);
      }
    });
    filteredIds = timestampFilteredIds;
  }

  // Filter by highlights presence
  if (filters.hasHighlights !== undefined) {
    const highlightsFilteredIds = new Set<string>();
    filteredIds.forEach(id => {
      const metadata = index.metadata.get(id);
      const hasHighlights = metadata && metadata.highlights && metadata.highlights.length > 0;
      if ((filters.hasHighlights && hasHighlights) || (!filters.hasHighlights && !hasHighlights)) {
        highlightsFilteredIds.add(id);
      }
    });
    filteredIds = highlightsFilteredIds;
  }

  return Array.from(filteredIds);
}

/**
 * Generate search suggestions based on query and index
 */
function generateSearchSuggestions(query: string, index: NotesIndex): string[] {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase();

  // Find similar keywords
  index.keywords.forEach((_, keyword) => {
    if (keyword.includes(queryLower) && keyword !== queryLower) {
      suggestions.push(keyword);
    }
  });

  // Find similar phrases
  index.phrases.forEach((_, phrase) => {
    if (phrase.includes(queryLower) && phrase !== queryLower) {
      suggestions.push(phrase);
    }
  });

  // Find similar tags
  index.tags.forEach((_, tag) => {
    if (tag.includes(queryLower) && tag !== queryLower) {
      suggestions.push(tag);
    }
  });

  // Sort by relevance and limit
  return suggestions
    .sort((a, b) => {
      const aDistance = calculateEditDistance(queryLower, a);
      const bDistance = calculateEditDistance(queryLower, b);
      return aDistance - bDistance;
    })
    .slice(0, 5);
}

/**
 * Calculate facets for search results
 */
function calculateFacets(
  sectionIds: string[],
  index: NotesIndex
): {
  tags: Record<string, number>;
  categories: Record<string, number>;
  sectionTypes: Record<string, number>;
} {
  const facets = {
    tags: {} as Record<string, number>,
    categories: {} as Record<string, number>,
    sectionTypes: {} as Record<string, number>,
  };

  const sectionIdSet = new Set(sectionIds);

  // Count tags
  index.tags.forEach((sectionIdsForTag, tag) => {
    const count = Array.from(sectionIdsForTag).filter(id => sectionIdSet.has(id)).length;
    if (count > 0) {
      facets.tags[tag] = count;
    }
  });

  // Count categories
  index.categories.forEach((sectionIdsForCategory, category) => {
    const count = Array.from(sectionIdsForCategory).filter(id => sectionIdSet.has(id)).length;
    if (count > 0) {
      facets.categories[category] = count;
    }
  });

  // Count section types
  index.sectionTypes.forEach((sectionIdsForType, type) => {
    const count = Array.from(sectionIdsForType).filter(id => sectionIdSet.has(id)).length;
    if (count > 0) {
      facets.sectionTypes[type] = count;
    }
  });

  return facets;
}

/**
 * Calculate edit distance between two strings (Levenshtein distance)
 */
function calculateEditDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(
  text: string,
  query: string,
  highlightTag: string = 'mark'
): string {
  const terms = query.split(/\s+/).filter(term => term.length > 0);
  let highlightedText = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    highlightedText = highlightedText.replace(regex, `<${highlightTag}>$1</${highlightTag}>`);
  });

  return highlightedText;
}

/**
 * Create annotation for a note section
 */
export function createAnnotation(
  sectionId: string,
  text: string,
  type: 'note' | 'question' | 'important' | 'clarification',
  position: number
): {
  id: string;
  text: string;
  type: string;
  position: number;
  createdAt: string;
} {
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text,
    type,
    position,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Extract key phrases from notes for better searchability
 */
export function extractKeyPhrases(sections: NoteSection[]): string[] {
  const phrases = new Set<string>();
  
  sections.forEach(section => {
    const text = `${section.title} ${section.content}`;
    const words = text.toLowerCase().split(/\s+/);
    
    // Extract 2-3 word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = words.slice(i, i + 2).join(' ').replace(/[^\w\s]/g, '');
      if (twoWordPhrase.length > 6) {
        phrases.add(twoWordPhrase);
      }
      
      if (i < words.length - 2) {
        const threeWordPhrase = words.slice(i, i + 3).join(' ').replace(/[^\w\s]/g, '');
        if (threeWordPhrase.length > 10) {
          phrases.add(threeWordPhrase);
        }
      }
    }
    
    // Add highlights as key phrases
    section.highlights.forEach(highlight => {
      phrases.add(highlight.toLowerCase());
    });
  });
  
  return Array.from(phrases);
}
/
**
 * Enhanced search across user's organized notes
 */
export interface EnhancedSearchRequest {
  userId: string;
  query: string;
  filters?: {
    capsuleIds?: string[];
    categories?: string[];
    tags?: string[];
    difficulty?: ('beginner' | 'intermediate' | 'advanced')[];
    dateRange?: {
      start: string;
      end: string;
    };
    subjects?: string[];
    hasTimestamps?: boolean;
  };
  options?: {
    maxResults?: number;
    searchType?: 'keywords' | 'phrases' | 'semantic';
    includeContent?: boolean;
    sortBy?: 'relevance' | 'date' | 'title' | 'importance';
    groupBy?: 'capsule' | 'category' | 'difficulty';
  };
}

export interface EnhancedSearchResult {
  capsuleId: string;
  videoTitle: string;
  videoId: string;
  sections: Array<{
    section: any;
    relevanceScore: number;
    matchedTerms: string[];
    snippet: string;
  }>;
  totalRelevanceScore: number;
  metadata: {
    category: string;
    tags: string[];
    difficulty: string;
    createdAt: string;
    subjects: string[];
    estimatedReadingTime: number;
  };
}

export interface EnhancedSearchResponse {
  results: EnhancedSearchResult[];
  totalResults: number;
  searchTime: number;
  suggestions: string[];
  facets: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    difficulties: Record<string, number>;
    subjects: Record<string, number>;
  };
  aggregations: {
    totalCapsules: number;
    totalSections: number;
    averageRelevanceScore: number;
    topCategories: Array<{ category: string; count: number }>;
    topTags: Array<{ tag: string; count: number }>;
  };
}

/**
 * Search across all user's organized notes
 */
export async function searchUserNotes(request: EnhancedSearchRequest): Promise<EnhancedSearchResponse> {
  const startTime = Date.now();
  const { userId, query, filters = {}, options = {} } = request;
  const {
    maxResults = 50,
    searchType = 'keywords',
    includeContent = true,
    sortBy = 'relevance',
    groupBy,
  } = options;

  try {
    logger.info('Starting enhanced notes search', {
      userId,
      query,
      filters,
      options,
    });

    // Get user's capsules with organized notes
    const capsules = await getUserCapsulesWithNotes(userId, filters);
    
    if (capsules.length === 0) {
      return {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        suggestions: [],
        facets: { categories: {}, tags: {}, difficulties: {}, subjects: {} },
        aggregations: {
          totalCapsules: 0,
          totalSections: 0,
          averageRelevanceScore: 0,
          topCategories: [],
          topTags: [],
        },
      };
    }

    // Search within each capsule's organized notes
    const searchResults: EnhancedSearchResult[] = [];
    const allSuggestions = new Set<string>();
    const facetCounts = {
      categories: new Map<string, number>(),
      tags: new Map<string, number>(),
      difficulties: new Map<string, number>(),
      subjects: new Map<string, number>(),
    };

    for (const capsule of capsules) {
      if (!capsule.organizedNotes) continue;

      // Search within this capsule's organized notes
      const capsuleSearchResults = searchOrganizedNotes(
        capsule.organizedNotes,
        query,
        {
          searchType,
          maxResults: maxResults * 2, // Get more results per capsule for better ranking
          includeContent,
        }
      );

      if (capsuleSearchResults.length > 0) {
        // Calculate total relevance score for this capsule
        const totalRelevanceScore = capsuleSearchResults.reduce(
          (sum, result) => sum + result.relevanceScore,
          0
        );

        // Create enhanced search result
        const enhancedResult: EnhancedSearchResult = {
          capsuleId: capsule.capsuleId,
          videoTitle: capsule.videoTitle,
          videoId: capsule.videoId,
          sections: capsuleSearchResults.map(result => ({
            ...result,
            snippet: createSnippet(result.section.content, query, 150),
          })),
          totalRelevanceScore,
          metadata: {
            category: capsule.organizedNotes.categorization.primaryCategory,
            tags: capsule.organizedNotes.categorization.tags,
            difficulty: capsule.organizedNotes.metadata.difficulty,
            createdAt: capsule.createdAt,
            subjects: capsule.organizedNotes.categorization.subjects,
            estimatedReadingTime: capsule.organizedNotes.metadata.estimatedReadingTime,
          },
        };

        searchResults.push(enhancedResult);

        // Update facet counts
        updateFacetCounts(facetCounts, enhancedResult);

        // Collect suggestions from search index
        capsule.organizedNotes.searchIndex.keywords.forEach(keyword => {
          if (keyword.includes(query.toLowerCase()) && keyword !== query.toLowerCase()) {
            allSuggestions.add(keyword);
          }
        });
      }
    }

    // Apply additional filters
    const filteredResults = applyEnhancedFilters(searchResults, filters);

    // Sort results
    const sortedResults = sortSearchResults(filteredResults, sortBy);

    // Group results if requested
    const groupedResults = groupBy ? groupSearchResults(sortedResults, groupBy) : sortedResults;

    // Limit results
    const limitedResults = groupedResults.slice(0, maxResults);

    // Generate suggestions
    const suggestions = Array.from(allSuggestions)
      .sort((a, b) => calculateEditDistance(query.toLowerCase(), a) - calculateEditDistance(query.toLowerCase(), b))
      .slice(0, 5);

    // Convert facet counts to objects
    const facets = {
      categories: Object.fromEntries(facetCounts.categories),
      tags: Object.fromEntries(facetCounts.tags),
      difficulties: Object.fromEntries(facetCounts.difficulties),
      subjects: Object.fromEntries(facetCounts.subjects),
    };

    // Calculate aggregations
    const aggregations = calculateAggregations(limitedResults);

    const searchTime = Date.now() - startTime;

    logger.info('Enhanced notes search completed', {
      userId,
      query,
      totalResults: filteredResults.length,
      returnedResults: limitedResults.length,
      searchTime,
    });

    return {
      results: limitedResults,
      totalResults: filteredResults.length,
      searchTime,
      suggestions,
      facets,
      aggregations,
    };
  } catch (error) {
    logger.error('Enhanced notes search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      query,
    });
    throw error;
  }
}

/**
 * Get user's capsules with organized notes
 */
async function getUserCapsulesWithNotes(
  userId: string,
  filters: EnhancedSearchRequest['filters'] = {}
): Promise<Array<{
  capsuleId: string;
  videoTitle: string;
  videoId: string;
  createdAt: string;
  organizedNotes?: OrganizedNotes;
}>> {
  const capsules: Array<{
    capsuleId: string;
    videoTitle: string;
    videoId: string;
    createdAt: string;
    organizedNotes?: OrganizedNotes;
  }> = [];

  try {
    // Query user's capsules
    const queryParams: any = {
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CAPSULE#',
      },
    };

    // Add date range filter if specified
    if (filters.dateRange) {
      queryParams.FilterExpression = '#createdAt BETWEEN :startDate AND :endDate';
      queryParams.ExpressionAttributeNames = { '#createdAt': 'createdAt' };
      queryParams.ExpressionAttributeValues[':startDate'] = filters.dateRange.start;
      queryParams.ExpressionAttributeValues[':endDate'] = filters.dateRange.end;
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    const items = result.Items || [];

    for (const item of items) {
      // Check if capsule has organized notes
      if (item.learningContent?.organizedNotes) {
        const capsule = {
          capsuleId: item.SK.replace('CAPSULE#', ''),
          videoTitle: item.learningContent.organizedNotes.videoTitle || item.videoTitle || 'Unknown Video',
          videoId: item.learningContent.organizedNotes.videoId || item.videoId || '',
          createdAt: item.createdAt,
          organizedNotes: item.learningContent.organizedNotes,
        };

        // Apply capsule-level filters
        if (shouldIncludeCapsule(capsule, filters)) {
          capsules.push(capsule);
        }
      }
    }

    return capsules;
  } catch (error) {
    logger.error('Failed to get user capsules with notes', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return [];
  }
}

/**
 * Check if capsule should be included based on filters
 */
function shouldIncludeCapsule(
  capsule: { capsuleId: string; organizedNotes?: OrganizedNotes },
  filters: EnhancedSearchRequest['filters'] = {}
): boolean {
  if (!capsule.organizedNotes) return false;

  // Filter by capsule IDs
  if (filters.capsuleIds && filters.capsuleIds.length > 0) {
    if (!filters.capsuleIds.includes(capsule.capsuleId)) {
      return false;
    }
  }

  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    const capsuleCategories = [
      capsule.organizedNotes.categorization.primaryCategory,
      ...capsule.organizedNotes.categorization.secondaryCategories,
    ];
    if (!filters.categories.some(cat => capsuleCategories.includes(cat))) {
      return false;
    }
  }

  // Filter by difficulty
  if (filters.difficulty && filters.difficulty.length > 0) {
    if (!filters.difficulty.includes(capsule.organizedNotes.metadata.difficulty)) {
      return false;
    }
  }

  // Filter by subjects
  if (filters.subjects && filters.subjects.length > 0) {
    if (!filters.subjects.some(subject => 
      capsule.organizedNotes!.categorization.subjects.includes(subject)
    )) {
      return false;
    }
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    if (!filters.tags.some(tag => 
      capsule.organizedNotes!.categorization.tags.includes(tag)
    )) {
      return false;
    }
  }

  // Filter by timestamps
  if (filters.hasTimestamps !== undefined) {
    const hasTimestamps = capsule.organizedNotes.sections.some(section => section.timestamp);
    if (filters.hasTimestamps !== hasTimestamps) {
      return false;
    }
  }

  return true;
}

/**
 * Apply additional filters to search results
 */
function applyEnhancedFilters(
  results: EnhancedSearchResult[],
  filters: EnhancedSearchRequest['filters'] = {}
): EnhancedSearchResult[] {
  return results.filter(result => {
    // All capsule-level filtering is already done
    // This is for any additional result-level filtering
    return true;
  });
}

/**
 * Sort search results based on specified criteria
 */
function sortSearchResults(
  results: EnhancedSearchResult[],
  sortBy: string
): EnhancedSearchResult[] {
  switch (sortBy) {
    case 'relevance':
      return results.sort((a, b) => b.totalRelevanceScore - a.totalRelevanceScore);
    case 'date':
      return results.sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime());
    case 'title':
      return results.sort((a, b) => a.videoTitle.localeCompare(b.videoTitle));
    case 'importance':
      return results.sort((a, b) => {
        const aImportance = a.sections.reduce((sum, s) => sum + (s.section.importance || 0), 0);
        const bImportance = b.sections.reduce((sum, s) => sum + (s.section.importance || 0), 0);
        return bImportance - aImportance;
      });
    default:
      return results;
  }
}

/**
 * Group search results by specified criteria
 */
function groupSearchResults(
  results: EnhancedSearchResult[],
  groupBy: string
): EnhancedSearchResult[] {
  // For now, just return sorted results
  // In a full implementation, you might want to restructure the results
  return results;
}

/**
 * Update facet counts based on search result
 */
function updateFacetCounts(
  facetCounts: {
    categories: Map<string, number>;
    tags: Map<string, number>;
    difficulties: Map<string, number>;
    subjects: Map<string, number>;
  },
  result: EnhancedSearchResult
): void {
  // Update category count
  const category = result.metadata.category;
  facetCounts.categories.set(category, (facetCounts.categories.get(category) || 0) + 1);

  // Update difficulty count
  const difficulty = result.metadata.difficulty;
  facetCounts.difficulties.set(difficulty, (facetCounts.difficulties.get(difficulty) || 0) + 1);

  // Update tag counts
  result.metadata.tags.forEach(tag => {
    facetCounts.tags.set(tag, (facetCounts.tags.get(tag) || 0) + 1);
  });

  // Update subject counts
  result.metadata.subjects.forEach(subject => {
    facetCounts.subjects.set(subject, (facetCounts.subjects.get(subject) || 0) + 1);
  });
}

/**
 * Create a snippet from content highlighting the search query
 */
function createSnippet(content: string, query: string, maxLength: number = 150): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Find the first occurrence of the query
  const queryIndex = contentLower.indexOf(queryLower);
  
  if (queryIndex === -1) {
    // If query not found, return beginning of content
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;
  }

  // Calculate snippet boundaries
  const halfLength = Math.floor(maxLength / 2);
  const start = Math.max(0, queryIndex - halfLength);
  const end = Math.min(content.length, start + maxLength);
  
  let snippet = content.substring(start, end);
  
  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  
  return snippet;
}

/**
 * Calculate aggregations for search results
 */
function calculateAggregations(results: EnhancedSearchResult[]): EnhancedSearchResponse['aggregations'] {
  const totalCapsules = results.length;
  const totalSections = results.reduce((sum, result) => sum + result.sections.length, 0);
  const totalRelevanceScore = results.reduce((sum, result) => sum + result.totalRelevanceScore, 0);
  const averageRelevanceScore = totalCapsules > 0 ? totalRelevanceScore / totalCapsules : 0;

  // Calculate top categories
  const categoryCount = new Map<string, number>();
  results.forEach(result => {
    const category = result.metadata.category;
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
  });
  const topCategories = Array.from(categoryCount.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  // Calculate top tags
  const tagCount = new Map<string, number>();
  results.forEach(result => {
    result.metadata.tags.forEach(tag => {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    });
  });
  const topTags = Array.from(tagCount.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalCapsules,
    totalSections,
    averageRelevanceScore,
    topCategories,
    topTags,
  };
}