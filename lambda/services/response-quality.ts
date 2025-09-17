import { Logger } from '../shared/logger';
import { AIResponse } from './ai-tutor';

const logger = new Logger('ResponseQualityService');

export interface FilteredResponse {
  content: string;
  confidence: number;
  sources?: string[];
  relatedConcepts?: string[];
  relatedTopics?: string[];
  suggestedActions?: string[];
  wasFiltered: boolean;
  filterReasons?: string[];
}

export interface FilterContext {
  userId: string;
  sessionId: string;
  originalMessage: string;
}

export class ResponseQualityService {
  private inappropriatePatterns: RegExp[];
  private lowQualityPatterns: RegExp[];
  private minimumConfidenceThreshold: number;
  private maximumResponseLength: number;
  private minimumResponseLength: number;

  constructor() {
    this.minimumConfidenceThreshold = 0.3;
    this.maximumResponseLength = 2000;
    this.minimumResponseLength = 10;

    // Patterns for inappropriate content
    this.inappropriatePatterns = [
      /\b(hate|violence|discrimination)\b/i,
      /\b(illegal|harmful|dangerous)\b/i,
      /\b(personal information|private data)\b/i,
      // Add more patterns as needed
    ];

    // Patterns for low-quality responses
    this.lowQualityPatterns = [
      /^(I don't know|I'm not sure|I can't help)/i,
      /^(Sorry|Apologies).{0,50}$/i,
      /\b(generic|vague|unclear)\b/i,
      // Add more patterns as needed
    ];
  }

  async filterResponse(response: AIResponse, context: FilterContext): Promise<FilteredResponse> {
    try {
      logger.info('Filtering AI response', {
        sessionId: context.sessionId,
        userId: context.userId,
        originalConfidence: response.confidence,
        contentLength: response.content.length,
      });

      const filterReasons: string[] = [];
      let filteredContent = response.content;
      let adjustedConfidence = response.confidence;
      let wasFiltered = false;

      // Check for inappropriate content
      const inappropriateCheck = this.checkInappropriateContent(response.content);
      if (inappropriateCheck.isInappropriate) {
        filteredContent = this.generateSafeAlternative(context.originalMessage);
        adjustedConfidence = 0.2;
        wasFiltered = true;
        filterReasons.push(...inappropriateCheck.reasons);
      }

      // Check response quality
      const qualityCheck = this.checkResponseQuality(response.content, response.confidence);
      if (qualityCheck.isLowQuality) {
        if (!wasFiltered) {
          filteredContent = this.improveResponseQuality(response.content, context);
          wasFiltered = true;
        }
        adjustedConfidence = Math.min(adjustedConfidence, qualityCheck.adjustedConfidence);
        filterReasons.push(...qualityCheck.reasons);
      }

      // Check response length
      const lengthCheck = this.checkResponseLength(filteredContent);
      if (lengthCheck.needsAdjustment) {
        filteredContent = lengthCheck.adjustedContent;
        wasFiltered = true;
        filterReasons.push(...lengthCheck.reasons);
      }

      // Apply content safety measures
      const safetyCheck = this.applySafetyMeasures(filteredContent, context);
      if (safetyCheck.needsAdjustment) {
        filteredContent = safetyCheck.adjustedContent;
        wasFiltered = true;
        filterReasons.push(...safetyCheck.reasons);
      }

      // Validate educational value
      const educationalCheck = this.validateEducationalValue(filteredContent, context);
      if (!educationalCheck.isEducational) {
        adjustedConfidence = Math.min(adjustedConfidence, 0.5);
        filterReasons.push('Low educational value');
      }

      const filteredResponse: FilteredResponse = {
        content: filteredContent,
        confidence: adjustedConfidence,
        sources: response.sources,
        relatedConcepts: response.relatedConcepts,
        relatedTopics: response.relatedTopics,
        suggestedActions: response.suggestedActions,
        wasFiltered,
        filterReasons: filterReasons.length > 0 ? filterReasons : undefined,
      };

      logger.info('Response filtering completed', {
        sessionId: context.sessionId,
        wasFiltered,
        filterReasonsCount: filterReasons.length,
        finalConfidence: adjustedConfidence,
      });

      return filteredResponse;

    } catch (error) {
      logger.error('Error filtering AI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: context.sessionId,
        userId: context.userId,
      });

      // Return safe fallback response
      return {
        content: this.generateSafeAlternative(context.originalMessage),
        confidence: 0.2,
        wasFiltered: true,
        filterReasons: ['Error during filtering'],
      };
    }
  }

