import { YouTubeService } from '../youtubeService';
import { ValidationError } from '../../../types/errors';

// Mock fetch globally
global.fetch = jest.fn();

describe('YouTubeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUrl', () => {
    it('should validate correct YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'https://www.youtube.com/v/dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmRdnEQy8VJqQzNYaYzOzZyYzZQzQ',
      ];

      validUrls.forEach(url => {
        expect(YouTubeService.validateUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'https://vimeo.com/123456789',
        'https://www.dailymotion.com/video/x123456',
        'https://www.youtube.com/',
        'https://www.youtube.com/channel/UC123456',
        'https://www.youtube.com/user/username',
        null,
        undefined,
      ];

      invalidUrls.forEach(url => {
        expect(YouTubeService.validateUrl(url as any)).toBe(false);
      });
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from various YouTube URL formats', () => {
      const testCases = [
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          expected: 'dQw4w9WgXcQ',
        },
        {
          url: 'https://youtu.be/dQw4w9WgXcQ',
          expected: 'dQw4w9WgXcQ',
        },
        {
          url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          expected: 'dQw4w9WgXcQ',
        },
        {
          url: 'https://www.youtube.com/v/dQw4w9WgXcQ',
          expected: 'dQw4w9WgXcQ',
        },
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
          expected: 'dQw4w9WgXcQ',
        },
      ];

      testCases.forEach(({ url, expected }) => {
        expect(YouTubeService.extractVideoId(url)).toBe(expected);
      });
    });

    it('should throw ValidationError for invalid URLs', () => {
      const invalidUrls = [
        'https://vimeo.com/123456789',
        'not-a-url',
        'https://www.youtube.com/',
      ];

      invalidUrls.forEach(url => {
        expect(() => YouTubeService.extractVideoId(url)).toThrow(ValidationError);
      });
    });
  });

  describe('getVideoMetadata', () => {
    const mockApiResponse = {
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

    it('should fetch and transform video metadata successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const metadata = await YouTubeService.getVideoMetadata('dQw4w9WgXcQ', 'test-api-key');

      expect(metadata).toEqual({
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        description: 'The official video for "Never Gonna Give You Up" by Rick Astley',
        duration: 213, // 3 minutes 33 seconds
        thumbnail: {
          default: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
          medium: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          high: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          standard: undefined,
          maxres: undefined,
        },
        channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
        channelTitle: 'Rick Astley',
        publishedAt: '2009-10-25T06:57:33Z',
        viewCount: 1000000000,
        likeCount: 10000000,
        commentCount: 1000000,
        tags: ['Rick Astley', 'Never Gonna Give You Up', 'Official Video'],
        categoryId: '10',
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en',
        liveBroadcastContent: 'none',
        embeddable: true,
        publicStatsViewable: true,
      });
    });

    it('should throw error when API key is missing', async () => {
      await expect(YouTubeService.getVideoMetadata('dQw4w9WgXcQ', '')).rejects.toThrow(
        'YouTube API key is required'
      );
    });

    it('should throw ValidationError when video is not found', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await expect(YouTubeService.getVideoMetadata('invalid-id', 'test-api-key')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when video is private', async () => {
      const privateVideoResponse = {
        items: [
          {
            ...mockApiResponse.items[0],
            status: {
              ...mockApiResponse.items[0].status,
              privacyStatus: 'private',
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => privateVideoResponse,
      });

      await expect(YouTubeService.getVideoMetadata('private-id', 'test-api-key')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when video is not embeddable', async () => {
      const nonEmbeddableResponse = {
        items: [
          {
            ...mockApiResponse.items[0],
            status: {
              ...mockApiResponse.items[0].status,
              embeddable: false,
            },
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => nonEmbeddableResponse,
      });

      await expect(YouTubeService.getVideoMetadata('non-embeddable-id', 'test-api-key')).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle API quota exceeded error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(YouTubeService.getVideoMetadata('dQw4w9WgXcQ', 'test-api-key')).rejects.toThrow(
        'YouTube API quota exceeded or invalid API key'
      );
    });

    it('should handle 404 error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(YouTubeService.getVideoMetadata('dQw4w9WgXcQ', 'test-api-key')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('validateVideoForProcessing', () => {
    const baseMetadata = {
      videoId: 'test-id',
      title: 'Test Video',
      description: 'Test description',
      duration: 300, // 5 minutes
      thumbnail: {
        default: 'default.jpg',
        medium: 'medium.jpg',
        high: 'high.jpg',
      },
      channelId: 'test-channel',
      channelTitle: 'Test Channel',
      publishedAt: '2023-01-01T00:00:00Z',
      viewCount: 1000,
      tags: ['test'],
      categoryId: '1',
      liveBroadcastContent: 'none' as const,
      embeddable: true,
      publicStatsViewable: true,
    };

    it('should validate normal video successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, metadata: baseMetadata }),
      });

      const result = await YouTubeService.validateVideoForProcessing(
        'https://www.youtube.com/watch?v=test-id',
        'test-api-key'
      );

      expect(result.valid).toBe(true);
      expect(result.metadata).toBeDefined();
    });

    it('should reject video that is too long', async () => {
      const longVideo = { ...baseMetadata, duration: 15000 }; // > 4 hours
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, metadata: longVideo, error: 'Video is too long (maximum 4 hours)' }),
      });

      const result = await YouTubeService.validateVideoForProcessing(
        'https://www.youtube.com/watch?v=long-video',
        'test-api-key'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject video that is too short', async () => {
      const shortVideo = { ...baseMetadata, duration: 20 }; // < 30 seconds
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, metadata: shortVideo, error: 'Video is too short (minimum 30 seconds)' }),
      });

      const result = await YouTubeService.validateVideoForProcessing(
        'https://www.youtube.com/watch?v=short-video',
        'test-api-key'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject live streams', async () => {
      const liveVideo = { ...baseMetadata, liveBroadcastContent: 'live' as const };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, metadata: liveVideo, error: 'Live streams cannot be processed' }),
      });

      const result = await YouTubeService.validateVideoForProcessing(
        'https://www.youtube.com/watch?v=live-video',
        'test-api-key'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Live streams');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(YouTubeService.formatDuration(30)).toBe('0:30');
      expect(YouTubeService.formatDuration(90)).toBe('1:30');
      expect(YouTubeService.formatDuration(3661)).toBe('1:01:01');
      expect(YouTubeService.formatDuration(7200)).toBe('2:00:00');
    });
  });

  describe('getThumbnailUrl', () => {
    it('should generate correct thumbnail URLs', () => {
      const videoId = 'dQw4w9WgXcQ';
      
      expect(YouTubeService.getThumbnailUrl(videoId, 'default')).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg'
      );
      expect(YouTubeService.getThumbnailUrl(videoId, 'medium')).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
      );
      expect(YouTubeService.getThumbnailUrl(videoId, 'high')).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      );
      expect(YouTubeService.getThumbnailUrl(videoId, 'maxres')).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
      );
    });

    it('should use high quality as default', () => {
      const videoId = 'dQw4w9WgXcQ';
      expect(YouTubeService.getThumbnailUrl(videoId)).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      );
    });
  });

  describe('hasSubtitles', () => {
    it('should return true when subtitles are available', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { snippet: { language: 'en' } },
            { snippet: { language: 'es' } },
          ],
        }),
      });

      const hasSubtitles = await YouTubeService.hasSubtitles('dQw4w9WgXcQ', 'test-api-key');
      expect(hasSubtitles).toBe(true);
    });

    it('should return false when no subtitles are available', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const hasSubtitles = await YouTubeService.hasSubtitles('dQw4w9WgXcQ', 'test-api-key');
      expect(hasSubtitles).toBe(false);
    });

    it('should return false on API error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const hasSubtitles = await YouTubeService.hasSubtitles('dQw4w9WgXcQ', 'test-api-key');
      expect(hasSubtitles).toBe(false);
    });
  });

  describe('getSubtitleLanguages', () => {
    it('should return available subtitle languages', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { snippet: { language: 'en' } },
            { snippet: { language: 'es' } },
            { snippet: { language: 'fr' } },
          ],
        }),
      });

      const languages = await YouTubeService.getSubtitleLanguages('dQw4w9WgXcQ', 'test-api-key');
      expect(languages).toEqual(['en', 'es', 'fr']);
    });

    it('should return empty array when no subtitles are available', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const languages = await YouTubeService.getSubtitleLanguages('dQw4w9WgXcQ', 'test-api-key');
      expect(languages).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const languages = await YouTubeService.getSubtitleLanguages('dQw4w9WgXcQ', 'test-api-key');
      expect(languages).toEqual([]);
    });
  });
});