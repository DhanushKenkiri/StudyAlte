import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../validate-url';

// Mock fetch globally
global.fetch = jest.fn();

// Mock environment variables
process.env.YOUTUBE_API_KEY = 'test-api-key';

describe('Video URL Validation Lambda', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const createMockEvent = (body: any, userId = 'test-user-id'): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/videos/validate',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      authorizer: {
        claims: {
          sub: userId,
          email: 'test@example.com',
        },
      },
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/videos/validate',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2023:00:00:00 +0000',
      requestTimeEpoch: 1672531200000,
      resourceId: 'test-resource-id',
      resourcePath: '/videos/validate',
      stage: 'test',
    },
    resource: '/videos/validate',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=test' }, '');
      event.requestContext.authorizer = null;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toBe('UNAUTHORIZED');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when videoUrl is missing', async () => {
      const event = createMockEvent({});

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBe('VALIDATION_ERROR');
      expect(JSON.parse(result.body).message).toBe('Video URL is required');
    });

    it('should return validation error for invalid URL format', async () => {
      const event = createMockEvent({ videoUrl: 'https://vimeo.com/123456' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('Invalid YouTube URL format');
    });
  });

  describe('YouTube API Integration', () => {
    const mockYouTubeApiResponse = {
      items: [
        {
          id: 'dQw4w9WgXcQ',
          snippet: {
            publishedAt: '2009-10-25T06:57:33Z',
            channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
            title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
            description: 'The official video for "Never Gonna Give You Up" by Rick Astley',
            thumbnails: {
              default: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg', width: 120, height: 90 },
              medium: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', width: 320, height: 180 },
              high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', width: 480, height: 360 },
            },
            channelTitle: 'Rick Astley',
            tags: ['Rick Astley', 'Never Gonna Give You Up', 'Official Video'],
            categoryId: '10',
            liveBroadcastContent: 'none',
            defaultLanguage: 'en',
            defaultAudioLanguage: 'en',
          },
          contentDetails: {
            duration: 'PT3M33S',
            dimension: '2d',
            definition: 'hd',
            caption: 'false',
            licensedContent: true,
          },
          statistics: {
            viewCount: '1000000000',
            likeCount: '10000000',
            commentCount: '1000000',
          },
          status: {
            uploadStatus: 'processed',
            privacyStatus: 'public',
            license: 'youtube',
            embeddable: true,
            publicStatsViewable: true,
            madeForKids: false,
          },
        },
      ],
    };

    it('should successfully validate a valid YouTube video', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockYouTubeApiResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(true);
      expect(responseBody.videoId).toBe('dQw4w9WgXcQ');
      expect(responseBody.metadata).toBeDefined();
      expect(responseBody.metadata.title).toBe('Rick Astley - Never Gonna Give You Up (Official Video)');
      expect(responseBody.metadata.duration).toBe(213); // 3 minutes 33 seconds
    });

    it('should handle video not found error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=invalid-id' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('not found or is private');
    });

    it('should handle private video error', async () => {
      const privateVideoResponse = {
        items: [
          {
            ...mockYouTubeApiResponse.items[0],
            status: {
              ...mockYouTubeApiResponse.items[0].status,
              privacyStatus: 'private',
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => privateVideoResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=private-video' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('must be public');
    });

    it('should handle non-embeddable video error', async () => {
      const nonEmbeddableResponse = {
        items: [
          {
            ...mockYouTubeApiResponse.items[0],
            status: {
              ...mockYouTubeApiResponse.items[0].status,
              embeddable: false,
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => nonEmbeddableResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=non-embeddable' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('embedding is disabled');
    });

    it('should handle YouTube API quota exceeded', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(503);
      expect(JSON.parse(result.body).error).toBe('QUOTA_EXCEEDED');
    });

    it('should handle missing API key', async () => {
      delete process.env.YOUTUBE_API_KEY;

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('CONFIGURATION_ERROR');

      // Restore API key for other tests
      process.env.YOUTUBE_API_KEY = 'test-api-key';
    });
  });

  describe('Video Validation Rules', () => {
    it('should reject videos that are too long', async () => {
      const longVideoResponse = {
        items: [
          {
            ...mockYouTubeApiResponse.items[0],
            contentDetails: {
              ...mockYouTubeApiResponse.items[0].contentDetails,
              duration: 'PT5H0M0S', // 5 hours
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => longVideoResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=long-video' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('too long');
    });

    it('should reject videos that are too short', async () => {
      const shortVideoResponse = {
        items: [
          {
            ...mockYouTubeApiResponse.items[0],
            contentDetails: {
              ...mockYouTubeApiResponse.items[0].contentDetails,
              duration: 'PT20S', // 20 seconds
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => shortVideoResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=short-video' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('too short');
    });

    it('should reject live streams', async () => {
      const liveVideoResponse = {
        items: [
          {
            ...mockYouTubeApiResponse.items[0],
            snippet: {
              ...mockYouTubeApiResponse.items[0].snippet,
              liveBroadcastContent: 'live',
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => liveVideoResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=live-stream' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(false);
      expect(responseBody.error).toContain('Live streams cannot be processed');
    });

    it('should include warnings for potential issues', async () => {
      const longButValidVideoResponse = {
        items: [
          {
            ...mockYouTubeApiResponse.items[0],
            contentDetails: {
              ...mockYouTubeApiResponse.items[0].contentDetails,
              duration: 'PT2H30M0S', // 2.5 hours
            },
            snippet: {
              ...mockYouTubeApiResponse.items[0].snippet,
              defaultLanguage: 'es', // Non-English
              tags: [], // No tags
            },
            statistics: {
              ...mockYouTubeApiResponse.items[0].statistics,
              viewCount: '500', // Low view count
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => longButValidVideoResponse,
      });

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=long-spanish-video' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.valid).toBe(true);
      expect(responseBody.warnings).toBeDefined();
      expect(responseBody.warnings.length).toBeGreaterThan(0);
      expect(responseBody.warnings.some((w: string) => w.includes('Long videos'))).toBe(true);
      expect(responseBody.warnings.some((w: string) => w.includes('Non-English'))).toBe(true);
      expect(responseBody.warnings.some((w: string) => w.includes('no tags'))).toBe(true);
      expect(responseBody.warnings.some((w: string) => w.includes('Low view count'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed request body', async () => {
      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=test' });
      event.body = 'invalid-json';

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('INTERNAL_ERROR');
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const event = createMockEvent({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('API_ERROR');
    });
  });
});