  private checkInappropriateContent(content: string): {
    isInappropriate: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    for (const pattern of this.inappropriatePatterns) {
      if (pattern.test(content)) {
        reasons.push(`Inappropriate content detected: ${pattern.source}`);
      }
    }

    return {
      isInappropriate: reasons.length > 0,
      reasons,
    };
  }

  private checkResponseQuality(content: string, confidence: number): {
    isLowQuality: boolean;
    adjustedConfidence: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let adjustedConfidence = confidence;

    // Check confidence threshold
    if (confidence < this.minimumConfidenceThreshold) {
      reasons.push('Low confidence score');
      adjustedConfidence = Math.min(adjustedConfidence, 0.3);
    }

    // Check for low-quality patterns
    for (const pattern of this.lowQualityPatterns) {
      if (pattern.test(content)) {
        reasons.push(`Low quality pattern detected: ${pattern.source}`);
        adjustedConfidence = Math.min(adjustedConfidence, 0.4);
      }
    }

    // Check for repetitive content
    if (this.isRepetitive(content)) {
      reasons.push('Repetitive content detected');
      adjustedConfidence = Math.min(adjustedConfidence, 0.5);
    }

    // Check for coherence
    if (!this.isCoherent(content)) {
      reasons.push('Incoherent response');
      adjustedConfidence = Math.min(adjustedConfidence, 0.4);
    }

    return {
      isLowQuality: reasons.length > 0,
      adjustedConfidence,
      reasons,
    };
  }

  private checkResponseLength(content: string): {
    needsAdjustment: boolean;
    adjustedContent: string;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let adjustedContent = content;

    if (content.length < this.minimumResponseLength) {
      reasons.push('Response too short');
      adjustedContent = this.expandShortResponse(content);
    } else if (content.length > this.maximumResponseLength) {
      reasons.push('Response too long');
      adjustedContent = this.truncateResponse(content);
    }

    return {
      needsAdjustment: reasons.length > 0,
      adjustedContent,
      reasons,
    };
  }

  private applySafetyMeasures(content: string, context: FilterContext): {
    needsAdjustment: boolean;
    adjustedContent: string;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let adjustedContent = content;

    // Remove any potential personal information patterns
    const personalInfoPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email pattern
      /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number pattern
    ];

    personalInfoPatterns.forEach(pattern => {
      if (pattern.test(adjustedContent)) {
        adjustedContent = adjustedContent.replace(pattern, '[REDACTED]');
        reasons.push('Personal information redacted');
      }
    });

    // Ensure educational focus
    if (!this.hasEducationalFocus(adjustedContent)) {
      adjustedContent = this.addEducationalContext(adjustedContent, context);
      reasons.push('Added educational context');
    }

