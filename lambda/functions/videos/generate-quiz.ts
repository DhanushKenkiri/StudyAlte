import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import OpenAI from 'openai';
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from '../../services/comprehend';
import { validateQuizCollection } from '../../services/quiz-validation';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateQuizRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoUrl: string;
  title?: string;
  options: {
    language?: string;
    questionCount?: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    questionTypes?: ('multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank')[];
    includeExplanations?: boolean;
    adaptiveDifficulty?: boolean;
    timeLimit?: number; // in minutes
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

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank';
  question: string;
  options?: string[]; // For multiple-choice
  correctAnswer: string | string[]; // Can be array for multiple correct answers
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  timeLimit?: number; // in seconds
  tags: string[];
  sourceSegment?: {
    start: number;
    end: number;
    text: string;
  };
  hints?: string[];
  category: string;
}

interface QuizResult {
  quiz: QuizQuestion[];
  totalQuestions: number;
  totalPoints: number;
  estimatedTime: number; // in minutes
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypeDistribution: Record<string, number>;
  difficultyDistribution: Record<string, number>;
  categories: string[];
  adaptiveSettings?: {
    baselineScore: number;
    difficultyProgression: string[];
    adaptiveRules: string[];
  };
}

/**
 * Generate intelligent quiz questions from video content using AI
 */
