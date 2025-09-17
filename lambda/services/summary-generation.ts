import { bedrockClient } from './bedrock-client';
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from './comprehend';

export interface SummaryOptions {
  language?: string;
  length?: 'brief' | 'medium' | 'detailed';
  style?: 'academic' | 'casual' | 'technical' | 'educational';
  includeKeyPoints?: boolean;
  includeTopics?: boolean;
  includeTimestamps?: boolean;
  maxLength?: number;
  focusAreas?: string[];
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  topics: string[];
  mainConcepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadingTime: number; // in minutes
  wordCount: number;
  structure: {
    hasIntroduction: boolean;
    hasConclusion: boolean;
    mainSections: number;
  };
  quality: ContentQualityResult;
  metadata: {
    language: string;
    style: string;
    length: string;
    generatedAt: string;
    sourceLength: number;
    compressionRatio: number;
  };
  insights: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    sentiment: string;
    confidence: number;
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
 * Generate intelligent summary from video content using AI
 */
export async function generateSummary(
  transcript: string,
  videoMetadata: VideoMetadata,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  const {
    language = 'en',
    length = 'medium',
    style = 'educational',
    includeKeyPoints = true,
    includeTopics = true,
    includeTimestamps = false,
    maxLength = 1000,
    focusAreas = [],
  } = options;

  try {
    logger.info('Starting summary generation', {
      transcriptLength: transcript.length,
      videoTitle: videoMetadata.title,
      options,
    });

    // Validate input
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is required for summary generation');
    }

    if (transcript.length < 100) {
      throw new Error('Transcript is too short for meaningful summary generation');
    }

    // Analyze content with AWS Comprehend for insights
    const comprehendAnalysis = await analyzeTextWithComprehend(transcript, language);
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 20);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);

    // Generate summary using OpenAI
    const summaryData = await generateSummaryWithOpenAI(
      transcript,
      videoMetadata,
      {
        keyPhrases: topKeyPhrases,
        entities,
        sentiment: comprehendAnalysis.sentiment,
      },
      options
    );

    // Validate content quality
    const qualityResult = await validateContentQuality(summaryData.summary, {
      checkReadability: true,
      checkCoherence: true,
      checkCompleteness: true,
      minLength: 50,
      maxLength: maxLength,
    });

    // Calculate metadata
    const wordCount = summaryData.summary.split(/\s+/).length;
    const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute
    const compressionRatio = transcript.length / summaryData.summary.length;

    // Determine difficulty based on content analysis
    const difficulty = determineDifficulty(
      summaryData.summary,
      topKeyPhrases,
      entities,
      videoMetadata
    );

    // Analyze structure
    const structure = analyzeStructure(summaryData.summary);

    const result: SummaryResult = {
      summary: summaryData.summary,
      keyPoints: summaryData.keyPoints,
      topics: summaryData.topics,
      mainConcepts: summaryData.mainConcepts,
      difficulty,
      estimatedReadingTime,
      wordCount,
      structure,
      quality: qualityResult,
      metadata: {
        language,
        style,
        length,
        generatedAt: new Date().toISOString(),
        sourceLength: transcript.length,
        compressionRatio,
      },
      insights: {
        keyPhrases: topKeyPhrases,
        entities,
        sentiment: comprehendAnalysis.sentiment.sentiment,
        confidence: Math.max(
          ...Object.values(comprehendAnalysis.sentiment.sentimentScore || {}) as number[]
        ),
      },
    };

    return result;
  } catch (error) {
    // Failed to generate summary
    throw error;
  }
}

/**
 * Generate summary using OpenAI GPT-4
 */
