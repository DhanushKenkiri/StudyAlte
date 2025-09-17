import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';
import { EnhancedContext, ConversationMessage } from './ai-tutor';

const logger = new Logger('ContentContextService');

export interface ContentContext {
  capsuleId?: string;
  videoId?: string;
  currentTranscript?: string;
  learningGoals?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  conversationHistory?: ConversationMessage[];
  sessionId: string;
  userId: string;
}

export interface VideoContent {
  videoId: string;
  title: string;
  description: string;
  transcript: string;
  transcriptSegments: Array<{
    text: string;
    startTime: number;
    endTime: number;
    concepts?: string[];
  }>;
  summary: string;
  keyTerms: string[];
  concepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface LearningCapsule {
  capsuleId: string;
  userId: string;
  videoId: string;
  title: string;
  summary: string;
  flashcards: Array<{
    front: string;
    back: string;
    difficulty: string;
  }>;
  quiz: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
  mindMap: {
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      concepts: string[];
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship: string;
    }>;
  };
  notes: string;
  progress: {
    completed: boolean;
    completionPercentage: number;
    timeSpent: number;
    lastAccessed: string;
  };
}

export interface UserProfile {
  userId: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  strengths: string[];
  weaknesses: string[];
  learningGoals: string[];
  completedTopics: string[];
  currentStreak: number;
  totalStudyTime: number;
}

export class ContentContextService {
  private capsulesTableName: string;
  private videosTableName: string;
  private usersTableName: string;

  constructor(private dynamoClient: DynamoDBDocumentClient) {
    this.capsulesTableName = process.env.LEARNING_CAPSULES_TABLE || 'youtube-learning-capsules';
    this.videosTableName = process.env.VIDEOS_TABLE || 'youtube-learning-videos';
    this.usersTableName = process.env.USERS_TABLE || 'youtube-learning-users';
  }

