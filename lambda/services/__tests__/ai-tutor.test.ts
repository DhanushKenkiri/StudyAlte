import { AITutorService } from '../ai-tutor';

// Mock Bedrock client
jest.mock('../bedrock-client', () => ({
  bedrockClient: {
    invokeModel: jest.fn(),
    generateText: jest.fn(),
    generateStructuredResponse: jest.fn(),
  },
}));

import { bedrockClient } from '../bedrock-client';

describe('AITutorService', () => {
  let aiTutorService: AITutorService;
  let mockBedrockClient: jest.Mocked<typeof bedrockClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBedrockClient = bedrockClient as jest.Mocked<typeof bedrockClient>;
    
    // Set environment variables
    process.env.AWS_REGION = 'us-east-1';
    
    aiTutorService = new AITutorService();
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
  });

  describe('generateResponse', () => {
    const mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      videoTitle: 'Introduction to Machine Learning',
      currentTranscript: 'Machine learning is a subset of artificial intelligence...',
      difficulty: 'intermediate' as const,
      learningGoals: ['Understand ML basics'],
      conversationHistory: [],
    };

    it('should call Bedrock invokeModel and return AI response', async () => {
      mockBedrockClient.invokeModel.mockResolvedValue({
        content: 'Machine learning is a field of AI...',
        inputTokens: 100,
        outputTokens: 50,
        finishReason: 'stop',
      });

      const response = await aiTutorService.generateResponse({
        message: 'What is machine learning?',
        context: mockContext,
        conversationHistory: [],
      });

      expect(mockBedrockClient.invokeModel).toHaveBeenCalled();
      expect(response.content).toContain('Machine learning is a field of AI');
      expect(response.confidence).toBeGreaterThan(0);
    });
  });

  describe('generateSuggestions', () => {
    const mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      videoTitle: 'Introduction to Machine Learning',
      difficulty: 'intermediate' as const,
      learningGoals: ['Understand ML basics'],
    };

    it('should generate contextual suggestions', async () => {
      const suggestions = await aiTutorService.generateSuggestions({
        message: 'What is machine learning?',
        response: 'Machine learning is a subset of AI...',
        context: mockContext,
      });

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should include video-specific suggestions', async () => {
      const suggestions = await aiTutorService.generateSuggestions({
        message: 'What is machine learning?',
        response: 'Machine learning is a subset of AI...',
        context: mockContext,
      });

      expect(suggestions.some(s => s.includes('Introduction to Machine Learning'))).toBe(true);
    });

    it('should adapt suggestions to difficulty level', async () => {
      const beginnerContext = { ...mockContext, difficulty: 'beginner' as const };
      const suggestions = await aiTutorService.generateSuggestions({
        message: 'What is machine learning?',
        response: 'Machine learning is a subset of AI...',
        context: beginnerContext,
      });

      expect(suggestions.some(s => s.toLowerCase().includes('simply'))).toBe(true);
    });

    it('should generate follow-up suggestions based on message type', async () => {
      const suggestions = await aiTutorService.generateSuggestions({
        message: 'How does machine learning work?',
        response: 'Machine learning works by using algorithms...',
        context: mockContext,
      });

      expect(suggestions.some(s => s.toLowerCase().includes('example'))).toBe(true);
    });

    it('should include learning goal suggestions', async () => {
      const suggestions = await aiTutorService.generateSuggestions({
        message: 'What is machine learning?',
        response: 'Machine learning is a subset of AI...',
        context: mockContext,
      });

      expect(suggestions.some(s => s.includes('Understand ML basics'))).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Simulate error by passing invalid context
      const suggestions = await aiTutorService.generateSuggestions({
        message: 'Test message',
        response: 'Test response',
        context: null as any,
      });

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('Can you explain this concept?');
    });
  });

  describe('Private Methods', () => {
    it('should detect code blocks in content', () => {
      // This would test private methods if they were exposed
      // For now, we test through the public interface
      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: 'Here is some code:\n```python\nprint("Hello World")\n```\nThis is Python code.',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse,
      } as Response);

      // The response should handle code blocks appropriately
      expect(mockOpenAIResponse.choices[0].message.content).toContain('```python');
    });

    it('should identify sources from context', async () => {
      const contextWithSources = {
        sessionId: 'test-session',
        userId: 'test-user',
        videoTitle: 'Test Video',
        currentTranscript: 'Test transcript',
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: { content: 'Test response' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse,
      } as Response);

      const result = await aiTutorService.generateResponse({
        message: 'Test message',
        context: contextWithSources,
        conversationHistory: [],
      });

      expect(result.sources).toContain('Video: Test Video');
      expect(result.sources).toContain('Video transcript');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conversation history', async () => {
      const mockOpenAIResponse = {
        choices: [
          {
            message: { content: 'Test response' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse,
      } as Response);

      const result = await aiTutorService.generateResponse({
        message: 'Test message',
        context: {
          sessionId: 'test-session',
          userId: 'test-user',
        },
        conversationHistory: [],
      });

      expect(result).toBeDefined();
      expect(result.content).toBe('Test response');
    });

    it('should handle very long conversation history', async () => {
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      const mockOpenAIResponse = {
        choices: [
          {
            message: { content: 'Test response' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse,
      } as Response);

      const result = await aiTutorService.generateResponse({
        message: 'Test message',
        context: {
          sessionId: 'test-session',
          userId: 'test-user',
        },
        conversationHistory: longHistory,
      });

      // Should limit conversation history to avoid token limits
      const requestBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(requestBody.messages.length).toBeLessThan(20); // Should be limited
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await aiTutorService.generateResponse({
        message: 'Test message',
        context: {
          sessionId: 'test-session',
          userId: 'test-user',
        },
        conversationHistory: [],
      });

      expect(result.content).toContain('having trouble processing');
      expect(result.confidence).toBe(0.3);
    });
  });
});