async function generateQuizHandler(event: GenerateQuizRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting quiz generation', {
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
      throw new Error('No content available for quiz generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoTitle = metadata?.title || event.title || 'Unknown Video';

    // Analyze content with Comprehend for additional insights
    const comprehendAnalysis = await analyzeTextWithComprehend(
      contentSources.transcript || contentSources.summary,
      options.language || 'en'
    );

    // Generate quiz using OpenAI
    const quizResult = await generateQuizWithOpenAI(
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

    // Store quiz in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.quiz = :quiz,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':quiz': {
          ...quizResult,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Quiz generated successfully', {
      userId,
      capsuleId,
      videoId,
      totalQuestions: quizResult.totalQuestions,
      totalPoints: quizResult.totalPoints,
      estimatedTime: quizResult.estimatedTime,
      difficulty: quizResult.difficulty,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        quiz: quizResult,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate quiz', {
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
 * Generate quiz using OpenAI GPT-4
 */
async function generateQuizWithOpenAI(
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
  options: GenerateQuizRequest['options'],
  comprehendAnalysis?: any,
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<QuizResult> {
  const {
    language = 'en',
    questionCount = 10,
    difficulty = 'mixed',
    questionTypes = ['multiple-choice', 'true-false', 'short-answer'],
    includeExplanations = true,
    adaptiveDifficulty = false,
    timeLimit = 15,
  } = options;

  // Extract insights from Comprehend analysis
  let comprehendInsights = '';
  if (comprehendAnalysis) {
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 15);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);
    
    comprehendInsights = `
Key Concepts for Questions:
- Important Terms: ${topKeyPhrases.join(', ')}
- Named Entities: ${Object.entries(entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
`;
  }

  // Calculate question distribution by type
  const typeDistribution = calculateQuestionTypeDistribution(questionTypes, questionCount);
  
  // Calculate difficulty distribution
  const difficultyDistribution = calculateDifficultyDistribution(difficulty, questionCount);

  // Build the prompt
  const prompt = `
You are an expert educational assessment creator specializing in creating effective quiz questions for learning. Create high-quality quiz questions from the following video content.

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

Please create ${questionCount} quiz questions in the following JSON format:
{
  "questions": [
    {
      "type": "multiple-choice|true-false|short-answer|fill-blank",
      "question": "Clear, specific question text",
      "options": ["Option A", "Option B", "Option C", "Option D"], // Only for multiple-choice
      "correctAnswer": "Correct answer or option letter",
      "explanation": "Detailed explanation of why this is correct",
      "difficulty": "easy|medium|hard",
      "points": 1-5,
      "timeLimit": 30-120,
      "tags": ["relevant", "tags"],
      "category": "Category name",
      "hints": ["Optional hint 1", "Optional hint 2"] // Optional
    }
  ]
}

Question Distribution Requirements:
${Object.entries(typeDistribution).map(([type, count]) => `- ${type}: ${count} questions`).join('\n')}

Difficulty Distribution:
${Object.entries(difficultyDistribution).map(([diff, count]) => `- ${diff}: ${count} questions`).join('\n')}

Requirements:
- Write in ${language === 'en' ? 'English' : language}
- Each question should test understanding, not just memorization
- Multiple-choice questions should have 4 options with only one correct answer
- True-false questions should be clearly true or false, not ambiguous
- Short-answer questions should have specific, verifiable answers
- Fill-blank questions should test key terms or concepts
${includeExplanations ? '- Include detailed explanations for all answers' : '- Keep explanations brief'}
- Points should reflect question difficulty (easy: 1-2, medium: 2-3, hard: 3-5)
- Time limits should be appropriate for question complexity
- Ensure questions cover different aspects of the content
- Avoid trick questions or overly specific details
- Make questions practical and applicable
${adaptiveDifficulty ? '- Design questions that can adapt based on previous answers' : ''}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational assessment creator. Always respond with valid JSON format containing well-structured quiz questions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent question quality
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseContent);
    const rawQuestions = result.questions || [];

    // Process and enhance questions
    const processedQuestions = await processQuizQuestions(
      rawQuestions,
      segments,
      options
    );

    // Validate question quality
    const validationResult = validateQuizCollection(processedQuestions);
    
    // Use only valid questions
    const finalQuestions = validationResult.validQuestions;

    // Calculate statistics
    const totalPoints = finalQuestions.reduce((sum, q) => sum + q.points, 0);
    const estimatedTime = Math.ceil(finalQuestions.reduce((sum, q) => sum + (q.timeLimit || 60), 0) / 60);
    
    const questionTypeDistribution = finalQuestions.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const finalDifficultyDistribution = finalQuestions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categories = [...new Set(finalQuestions.map(q => q.category))];

    // Setup adaptive settings if requested
    let adaptiveSettings;
    if (adaptiveDifficulty) {
      adaptiveSettings = {
        baselineScore: 0.7, // 70% baseline for adaptive progression
        difficultyProgression: ['easy', 'medium', 'hard'],
        adaptiveRules: [
          'If score > 80%, increase difficulty',
          'If score < 60%, decrease difficulty',
          'Provide hints after 2 incorrect attempts',
        ],
      };
    }

    return {
      quiz: finalQuestions,
      totalQuestions: finalQuestions.length,
      totalPoints,
      estimatedTime,
      difficulty: difficulty === 'mixed' ? 'mixed' : difficulty,
      questionTypeDistribution,
      difficultyDistribution: finalDifficultyDistribution,
      categories,
      adaptiveSettings,
      qualityValidation: {
        totalGenerated: rawQuestions.length,
        validQuestions: validationResult.validQuestions.length,
        invalidQuestions: validationResult.invalidQuestions.length,
        overallScore: validationResult.overallScore,
        qualityDistribution: validationResult.qualityDistribution,
        recommendations: validationResult.recommendations,
      },
    };
  } catch (error) {
    logger.error('OpenAI quiz generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.transcript.length + content.summary.length,
      options,
    });

    // Fallback to basic quiz generation
    return generateFallbackQuiz(content, metadata, options);
  }
}

/**
 * Process and enhance raw quiz questions from OpenAI
 */
async function processQuizQuestions(
  rawQuestions: any[],
  segments?: Array<{ text: string; start: number; duration: number }>,
  options?: GenerateQuizRequest['options']
): Promise<QuizQuestion[]> {
  const processedQuestions: QuizQuestion[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const rawQuestion = rawQuestions[i];
    
    // Validate required fields
    if (!rawQuestion.question || !rawQuestion.correctAnswer) {
      logger.warn('Skipping invalid quiz question', { index: i, question: rawQuestion });
      continue;
    }

    // Generate unique ID
    const questionId = `question_${Date.now()}_${i}`;

    // Find source segment if available
    const sourceSegment = findSourceSegment(rawQuestion.question, segments);

    // Validate and clean question data
    const processedQuestion: QuizQuestion = {
      id: questionId,
      type: rawQuestion.type || 'multiple-choice',
      question: rawQuestion.question.trim(),
      correctAnswer: rawQuestion.correctAnswer,
      explanation: rawQuestion.explanation || 'No explanation provided.',
      difficulty: rawQuestion.difficulty || 'medium',
      points: Math.max(1, Math.min(5, rawQuestion.points || 2)),
      timeLimit: Math.max(15, Math.min(300, rawQuestion.timeLimit || 60)),
      tags: Array.isArray(rawQuestion.tags) ? rawQuestion.tags : [],
      category: rawQuestion.category || 'General',
      sourceSegment,
    };

    // Add options for multiple-choice questions
    if (processedQuestion.type === 'multiple-choice' && Array.isArray(rawQuestion.options)) {
      processedQuestion.options = rawQuestion.options.slice(0, 4); // Limit to 4 options
    }

    // Add hints if provided
    if (Array.isArray(rawQuestion.hints) && rawQuestion.hints.length > 0) {
      processedQuestion.hints = rawQuestion.hints.slice(0, 3); // Limit to 3 hints
    }

    processedQuestions.push(processedQuestion);
  }

  return processedQuestions;
}

/**
 * Calculate question type distribution
 */
function calculateQuestionTypeDistribution(
  types: string[],
  totalQuestions: number
): Record<string, number> {
  const distribution: Record<string, number> = {};
  const questionsPerType = Math.floor(totalQuestions / types.length);
  const remainder = totalQuestions % types.length;

  types.forEach((type, index) => {
    distribution[type] = questionsPerType + (index < remainder ? 1 : 0);
  });

  return distribution;
}

/**
 * Calculate difficulty distribution
 */
function calculateDifficultyDistribution(
  difficulty: string,
  totalQuestions: number
): Record<string, number> {
  if (difficulty === 'mixed') {
    return {
      easy: Math.ceil(totalQuestions * 0.3),
      medium: Math.ceil(totalQuestions * 0.5),
      hard: Math.floor(totalQuestions * 0.2),
    };
  } else {
    return { [difficulty]: totalQuestions };
  }
}

/**
 * Find the source segment in transcript that relates to the question
 */
function findSourceSegment(
  questionText: string,
  segments?: Array<{ text: string; start: number; duration: number }>
): QuizQuestion['sourceSegment'] {
  if (!segments || segments.length === 0) return undefined;

  const questionWords = questionText.toLowerCase().split(/\s+/);
  let bestMatch = { segment: segments[0], score: 0 };

  for (const segment of segments) {
    const segmentWords = segment.text.toLowerCase().split(/\s+/);
    const commonWords = questionWords.filter(word => 
      word.length > 3 && segmentWords.includes(word)
    );
    const score = commonWords.length / Math.max(questionWords.length, segmentWords.length);

    if (score > bestMatch.score) {
      bestMatch = { segment, score };
    }
  }

  if (bestMatch.score > 0.15) {
    return {
      start: bestMatch.segment.start,
      end: bestMatch.segment.start + bestMatch.segment.duration,
      text: bestMatch.segment.text,
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
 * Generate basic fallback quiz if OpenAI fails
 */
function generateFallbackQuiz(
  content: { transcript: string; summary: string; keyPoints: string[]; topics: string[] },
  metadata: { title: string; description: string },
  options: GenerateQuizRequest['options']
): QuizResult {
  const fallbackQuestions: QuizQuestion[] = [];
  
  // Create questions from key points
  content.keyPoints.forEach((point, index) => {
    if (index < (options.questionCount || 10)) {
      const question: QuizQuestion = {
        id: `fallback_${index}`,
        type: 'short-answer',
        question: `What is the key concept: ${point.substring(0, 50)}...?`,
        correctAnswer: point,
        explanation: `This is one of the main points covered in the video: ${point}`,
        difficulty: 'medium',
        points: 2,
        timeLimit: 60,
        tags: ['key-point'],
        category: 'Key Concepts',
      };
      fallbackQuestions.push(question);
    }
  });

  // Create true/false questions from topics
  content.topics.forEach((topic, index) => {
    if (fallbackQuestions.length < (options.questionCount || 10)) {
      const question: QuizQuestion = {
        id: `fallback_tf_${index}`,
        type: 'true-false',
        question: `The video discusses ${topic}. True or False?`,
        correctAnswer: 'True',
        explanation: `True. ${topic} is one of the main topics covered in "${metadata.title}".`,
        difficulty: 'easy',
        points: 1,
        timeLimit: 30,
        tags: ['topic'],
        category: 'Topics',
      };
      fallbackQuestions.push(question);
    }
  });

  return {
    quiz: fallbackQuestions,
    totalQuestions: fallbackQuestions.length,
    totalPoints: fallbackQuestions.reduce((sum, q) => sum + q.points, 0),
    estimatedTime: Math.ceil(fallbackQuestions.reduce((sum, q) => sum + (q.timeLimit || 60), 0) / 60),
    difficulty: 'mixed',
    questionTypeDistribution: { 'short-answer': 0, 'true-false': 0 },
    difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
    categories: ['Key Concepts', 'Topics'],
  };
}

// Export handler
export const handler = createHandler(generateQuizHandler);