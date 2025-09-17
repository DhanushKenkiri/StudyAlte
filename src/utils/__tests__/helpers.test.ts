// Tests for helper utilities

import {
  formatDate,
  formatRelativeTime,
  formatDuration,
  parseTimeToSeconds,
  truncateText,
  capitalizeFirst,
  slugify,
  extractInitials,
  formatNumber,
  formatPercentage,
  clamp,
  shuffleArray,
  groupBy,
  uniqueBy,
  sortBy,
  deepClone,
  omit,
  pick,
  isEmpty,
  extractYouTubeVideoId,
  buildQueryString,
  parseQueryString,
  calculateNextReviewDate,
  getDueFlashcards,
  debounce,
  generateId,
} from '../helpers';

describe('Date and Time Utilities', () => {
  test('should format dates correctly', () => {
    const date = new Date('2023-12-25T10:30:00Z');
    
    expect(formatDate(date, 'SHORT')).toMatch(/Dec 25, 2023/);
    expect(formatDate(date, 'LONG')).toMatch(/December 25, 2023/);
    expect(formatDate(date, 'TIME_ONLY')).toMatch(/\d{1,2}:\d{2} [AP]M/);
  });

  test('should format relative time correctly', () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');
    expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');
  });

  test('should format duration correctly', () => {
    expect(formatDuration(30)).toBe('0:30');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  test('should parse time to seconds correctly', () => {
    expect(parseTimeToSeconds('1:30')).toBe(90);
    expect(parseTimeToSeconds('1:01:30')).toBe(3690);
    expect(parseTimeToSeconds('invalid')).toBe(0);
  });
});

describe('String Utilities', () => {
  test('should truncate text correctly', () => {
    const longText = 'This is a very long text that should be truncated';
    
    expect(truncateText(longText, 20)).toBe('This is a very lo...');
    expect(truncateText(longText, 20, '---')).toBe('This is a very l---');
    expect(truncateText('Short', 20)).toBe('Short');
  });

  test('should capitalize first letter correctly', () => {
    expect(capitalizeFirst('hello world')).toBe('Hello world');
    expect(capitalizeFirst('HELLO WORLD')).toBe('Hello world');
    expect(capitalizeFirst('')).toBe('');
  });

  test('should create slugs correctly', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
    expect(slugify('Special@#$Characters')).toBe('specialcharacters');
  });

  test('should extract initials correctly', () => {
    expect(extractInitials('John', 'Doe')).toBe('JD');
    expect(extractInitials('jane', 'smith')).toBe('JS');
  });
});

describe('Number Utilities', () => {
  test('should format numbers correctly', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57');
    expect(formatNumber(1000, 0)).toBe('1,000');
  });

  test('should format percentages correctly', () => {
    expect(formatPercentage(25, 100)).toBe('25.0%');
    expect(formatPercentage(1, 3, 2)).toBe('33.33%');
    expect(formatPercentage(0, 0)).toBe('0%');
  });

  test('should clamp values correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('Array Utilities', () => {
  test('should shuffle array', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled).toEqual(expect.arrayContaining(original));
    expect(original).toEqual([1, 2, 3, 4, 5]); // Original unchanged
  });

  test('should group by key', () => {
    const items = [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
      { category: 'A', value: 3 },
    ];

    const grouped = groupBy(items, 'category');
    
    expect(grouped.A).toHaveLength(2);
    expect(grouped.B).toHaveLength(1);
  });

  test('should remove duplicates by key', () => {
    const items = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 1, name: 'C' },
    ];

    const unique = uniqueBy(items, 'id');
    
    expect(unique).toHaveLength(2);
    expect(unique[0].name).toBe('A');
  });

  test('should sort by key', () => {
    const items = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 },
    ];

    const sortedByName = sortBy(items, 'name');
    const sortedByAgeDesc = sortBy(items, 'age', 'desc');
    
    expect(sortedByName[0].name).toBe('Alice');
    expect(sortedByAgeDesc[0].age).toBe(35);
  });
});

describe('Object Utilities', () => {
  test('should deep clone objects', () => {
    const original = {
      a: 1,
      b: { c: 2, d: [3, 4] },
      e: new Date('2023-01-01'),
    };

    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.e).not.toBe(original.e);
  });

  test('should omit keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(obj, ['b', 'c']);
    
    expect(result).toEqual({ a: 1 });
    expect(obj).toEqual({ a: 1, b: 2, c: 3 }); // Original unchanged
  });

  test('should pick keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = pick(obj, ['a', 'c']);
    
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test('should check if values are empty', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
    expect(isEmpty('text')).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});

describe('URL Utilities', () => {
  test('should extract YouTube video ID', () => {
    const testCases = [
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'invalid-url', expected: null },
    ];

    testCases.forEach(({ url, expected }) => {
      expect(extractYouTubeVideoId(url)).toBe(expected);
    });
  });

  test('should build query string', () => {
    const params = {
      q: 'search term',
      page: 1,
      tags: ['tag1', 'tag2'],
      empty: '',
      null: null,
    };

    const queryString = buildQueryString(params);
    
    expect(queryString).toContain('q=search+term');
    expect(queryString).toContain('page=1');
    expect(queryString).toContain('tags=tag1');
    expect(queryString).toContain('tags=tag2');
    expect(queryString).not.toContain('empty');
    expect(queryString).not.toContain('null');
  });

  test('should parse query string', () => {
    const queryString = 'q=search+term&page=1&tags=tag1&tags=tag2';
    const parsed = parseQueryString(queryString);
    
    expect(parsed.q).toBe('search term');
    expect(parsed.page).toBe('1');
    expect(parsed.tags).toEqual(['tag1', 'tag2']);
  });
});

describe('Spaced Repetition Utilities', () => {
  test('should calculate next review date', () => {
    const baseDate = new Date();
    const nextReview = calculateNextReviewDate(3, 0, 0); // Normal difficulty, first review
    
    expect(nextReview.getTime()).toBeGreaterThan(baseDate.getTime());
  });

  test('should count due flashcards', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

    const flashcards = [
      { nextReview: past },
      { nextReview: past },
      { nextReview: future },
    ];

    expect(getDueFlashcards(flashcards)).toBe(2);
  });
});

describe('Utility Functions', () => {
  test('should debounce function calls', (done) => {
    let callCount = 0;
    const debouncedFn = debounce(() => {
      callCount++;
    }, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 150);
  });

  test('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});