    return {
      needsAdjustment: reasons.length > 0,
      adjustedContent,
      reasons,
    };
  }

  private validateEducationalValue(content: string, context: FilterContext): {
    isEducational: boolean;
  } {
    // Check for educational indicators
    const educationalIndicators = [
      /\b(learn|understand|concept|explain|example|practice)\b/i,
      /\b(because|therefore|however|moreover|furthermore)\b/i,
      /\b(step|process|method|technique|approach)\b/i,
    ];

    const hasEducationalIndicators = educationalIndicators.some(pattern => 
      pattern.test(content)
    );

    // Check if response addresses the learning context
    const addressesContext = content.length > 50 && 
      !this.isGenericResponse(content);

    return {
      isEducational: hasEducationalIndicators && addressesContext,
    };
  }

  private isRepetitive(content: string): boolean {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return false;

    // Check for repeated sentences or phrases
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    return uniqueSentences.size < sentences.length * 0.8;
  }

  private isCoherent(content: string): boolean {
    // Simple coherence check
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return true;

    // Check for logical flow indicators
    const flowIndicators = /\b(first|second|next|then|finally|however|therefore|because|since|although)\b/i;
    const hasFlow = sentences.some(sentence => flowIndicators.test(sentence));

    // Check for consistent topic (simple word overlap check)
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      if (word.length > 3) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    const repeatedWords = Array.from(wordFreq.values()).filter(count => count > 1);
    const hasConsistentTopic = repeatedWords.length > 0;

    return hasFlow || hasConsistentTopic;
  }

  private isGenericResponse(content: string): boolean {
    const genericPhrases = [
      'I can help you',
      'Let me explain',
      'That\'s a good question',
      'I understand',
      'Thank you for asking',
    ];

    return genericPhrases.some(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  private hasEducationalFocus(content: string): boolean {
    const educationalKeywords = [
      'learn', 'understand', 'concept', 'explain', 'example',
      'practice', 'study', 'knowledge', 'skill', 'technique',
    ];

    const contentLower = content.toLowerCase();
    return educationalKeywords.some(keyword => contentLower.includes(keyword));
  }

  private generateSafeAlternative(originalMessage: string): string {
    return `I understand you're asking about "${originalMessage.substring(0, 50)}${originalMessage.length > 50 ? '...' : ''}". Let me provide you with a helpful educational response. Could you please rephrase your question or ask about a specific learning topic I can assist you with?`;
  }

  private improveResponseQuality(content: string, context: FilterContext): string {
    // Add educational context and structure
    const improved = `Let me help you understand this topic better. ${content}

Would you like me to:
- Provide more examples
- Explain any specific part in more detail
- Create practice questions
- Suggest related topics to explore`;

    return improved;
  }

  private expandShortResponse(content: string): string {
    return `${content}

Let me provide more context to help you understand this better. Would you like me to elaborate on any specific aspect or provide examples to illustrate this concept?`;
  }

  private truncateResponse(content: string): string {
    const maxLength = this.maximumResponseLength - 100;
    const truncated = content.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > maxLength * 0.8) {
      return truncated.substring(0, lastSentenceEnd + 1) + '\n\nWould you like me to continue with more details?';
    }

    return truncated + '...\n\nWould you like me to continue with more details?';
  }

  private addEducationalContext(content: string, context: FilterContext): string {
    return `${content}

This relates to your learning journey. Feel free to ask follow-up questions or request examples to deepen your understanding of this topic.`;
  }

  async reportInappropriateContent(
    content: string,
    context: FilterContext,
    reason: string
  ): Promise<void> {
    try {
      logger.warn('Inappropriate content reported', {
        sessionId: context.sessionId,
        userId: context.userId,
        reason,
        contentLength: content.length,
      });

      // In production, you might want to:
      // 1. Store the report in a database
      // 2. Send alerts to moderators
      // 3. Update content filtering rules
      // 4. Track user behavior patterns

    } catch (error) {
      logger.error('Error reporting inappropriate content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: context.sessionId,
      });
    }
  }

  async getQualityMetrics(sessionId: string): Promise<{
    averageConfidence: number;
    filteredResponsesCount: number;
    totalResponsesCount: number;
    commonFilterReasons: string[];
  }> {
    try {
      // In production, you'd retrieve this from a database
      // For now, return mock data
      return {
        averageConfidence: 0.85,
        filteredResponsesCount: 2,
        totalResponsesCount: 10,
        commonFilterReasons: ['Low confidence score', 'Response too short'],
      };

    } catch (error) {
      logger.error('Error getting quality metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });

      return {
        averageConfidence: 0.0,
        filteredResponsesCount: 0,
        totalResponsesCount: 0,
        commonFilterReasons: [],
      };
    }
  }
}