import { TranscriptService, TranscriptData, TranscriptSegment } from '../transcriptService';
import { ValidationError } from '../../../types/errors';

// Mock fetch globally
global.fetch = jest.fn();

// Mock DOMParser for TTML parsing
global.DOMParser = jest.fn().mockImplementation(() => ({
  parseFromString: jest.fn().mockReturnValue({
    querySelectorAll: jest.fn().mockReturnValue([]),
  }),
}));

describe('TranscriptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractTranscript', () => {
    const mockCaptionsResponse = {
      items: [
        {
          id: 'caption-track-1',
          snippet: {
            language: 'en',
            name: 'English',
            audioTrackType: 'primary',
            isCC: false,
            isLarge: false,
            isEasyReader: false,
            isDraft: false,
            isAutoSynced: false,
            status: 'serving',
          },
        },
      ],
    };

    const mockTTMLContent = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:00:01.000" end="00:00:05.000">Hello and welcome to this video.</p>
      <p begin="00:00:05.500" end="00:00:10.000">Today we're going to learn about JavaScript.</p>
      <p begin="00:00:10.500" end="00:00:15.000">Let's start with the basics.</p>
    </div>
  </body>
</tt>`;

    it('should extract transcript successfully from YouTube', async () => {
      // Mock captions list API
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCaptionsResponse,
        })
        // Mock caption download API
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockTTMLContent,
        });

      const transcript = await TranscriptService.extractTranscript('test-video-id', 'test-api-key');

      expect(transcript).toBeDefined();
      expect(transcript.videoId).toBe('test-video-id');
      expect(transcript.language).toBe('en');
      expect(transcript.source).toBe('youtube');
      expect(transcript.segments).toHaveLength(3);
      expect(transcript.segments[0].text).toBe('Hello and welcome to this video.');
      expect(transcript.segments[0].start).toBe(1);
      expect(transcript.segments[0].end).toBe(5);
      expect(transcript.fullText).toContain('Hello and welcome');
    });

    it('should handle missing captions gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await expect(
        TranscriptService.extractTranscript('test-video-id', 'test-api-key', {
          fallbackToTranscribe: false,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle API errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(
        TranscriptService.extractTranscript('test-video-id', 'test-api-key')
      ).rejects.toThrow('YouTube API quota exceeded');
    });

    it('should fallback to different language if requested language not available', async () => {
      const multiLanguageCaptions = {
        items: [
          {
            id: 'caption-track-1',
            snippet: { language: 'en', name: 'English' },
          },
          {
            id: 'caption-track-2',
            snippet: { language: 'es', name: 'Spanish' },
          },
        ],
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => multiLanguageCaptions,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockTTMLContent,
        });

      const transcript = await TranscriptService.extractTranscript('test-video-id', 'test-api-key', {
        language: 'fr', // Request French, should fallback to English
      });

      expect(transcript.language).toBe('en'); // Should fallback to English
    });

    it('should clean text when requested', async () => {
      const dirtyTTMLContent = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:00:01.000" end="00:00:05.000">hello   and   welcome [Music] to this video.</p>
      <p begin="00:00:05.500" end="00:00:10.000">today   im   going   to   learn   about   javascript.</p>
    </div>
  </body>
</tt>`;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCaptionsResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => dirtyTTMLContent,
        });

      const transcript = await TranscriptService.extractTranscript('test-video-id', 'test-api-key', {
        cleanText: true,
      });

      expect(transcript.segments[0].text).toBe('hello and welcome to this video.');
      expect(transcript.segments[1].text).toBe("today I'm going to learn about javascript.");
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return available languages', async () => {
      const mockResponse = {
        items: [
          { snippet: { language: 'en' } },
          { snippet: { language: 'es' } },
          { snippet: { language: 'fr' } },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const languages = await TranscriptService.getAvailableLanguages('test-video-id', 'test-api-key');

      expect(languages).toEqual(['en', 'es', 'fr']);
    });

    it('should return empty array when no captions available', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const languages = await TranscriptService.getAvailableLanguages('test-video-id', 'test-api-key');

      expect(languages).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const languages = await TranscriptService.getAvailableLanguages('test-video-id', 'test-api-key');

      expect(languages).toEqual([]);
    });
  });

  describe('isTranscriptAvailable', () => {
    it('should return true when transcript is available', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ snippet: { language: 'en' } }] }),
      });

      const isAvailable = await TranscriptService.isTranscriptAvailable('test-video-id', 'test-api-key');

      expect(isAvailable).toBe(true);
    });

    it('should return false when no transcript is available', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const isAvailable = await TranscriptService.isTranscriptAvailable('test-video-id', 'test-api-key');

      expect(isAvailable).toBe(false);
    });
  });

  describe('searchTranscript', () => {
    const mockTranscript: TranscriptData = {
      videoId: 'test-id',
      language: 'en',
      segments: [
        { start: 0, end: 5, text: 'Hello world, this is a test.' },
        { start: 5, end: 10, text: 'JavaScript is awesome for testing.' },
        { start: 10, end: 15, text: 'Let me test this function.' },
      ],
      fullText: 'Hello world, this is a test. JavaScript is awesome for testing. Let me test this function.',
      duration: 15,
      source: 'youtube',
      confidence: 0.95,
      extractedAt: '2023-01-01T00:00:00Z',
    };

    it('should find matches in transcript', () => {
      const results = TranscriptService.searchTranscript(mockTranscript, 'test');

      expect(results).toHaveLength(3);
      expect(results[0].segment.text).toBe('Hello world, this is a test.');
      expect(results[1].segment.text).toBe('JavaScript is awesome for testing.');
      expect(results[2].segment.text).toBe('Let me test this function.');
    });

    it('should handle case-insensitive search', () => {
      const results = TranscriptService.searchTranscript(mockTranscript, 'JAVASCRIPT', {
        caseSensitive: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].segment.text).toBe('JavaScript is awesome for testing.');
    });

    it('should handle case-sensitive search', () => {
      const results = TranscriptService.searchTranscript(mockTranscript, 'javascript', {
        caseSensitive: true,
      });

      expect(results).toHaveLength(0);
    });

    it('should handle whole word search', () => {
      const results = TranscriptService.searchTranscript(mockTranscript, 'test', {
        wholeWords: true,
      });

      expect(results).toHaveLength(2); // Should not match "testing"
    });

    it('should return empty array for no matches', () => {
      const results = TranscriptService.searchTranscript(mockTranscript, 'nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('getSegmentAtTime', () => {
    const mockTranscript: TranscriptData = {
      videoId: 'test-id',
      language: 'en',
      segments: [
        { start: 0, end: 5, text: 'First segment' },
        { start: 5, end: 10, text: 'Second segment' },
        { start: 10, end: 15, text: 'Third segment' },
      ],
      fullText: 'First segment Second segment Third segment',
      duration: 15,
      source: 'youtube',
      confidence: 0.95,
      extractedAt: '2023-01-01T00:00:00Z',
    };

    it('should return correct segment for given time', () => {
      const segment = TranscriptService.getSegmentAtTime(mockTranscript, 7);

      expect(segment).toBeDefined();
      expect(segment!.text).toBe('Second segment');
    });

    it('should return null for time outside any segment', () => {
      const segment = TranscriptService.getSegmentAtTime(mockTranscript, 20);

      expect(segment).toBeNull();
    });

    it('should handle edge cases at segment boundaries', () => {
      const segmentAtStart = TranscriptService.getSegmentAtTime(mockTranscript, 5);
      const segmentAtEnd = TranscriptService.getSegmentAtTime(mockTranscript, 10);

      expect(segmentAtStart!.text).toBe('Second segment');
      expect(segmentAtEnd!.text).toBe('Third segment');
    });
  });

  describe('exportTranscript', () => {
    const mockTranscript: TranscriptData = {
      videoId: 'test-id',
      language: 'en',
      segments: [
        { start: 0, end: 5, text: 'Hello world' },
        { start: 5, end: 10, text: 'This is a test' },
      ],
      fullText: 'Hello world This is a test',
      duration: 10,
      source: 'youtube',
      confidence: 0.95,
      extractedAt: '2023-01-01T00:00:00Z',
    };

    it('should export as plain text', () => {
      const result = TranscriptService.exportTranscript(mockTranscript, 'txt');

      expect(result).toBe('Hello world This is a test');
    });

    it('should export as SRT format', () => {
      const result = TranscriptService.exportTranscript(mockTranscript, 'srt');

      expect(result).toContain('1\n00:00:00,000 --> 00:00:05,000\nHello world');
      expect(result).toContain('2\n00:00:05,000 --> 00:00:10,000\nThis is a test');
    });

    it('should export as WebVTT format', () => {
      const result = TranscriptService.exportTranscript(mockTranscript, 'vtt');

      expect(result).toContain('WEBVTT');
      expect(result).toContain('00:00:00.000 --> 00:00:05.000\nHello world');
      expect(result).toContain('00:00:05.000 --> 00:00:10.000\nThis is a test');
    });

    it('should export as JSON format', () => {
      const result = TranscriptService.exportTranscript(mockTranscript, 'json');

      const parsed = JSON.parse(result);
      expect(parsed.videoId).toBe('test-id');
      expect(parsed.segments).toHaveLength(2);
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        TranscriptService.exportTranscript(mockTranscript, 'unsupported' as any);
      }).toThrow('Unsupported export format');
    });
  });

  describe('Text cleaning', () => {
    it('should clean common transcript artifacts', () => {
      const dirtyText = '  hello   world  [Music]  (inaudible)  ';
      // This tests the private cleanTranscriptText method indirectly through extraction
      
      // We can't directly test the private method, but we can test it through the public API
      // by mocking a transcript with dirty text
      const mockTTMLWithDirtyText = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:00:01.000" end="00:00:05.000">  hello   world  [Music]  (inaudible)  </p>
    </div>
  </body>
</tt>`;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 'test', snippet: { language: 'en' } }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockTTMLWithDirtyText,
        });

      return TranscriptService.extractTranscript('test-video-id', 'test-api-key', {
        cleanText: true,
      }).then(transcript => {
        expect(transcript.segments[0].text).toBe('hello world');
      });
    });
  });

  describe('Time parsing', () => {
    // These test the time parsing functionality indirectly through transcript extraction
    it('should parse various time formats correctly', async () => {
      const mockTTMLWithDifferentTimes = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:01:30.500" end="00:01:35.750">Hours, minutes, seconds with milliseconds</p>
      <p begin="01:30.500" end="01:35.750">Minutes, seconds with milliseconds</p>
      <p begin="30.500" end="35.750">Seconds with milliseconds</p>
    </div>
  </body>
</tt>`;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 'test', snippet: { language: 'en' } }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockTTMLWithDifferentTimes,
        });

      const transcript = await TranscriptService.extractTranscript('test-video-id', 'test-api-key');

      expect(transcript.segments[0].start).toBe(90.5); // 1:30.5 = 90.5 seconds
      expect(transcript.segments[1].start).toBe(90.5); // 1:30.5 = 90.5 seconds
      expect(transcript.segments[2].start).toBe(30.5); // 30.5 seconds
    });
  });
});