async function generateSummaryWithOpenAI(
  transcript: string,
  videoMetadata: VideoMetadata,
  comprehendInsights: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    sentiment: any;
  },
  options: SummaryOptions
): Promise<{
  summary: string;
  keyPoints: string[];
  topics: string[];
  mainConcepts: string[];
}> {
  const {
    language = 'en',
    length = 'medium',
    style = 'educational',
    includeKeyPoints = true,
    includeTopics = true,
    maxLength = 1000,
    focusAreas = [],
  } = options;

  // Build length specifications
  const lengthSpecs = {
    brief: { words: '100-200', sentences: '5-8' },
    medium: { words: '300-500', sentences: '12-20' },
    detailed: { words: '600-1000', sentences: '25-40' },
  };

  const currentLengthSpec = lengthSpecs[length];

  // Build focus areas context
  const focusContext = focusAreas.length > 0 
    ? `\nSpecial focus areas: ${focusAreas.join(', ')}`
    : '';

  // Build insights context
  const insightsContext = `
Content Analysis Insights:
- Key Phrases: ${comprehendInsights.keyPhrases.join(', ')}
- Named Entities: ${Object.entries(comprehendInsights.entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
- Content Sentiment: ${comprehendInsights.sentiment.Sentiment}
`;

  const prompt = `
You are an expert content summarizer specializing in educational video content. Create a comprehensive summary of the following video transcript.

Video Information:
- Title: ${videoMetadata.title}
- Channel: ${videoMetadata.channelTitle}
- Duration: ${Math.round(videoMetadata.duration / 60)} minutes
- Description: ${videoMetadata.description}
- Tags: ${videoMetadata.tags?.join(', ') || 'None'}

${insightsContext}${focusContext}

Transcript to Summarize:
${transcript.substring(0, 8000)}${transcript.length > 8000 ? '...' : ''}

Please create a summary in the following JSON format:
{
  "summary": "Main summary text",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "topics": ["topic 1", "topic 2", "topic 3"],
  "mainConcepts": ["concept 1", "concept 2", "concept 3"]
}

Summary Requirements:
- Length: ${currentLengthSpec.words} words (${currentLengthSpec.sentences} sentences)
- Style: ${style}
- Language: ${language === 'en' ? 'English' : language}
- Maximum length: ${maxLength} words
${includeKeyPoints ? '- Include 5-8 key points that capture the main ideas' : '- Focus on narrative summary without separate key points'}
${includeTopics ? '- Identify 3-6 main topics covered in the content' : '- Integrate topics within the summary text'}

Style Guidelines:
${getStyleGuidelines(style)}

Content Guidelines:
- Capture the essence and main arguments of the video
- Maintain logical flow and coherence
- Include important examples and explanations
- Preserve technical accuracy while making content accessible
- Focus on educational value and key learning outcomes
- Ensure the summary can stand alone without the original video
- Use clear, concise language appropriate for the target audience
- Highlight practical applications and real-world relevance where applicable
`;

  try {
    const systemPrompt = 'You are an expert educational content summarizer. Always respond with valid JSON format containing well-structured summaries.';
    
    const result = await bedrockClient.generateStructuredResponse(
      `${systemPrompt}\n\n${prompt}`,
      JSON.stringify({
        type: 'object',
        properties: {
          summary: { type: 'string' },
          keyPoints: {
            type: 'array',
            items: { type: 'string' }
          },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }),
      {
        temperature: 0.3,
        maxTokens: 2000
      }
    );

    if (!result) {
      throw new Error('No response from Bedrock');
    }

    const summaryData = result as {
      summary?: string;
      keyPoints?: string[];
      topics?: string[];
      mainConcepts?: string[];
    };

    // Validate and clean the response
    return {
      summary: summaryData.summary || '',
      keyPoints: Array.isArray(summaryData.keyPoints) ? summaryData.keyPoints : [],
      topics: Array.isArray(summaryData.topics) ? summaryData.topics : [],
      mainConcepts: Array.isArray(summaryData.mainConcepts) ? summaryData.mainConcepts : [],
    };
  } catch (error) {
    // Bedrock summary generation failed, using fallback
    return generateFallbackSummary(transcript, videoMetadata, options);
  }
}

/**
 * Get style-specific guidelines
 */
function getStyleGuidelines(style: string): string {
  switch (style) {
    case 'academic':
      return `
- Use formal academic language and terminology
- Include proper citations and references where applicable
- Structure with clear thesis and supporting arguments
- Maintain objective, analytical tone
- Include methodology and conclusions where relevant`;

    case 'casual':
      return `
- Use conversational, approachable language
- Include relatable examples and analogies
- Maintain engaging, friendly tone
- Avoid overly technical jargon
- Focus on practical takeaways`;

    case 'technical':
      return `
- Use precise technical terminology
- Include specific details and specifications
- Focus on implementation and methodology
- Maintain accuracy over accessibility
- Include technical context and implications`;

    case 'educational':
    default:
      return `
- Use clear, instructional language
- Include learning objectives and outcomes
- Structure for easy comprehension
- Balance technical accuracy with accessibility
- Focus on knowledge transfer and understanding`;
  }
}

/**
 * Generate fallback summary if OpenAI fails
 */
function generateFallbackSummary(
  transcript: string,
  videoMetadata: VideoMetadata,
  options: SummaryOptions
): {
  summary: string;
  keyPoints: string[];
  topics: string[];
  mainConcepts: string[];
} {
  // Extract first few sentences as basic summary
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const summaryLength = options.length === 'brief' ? 3 : options.length === 'detailed' ? 8 : 5;
  const summary = sentences.slice(0, summaryLength).join('. ') + '.';

  // Extract basic key points (every few sentences)
  const keyPoints = sentences
    .filter((_, index) => index % 3 === 0)
    .slice(0, 6)
    .map(sentence => sentence.trim());

  // Extract topics from video metadata and content
  const topics = [
    ...(videoMetadata.tags || []).slice(0, 3),
    'Main Content',
    'Key Concepts',
  ].slice(0, 5);

  // Extract main concepts (simple word frequency analysis)
  const words = transcript.toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();
  
  words.forEach(word => {
    if (word.length > 4 && !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|boy|did|man|men|put|say|she|too|use)$/.test(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });

  const mainConcepts = Array.from(wordFreq.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);

  return {
    summary,
    keyPoints,
    topics,
    mainConcepts,
  };
}

/**
 * Determine content difficulty based on analysis
 */
function determineDifficulty(
  summary: string,
  keyPhrases: string[],
  entities: Record<string, string[]>,
  videoMetadata: VideoMetadata
): 'beginner' | 'intermediate' | 'advanced' {
  let complexityScore = 0;

  // Analyze vocabulary complexity
  const words = summary.toLowerCase().split(/\s+/);
  const complexWords = words.filter(word => word.length > 8).length;
  const complexityRatio = complexWords / words.length;
  
  if (complexityRatio > 0.15) complexityScore += 2;
  else if (complexityRatio > 0.08) complexityScore += 1;

  // Analyze sentence complexity
  const sentences = summary.split(/[.!?]+/);
  const avgSentenceLength = words.length / sentences.length;
  
  if (avgSentenceLength > 20) complexityScore += 2;
  else if (avgSentenceLength > 15) complexityScore += 1;

  // Analyze technical terms
  const technicalTerms = keyPhrases.filter(phrase => 
    phrase.includes('algorithm') || 
    phrase.includes('method') || 
    phrase.includes('technique') ||
    phrase.includes('analysis') ||
    phrase.includes('implementation')
  ).length;
  
  if (technicalTerms > 3) complexityScore += 2;
  else if (technicalTerms > 1) complexityScore += 1;

  // Analyze entities complexity
  const totalEntities = Object.values(entities).flat().length;
  if (totalEntities > 10) complexityScore += 1;

  // Check video metadata for complexity indicators
  const title = videoMetadata.title.toLowerCase();
  if (title.includes('advanced') || title.includes('expert') || title.includes('professional')) {
    complexityScore += 2;
  } else if (title.includes('intermediate') || title.includes('deep dive')) {
    complexityScore += 1;
  } else if (title.includes('beginner') || title.includes('introduction') || title.includes('basics')) {
    complexityScore -= 1;
  }

  // Determine final difficulty
  if (complexityScore >= 5) return 'advanced';
  if (complexityScore >= 2) return 'intermediate';
  return 'beginner';
}

/**
 * Analyze summary structure
 */
function analyzeStructure(summary: string): {
  hasIntroduction: boolean;
  hasConclusion: boolean;
  mainSections: number;
} {
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Check for introduction patterns
  const firstSentence = sentences[0]?.toLowerCase() || '';
  const hasIntroduction = 
    firstSentence.includes('this video') ||
    firstSentence.includes('in this') ||
    firstSentence.includes('the video covers') ||
    firstSentence.includes('introduction');

  // Check for conclusion patterns
  const lastSentence = sentences[sentences.length - 1]?.toLowerCase() || '';
  const hasConclusion = 
    lastSentence.includes('in conclusion') ||
    lastSentence.includes('to summarize') ||
    lastSentence.includes('overall') ||
    lastSentence.includes('finally');

  // Estimate main sections based on transition words
  const transitionWords = ['first', 'second', 'third', 'next', 'then', 'additionally', 'furthermore', 'moreover', 'however', 'therefore'];
  const mainSections = summary.toLowerCase().split(/\s+/).filter(word => 
    transitionWords.includes(word)
  ).length + 1; // +1 for the implicit first section

  return {
    hasIntroduction,
    hasConclusion,
    mainSections: Math.min(mainSections, 10), // Cap at reasonable number
  };
}

/**
 * Generate multiple summary variations for A/B testing
 */
export async function generateSummaryVariations(
  transcript: string,
  videoMetadata: VideoMetadata,
  baseOptions: SummaryOptions = {}
): Promise<SummaryResult[]> {
  const variations: SummaryOptions[] = [
    { ...baseOptions, style: 'educational', length: 'medium' },
    { ...baseOptions, style: 'casual', length: 'brief' },
    { ...baseOptions, style: 'technical', length: 'detailed' },
  ];

  const results = await Promise.allSettled(
    variations.map(options => generateSummary(transcript, videoMetadata, options))
  );

  return results
    .filter((result): result is PromiseFulfilledResult<SummaryResult> => result.status === 'fulfilled')
    .map(result => result.value);
}

/**
 * Update existing summary with new preferences
 */
export async function updateSummaryStyle(
  existingSummary: SummaryResult,
  newOptions: Partial<SummaryOptions>
): Promise<SummaryResult> {
  // This would typically regenerate with new style preferences
  // For now, return the existing summary with updated metadata
  return {
    ...existingSummary,
    metadata: {
      ...existingSummary.metadata,
      ...newOptions,
      generatedAt: new Date().toISOString(),
    },
  };
}