  async enhanceContext(context: ContentContext): Promise<EnhancedContext> {
    try {
      logger.info('Enhancing conversation context', {
        sessionId: context.sessionId,
        userId: context.userId,
        hasCapsuleId: !!context.capsuleId,
        hasVideoId: !!context.videoId,
      });

      const [videoContent, capsuleContent, userProfile] = await Promise.all([
        context.videoId ? this.getVideoContent(context.videoId) : null,
        context.capsuleId ? this.getLearningCapsule(context.capsuleId, context.userId) : null,
        this.getUserProfile(context.userId),
      ]);

      const enhancedContext: EnhancedContext = {
        ...context,
        sessionId: context.sessionId,
        userId: context.userId,
      };

      // Enhance with video content
      if (videoContent) {
        enhancedContext.videoTitle = videoContent.title;
        enhancedContext.videoDescription = videoContent.description;
        enhancedContext.currentTranscript = context.currentTranscript || videoContent.transcript;
        enhancedContext.transcriptSegments = videoContent.transcriptSegments;
        enhancedContext.relatedConcepts = videoContent.concepts;
        enhancedContext.keyTerms = videoContent.keyTerms;
        enhancedContext.difficulty = context.difficulty || videoContent.difficulty;
      }

      // Enhance with capsule content
      if (capsuleContent) {
        enhancedContext.relatedConcepts = [
          ...(enhancedContext.relatedConcepts || []),
          ...this.extractConceptsFromCapsule(capsuleContent),
        ];
      }

      // Enhance with user profile
      if (userProfile) {
        enhancedContext.userProfile = {
          learningStyle: userProfile.learningStyle,
          previousTopics: userProfile.completedTopics,
          strengths: userProfile.strengths,
          weaknesses: userProfile.weaknesses,
        };
        enhancedContext.learningGoals = context.learningGoals || userProfile.learningGoals;
        enhancedContext.difficulty = context.difficulty || userProfile.preferredDifficulty;
      }

      // Add conversation history
      enhancedContext.conversationHistory = context.conversationHistory || [];

      logger.info('Context enhanced successfully', {
        sessionId: context.sessionId,
        hasVideoContent: !!videoContent,
        hasCapsuleContent: !!capsuleContent,
        hasUserProfile: !!userProfile,
        conceptsCount: enhancedContext.relatedConcepts?.length || 0,
      });

      return enhancedContext;

    } catch (error) {
      logger.error('Error enhancing conversation context', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: context.sessionId,
        userId: context.userId,
      });

      // Return basic context if enhancement fails
      return {
        ...context,
        sessionId: context.sessionId,
        userId: context.userId,
        conversationHistory: context.conversationHistory || [],
      };
    }
  }

  private async getVideoContent(videoId: string): Promise<VideoContent | null> {
    try {
      logger.info('Retrieving video content', { videoId });

      const response = await this.dynamoClient.send(new GetCommand({
        TableName: this.videosTableName,
        Key: {
          PK: `VIDEO#${videoId}`,
          SK: 'METADATA',
        },
      }));

      if (!response.Item) {
        logger.info('Video content not found', { videoId });
        return null;
      }

      const videoContent: VideoContent = {
        videoId: response.Item.videoId,
        title: response.Item.title,
        description: response.Item.description,
        transcript: response.Item.transcript,
        transcriptSegments: response.Item.transcriptSegments || [],
        summary: response.Item.summary,
        keyTerms: response.Item.keyTerms || [],
        concepts: response.Item.concepts || [],
        difficulty: response.Item.difficulty || 'intermediate',
      };

      logger.info('Video content retrieved successfully', {
        videoId,
        hasTranscript: !!videoContent.transcript,
        conceptsCount: videoContent.concepts.length,
      });

      return videoContent;

    } catch (error) {
      logger.error('Error retrieving video content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId,
      });
      return null;
    }
  }

  private async getLearningCapsule(capsuleId: string, userId: string): Promise<LearningCapsule | null> {
    try {
      logger.info('Retrieving learning capsule', { capsuleId, userId });

      const response = await this.dynamoClient.send(new GetCommand({
        TableName: this.capsulesTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CAPSULE#${capsuleId}`,
        },
      }));

      if (!response.Item) {
        logger.info('Learning capsule not found', { capsuleId, userId });
        return null;
      }

      const capsule: LearningCapsule = {
        capsuleId: response.Item.capsuleId,
        userId: response.Item.userId,
        videoId: response.Item.videoId,
        title: response.Item.title,
        summary: response.Item.summary,
        flashcards: response.Item.flashcards || [],
        quiz: response.Item.quiz || [],
        mindMap: response.Item.mindMap || { nodes: [], edges: [] },
        notes: response.Item.notes || '',
        progress: response.Item.progress || {
          completed: false,
          completionPercentage: 0,
          timeSpent: 0,
          lastAccessed: new Date().toISOString(),
        },
      };

      logger.info('Learning capsule retrieved successfully', {
        capsuleId,
        userId,
        hasFlashcards: capsule.flashcards.length > 0,
        hasQuiz: capsule.quiz.length > 0,
      });

      return capsule;

    } catch (error) {
      logger.error('Error retrieving learning capsule', {
        error: error instanceof Error ? error.message : 'Unknown error',
        capsuleId,
        userId,
      });
      return null;
    }
  }

  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      logger.info('Retrieving user profile', { userId });

      const response = await this.dynamoClient.send(new GetCommand({
        TableName: this.usersTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      }));

      if (!response.Item) {
        logger.info('User profile not found', { userId });
        return null;
      }

      const userProfile: UserProfile = {
        userId: response.Item.userId,
        learningStyle: response.Item.learningStyle || 'visual',
        preferredDifficulty: response.Item.preferredDifficulty || 'intermediate',
        interests: response.Item.interests || [],
        strengths: response.Item.strengths || [],
        weaknesses: response.Item.weaknesses || [],
        learningGoals: response.Item.learningGoals || [],
        completedTopics: response.Item.completedTopics || [],
        currentStreak: response.Item.currentStreak || 0,
        totalStudyTime: response.Item.totalStudyTime || 0,
      };

      logger.info('User profile retrieved successfully', {
        userId,
        learningStyle: userProfile.learningStyle,
        goalsCount: userProfile.learningGoals.length,
      });

      return userProfile;

    } catch (error) {
      logger.error('Error retrieving user profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return null;
    }
  }

  private extractConceptsFromCapsule(capsule: LearningCapsule): string[] {
    const concepts: string[] = [];

    // Extract concepts from flashcards
    capsule.flashcards.forEach(card => {
      const cardConcepts = this.extractConceptsFromText(card.front + ' ' + card.back);
      concepts.push(...cardConcepts);
    });

    // Extract concepts from quiz questions
    capsule.quiz.forEach(question => {
      const questionConcepts = this.extractConceptsFromText(
        question.question + ' ' + question.explanation
      );
      concepts.push(...questionConcepts);
    });

    // Extract concepts from mind map nodes
    capsule.mindMap.nodes.forEach(node => {
      if (node.concepts) {
        concepts.push(...node.concepts);
      }
      concepts.push(node.label);
    });

    // Extract concepts from notes
    if (capsule.notes) {
      const notesConcepts = this.extractConceptsFromText(capsule.notes);
      concepts.push(...notesConcepts);
    }

    // Remove duplicates and return
    return Array.from(new Set(concepts)).slice(0, 10);
  }

  private extractConceptsFromText(text: string): string[] {
    // Simple concept extraction - in production, use more sophisticated NLP
    const concepts: string[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Look for technical terms and concepts
    const technicalPatterns = [
      /\b\w+ing\b/, // Words ending in -ing
      /\b\w+tion\b/, // Words ending in -tion
      /\b\w+ment\b/, // Words ending in -ment
      /\b\w+ness\b/, // Words ending in -ness
    ];

    words.forEach(word => {
      if (word.length > 4 && technicalPatterns.some(pattern => pattern.test(word))) {
        concepts.push(word);
      }
    });

    return concepts.slice(0, 5);
  }

  async getRelatedContent(
    userId: string,
    concepts: string[],
    limit: number = 5
  ): Promise<Array<{ type: 'video' | 'capsule'; id: string; title: string; relevance: number }>> {
    try {
      logger.info('Finding related content', {
        userId,
        conceptsCount: concepts.length,
        limit,
      });

      // This is a simplified implementation
      // In production, you'd use more sophisticated content recommendation algorithms
      const relatedContent: Array<{ type: 'video' | 'capsule'; id: string; title: string; relevance: number }> = [];

      // Search for related capsules
      const capsulesResponse = await this.dynamoClient.send(new QueryCommand({
        TableName: this.capsulesTableName,
        KeyConditionExpression: 'PK = :userPK',
        ExpressionAttributeValues: {
          ':userPK': `USER#${userId}`,
        },
        Limit: limit,
      }));

      (capsulesResponse.Items || []).forEach(item => {
        const relevance = this.calculateRelevance(concepts, item.summary || '');
        if (relevance > 0.3) {
          relatedContent.push({
            type: 'capsule',
            id: item.capsuleId,
            title: item.title,
            relevance,
          });
        }
      });

      // Sort by relevance and limit results
      relatedContent.sort((a, b) => b.relevance - a.relevance);
      const limitedContent = relatedContent.slice(0, limit);

      logger.info('Related content found', {
        userId,
        resultCount: limitedContent.length,
      });

      return limitedContent;

    } catch (error) {
      logger.error('Error finding related content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  private calculateRelevance(concepts: string[], text: string): number {
    const textLower = text.toLowerCase();
    const matchingConcepts = concepts.filter(concept => 
      textLower.includes(concept.toLowerCase())
    );
    
    return matchingConcepts.length / concepts.length;
  }

  async updateUserLearningProgress(
    userId: string,
    concepts: string[],
    difficulty: string,
    timeSpent: number
  ): Promise<void> {
    try {
      logger.info('Updating user learning progress', {
        userId,
        conceptsCount: concepts.length,
        difficulty,
        timeSpent,
      });

      // Update user's completed topics and study time
      // This is a simplified implementation
      await this.dynamoClient.send(new GetCommand({
        TableName: this.usersTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      }));

      // In a real implementation, you'd update the user's learning progress
      // based on the concepts they've engaged with and their performance

      logger.info('User learning progress updated', { userId });

    } catch (error) {
      logger.error('Error updating user learning progress', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      // Don't throw error as this is not critical for the chat functionality
    }
  }
}