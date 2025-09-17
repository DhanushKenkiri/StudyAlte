import { bedrockClient, BedrockMessage } from './bedrock-client';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface EnhancedContext {
  capsuleId?: string;
  videoId?: string;
  videoTitle?: string;
  videoDescription?: string;
  currentTranscript?: string;
  transcriptSegments?: Array<{
    text: string;
    startTime: number;
    endTime: number;
    concepts?: string[];
  }>;
  learningGoals?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  userProfile?: {
    learningStyle?: string;
    previousTopics?: string[];
    strengths?: string[];
    weaknesses?: string[];
  };
  conversationHistory?: ConversationMessage[];
  relatedConcepts?: string[];
  keyTerms?: string[];
  sessionId: string;
  userId: string;
}

export interface AIResponse {
  content: string;
  confidence: number;
  sources?: string[];
  relatedConcepts?: string[];
  relatedTopics?: string[];
  suggestedActions?: string[];
  reasoning?: string;
}

export interface GenerateResponseRequest {
  message: string;
  context: EnhancedContext;
  conversationHistory: ConversationMessage[];
}

export interface GenerateSuggestionsRequest {
  message: string;
  response: string;
  context: EnhancedContext;
}

export class AITutorService {
  constructor() {
    // AI Tutor Service initialized with Bedrock client
  }

  async generateResponse(request: GenerateResponseRequest): Promise<AIResponse> {
    const { message, context, conversationHistory } = request;
    
    try {
      // Build system prompt based on context
      const systemPrompt = this.buildSystemPrompt(context);
      
      // Build conversation context
      const conversationContext = this.buildConversationContext(conversationHistory, context);
      
      // Prepare messages for Bedrock
      const messages: BedrockMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationContext.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: message },
      ];

      // Call Bedrock API
      const response = await this.callBedrock(messages, context);
      
      // Extract concepts and generate metadata
      const relatedConcepts = await this.extractConcepts(message, response.content, context);
      const sources = this.identifySources(context);
      const suggestedActions = this.generateSuggestedActions(message, response.content, context);

      const aiResponse: AIResponse = {
        content: response.content,
        confidence: response.confidence,
        sources,
        relatedConcepts,
        relatedTopics: this.extractRelatedTopics(response.content, context),
        suggestedActions,
        reasoning: response.reasoning,
      };

      return aiResponse;

    } catch (error) {
      // Return fallback response
      return this.getFallbackResponse(message, context);
    }
  }

  async generateSuggestions(request: GenerateSuggestionsRequest): Promise<string[]> {
    const { message, response, context } = request;
    
    try {
      const suggestions = [
        ...this.generateContextualSuggestions(context),
        ...this.generateFollowUpSuggestions(message, response),
        ...this.generateLearningGoalSuggestions(context),
      ];

      // Remove duplicates and limit to reasonable number
      const uniqueSuggestions = Array.from(new Set(suggestions));
      return uniqueSuggestions.slice(0, 5);

    } catch (error) {
      return this.getDefaultSuggestions(context);
    }
  }

  private buildSystemPrompt(context: EnhancedContext): string {
    const difficulty = context.difficulty || 'intermediate';
    const hasVideo = !!context.videoTitle;
    const hasTranscript = !!context.currentTranscript;
    
    let prompt = `You are an AI learning assistant specialized in helping students understand educational content. `;
    
    if (hasVideo) {
      prompt += `The student is currently learning from a video titled "${context.videoTitle}". `;
    }
    
    if (hasTranscript) {
      prompt += `You have access to the video transcript to provide accurate, contextual responses. `;
    }
    
    prompt += `\n\nYour role:
- Provide clear, accurate explanations tailored to ${difficulty} level
- Use examples and analogies to make complex concepts understandable
- Encourage active learning through questions and exercises
- Reference specific parts of the content when relevant
- Adapt your teaching style to the student's needs
- Be patient, supportive, and encouraging

Guidelines:
- Keep responses concise but comprehensive
- Use simple language for beginners, more technical terms for advanced learners
- Always verify information against the provided context
- If you're unsure about something, acknowledge it honestly
- Encourage critical thinking and deeper exploration
- Provide practical applications when possible`;

    if (context.learningGoals && context.learningGoals.length > 0) {
      prompt += `\n\nStudent's learning goals: ${context.learningGoals.join(', ')}`;
    }

    if (context.currentTranscript) {
      prompt += `\n\nVideo transcript excerpt:\n${context.currentTranscript.substring(0, 2000)}`;
    }

    return prompt;
  }

  private buildConversationContext(
    history: ConversationMessage[],
    context: EnhancedContext
  ): Array<{ role: string; content: string }> {
    // Include last few messages for context, but not too many to avoid token limits
    const recentHistory = history.slice(-6);
    
    return recentHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }

  private async callBedrock(
    messages: BedrockMessage[],
    context: EnhancedContext
  ): Promise<{ content: string; confidence: number; reasoning?: string }> {
    try {
      const response = await bedrockClient.invokeModel(messages, {
        maxTokens: 1000,
        temperature: 0.7
      });

      // Calculate confidence based on response quality indicators
      const confidence = this.calculateConfidence(response.content, context);

      return {
        content: response.content,
        confidence,
        reasoning: response.finishReason,
      };
    } catch (error: any) {
      throw new Error(`Bedrock API error: ${error.message}`);
    }
  }

  private calculateConfidence(content: string, context: EnhancedContext): number {
    let confidence = 0.8; // Base confidence
    
    // Increase confidence if response references context
    if (context.currentTranscript && this.referencesTranscript(content, context.currentTranscript)) {
      confidence += 0.1;
    }
    
    // Increase confidence if response is well-structured
    if (this.isWellStructured(content)) {
      confidence += 0.05;
    }
    
    // Decrease confidence if response is very short or generic
    if (content.length < 50) {
      confidence -= 0.2;
    }
    
    // Ensure confidence is within bounds
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private referencesTranscript(content: string, transcript: string): boolean {
    // Simple check for common words/phrases from transcript
    const transcriptWords = transcript.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    const commonWords = transcriptWords.filter(word => 
      word.length > 4 && contentWords.includes(word)
    );
    
    return commonWords.length > 2;
  }

  private isWellStructured(content: string): boolean {
    // Check for structure indicators
    const hasListItems = /[-*•]\s/.test(content) || /\d+\.\s/.test(content);
    const hasMultipleSentences = (content.match(/[.!?]/g) || []).length > 1;
    const hasReasonableLength = content.length > 100 && content.length < 2000;
    
    return hasListItems || (hasMultipleSentences && hasReasonableLength);
  }

  private async extractConcepts(
    message: string,
    response: string,
    context: EnhancedContext
  ): Promise<string[]> {
    // Extract key concepts from the response
    const concepts: string[] = [];
    
    // Add concepts from context if available
    if (context.relatedConcepts) {
      concepts.push(...context.relatedConcepts);
    }
    
    // Simple keyword extraction (in production, use more sophisticated NLP)
    const text = `${message} ${response}`.toLowerCase();
    const commonConcepts = [
      'machine learning', 'neural network', 'algorithm', 'data science',
      'artificial intelligence', 'deep learning', 'programming', 'software',
      'database', 'api', 'framework', 'library', 'function', 'variable',
      'class', 'object', 'method', 'array', 'string', 'integer',
    ];
    
    commonConcepts.forEach(concept => {
      if (text.includes(concept) && !concepts.includes(concept)) {
        concepts.push(concept);
      }
    });
    
    return concepts.slice(0, 5); // Limit to 5 concepts
  }

  private identifySources(context: EnhancedContext): string[] {
    const sources: string[] = [];
    
    if (context.videoTitle) {
      sources.push(`Video: ${context.videoTitle}`);
    }
    
    if (context.currentTranscript) {
      sources.push('Video transcript');
    }
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      sources.push('Previous conversation');
    }
    
    return sources;
  }

  private generateSuggestedActions(
    message: string,
    response: string,
    context: EnhancedContext
  ): string[] {
    const actions: string[] = [];
    
    // Context-based suggestions
    if (context.currentTranscript) {
      actions.push('Review transcript section');
    }
    
    if (context.learningGoals && context.learningGoals.length > 0) {
      actions.push('Practice with examples');
      actions.push('Take a quiz on this topic');
    }
    
    // Response-based suggestions
    if (response.includes('example') || response.includes('practice')) {
      actions.push('Try a hands-on exercise');
    }
    
    if (response.includes('concept') || response.includes('theory')) {
      actions.push('Explore related concepts');
    }
    
    return actions.slice(0, 3);
  }

  private extractRelatedTopics(response: string, context: EnhancedContext): string[] {
    // Extract related topics mentioned in the response
    const topics: string[] = [];
    
    // Simple topic extraction based on common patterns
    const topicPatterns = [
      /related to (\w+(?:\s+\w+)*)/gi,
      /similar to (\w+(?:\s+\w+)*)/gi,
      /also known as (\w+(?:\s+\w+)*)/gi,
    ];
    
    topicPatterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const topic = match.replace(pattern, '$1').trim();
          if (topic && !topics.includes(topic)) {
            topics.push(topic);
          }
        });
      }
    });
    
    return topics.slice(0, 3);
  }

  private generateContextualSuggestions(context: EnhancedContext): string[] {
    const suggestions: string[] = [];
    
    if (context.videoTitle) {
      suggestions.push(`Tell me more about ${context.videoTitle}`);
    }
    
    if (context.currentTranscript) {
      suggestions.push('Explain this part of the video');
      suggestions.push('What are the key takeaways?');
    }
    
    if (context.difficulty === 'beginner') {
      suggestions.push('Can you explain this more simply?');
      suggestions.push('What should I learn next?');
    } else if (context.difficulty === 'advanced') {
      suggestions.push('What are the advanced applications?');
      suggestions.push('How does this relate to current research?');
    }
    
    return suggestions;
  }

  private generateFollowUpSuggestions(message: string, response: string): string[] {
    const suggestions: string[] = [];
    
    if (message.toLowerCase().includes('what') || message.toLowerCase().includes('how')) {
      suggestions.push('Can you give me an example?');
      suggestions.push('Why is this important?');
    }
    
    if (response.includes('example') || response.includes('instance')) {
      suggestions.push('Show me another example');
      suggestions.push('How would I apply this?');
    }
    
    return suggestions;
  }

  private generateLearningGoalSuggestions(context: EnhancedContext): string[] {
    const suggestions: string[] = [];
    
    if (context.learningGoals && context.learningGoals.length > 0) {
      context.learningGoals.forEach(goal => {
        suggestions.push(`Help me practice ${goal}`);
      });
    }
    
    suggestions.push('Create a quiz for me');
    suggestions.push('Summarize what we\'ve covered');
    
    return suggestions;
  }

  private getDefaultSuggestions(context: EnhancedContext): string[] {
    return [
      'Can you explain this concept?',
      'Give me an example',
      'What should I learn next?',
      'Help me practice',
      'Summarize the key points',
    ];
  }

  private getFallbackResponse(message: string, context: EnhancedContext): AIResponse {
    const fallbackContent = `I apologize, but I'm having trouble processing your request right now. Could you please rephrase your question or try asking about a specific topic from the ${context.videoTitle || 'content'}?`;
    
    return {
      content: fallbackContent,
      confidence: 0.3,
      sources: context.videoTitle ? [`Video: ${context.videoTitle}`] : [],
      relatedConcepts: [],
      relatedTopics: [],
      suggestedActions: ['Try rephrasing your question', 'Ask about a specific topic'],
    };
  }
}