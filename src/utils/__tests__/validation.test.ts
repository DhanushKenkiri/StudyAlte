// Tests for validation utilities

import {
  validateYouTubeUrl,
  extractYouTubeVideoId,
  validateEmail,
  validatePassword,
  loginSchema,
  registerSchema,
  processVideoSchema,
  flashcardSchema,
  searchSchema,
} from '../validation';

describe('YouTube URL Validation', () => {
  test('should validate correct YouTube URLs', () => {
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/v/dQw4w9WgXcQ',
      'http://youtube.com/watch?v=dQw4w9WgXcQ',
    ];

    validUrls.forEach(url => {
      expect(validateYouTubeUrl(url)).toBe(true);
    });
  });

  test('should reject invalid YouTube URLs', () => {
    const invalidUrls = [
      'https://vimeo.com/123456789',
      'https://example.com',
      'not-a-url',
      'https://youtube.com',
      'https://youtube.com/channel/UC123',
    ];

    invalidUrls.forEach(url => {
      expect(validateYouTubeUrl(url)).toBe(false);
    });
  });

  test('should extract video ID from YouTube URLs', () => {
    const testCases = [
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://example.com', expected: null },
    ];

    testCases.forEach(({ url, expected }) => {
      expect(extractYouTubeVideoId(url)).toBe(expected);
    });
  });
});

describe('Email Validation', () => {
  test('should validate correct email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@test-domain.com',
    ];

    validEmails.forEach(email => {
      expect(validateEmail(email)).toBe(true);
    });
  });

  test('should reject invalid email addresses', () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@.com',
      'user..name@example.com',
    ];

    invalidEmails.forEach(email => {
      expect(validateEmail(email)).toBe(false);
    });
  });
});

describe('Password Validation', () => {
  test('should validate strong passwords', () => {
    const strongPasswords = [
      'Password123!',
      'MyStr0ng@Pass',
      'C0mpl3x#P@ssw0rd',
    ];

    strongPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject weak passwords', () => {
    const weakPasswords = [
      { password: 'short', expectedErrors: 4 }, // too short, no uppercase, no number, no special
      { password: 'toolongbutnouppercaseornumberorspecial', expectedErrors: 3 },
      { password: 'NoNumbers!', expectedErrors: 1 },
      { password: 'nonumbers123', expectedErrors: 2 }, // no uppercase, no special
    ];

    weakPasswords.forEach(({ password, expectedErrors }) => {
      const result = validatePassword(password);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(expectedErrors);
    });
  });
});

describe('Login Schema Validation', () => {
  test('should validate correct login data', () => {
    const validLogin = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    expect(() => loginSchema.parse(validLogin)).not.toThrow();
  });

  test('should reject invalid login data', () => {
    const invalidLogins = [
      { email: 'invalid-email', password: 'Password123!' },
      { email: 'test@example.com', password: 'short' },
      { email: '', password: 'Password123!' },
      { email: 'test@example.com', password: '' },
    ];

    invalidLogins.forEach(login => {
      expect(() => loginSchema.parse(login)).toThrow();
    });
  });
});

describe('Register Schema Validation', () => {
  test('should validate correct registration data', () => {
    const validRegistration = {
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    expect(() => registerSchema.parse(validRegistration)).not.toThrow();
  });

  test('should reject mismatched passwords', () => {
    const invalidRegistration = {
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    expect(() => registerSchema.parse(invalidRegistration)).toThrow();
  });

  test('should reject missing required fields', () => {
    const incompleteRegistration = {
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      // Missing firstName and lastName
    };

    expect(() => registerSchema.parse(incompleteRegistration)).toThrow();
  });
});

describe('Process Video Schema Validation', () => {
  test('should validate correct video processing request', () => {
    const validRequest = {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      options: {
        generateFlashcards: true,
        generateQuiz: true,
        difficulty: 'intermediate' as const,
      },
    };

    expect(() => processVideoSchema.parse(validRequest)).not.toThrow();
  });

  test('should reject invalid YouTube URL', () => {
    const invalidRequest = {
      url: 'https://vimeo.com/123456789',
    };

    expect(() => processVideoSchema.parse(invalidRequest)).toThrow();
  });

  test('should allow request without options', () => {
    const minimalRequest = {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    };

    expect(() => processVideoSchema.parse(minimalRequest)).not.toThrow();
  });
});

describe('Flashcard Schema Validation', () => {
  test('should validate correct flashcard data', () => {
    const validFlashcard = {
      front: 'What is the capital of France?',
      back: 'Paris',
      tags: ['geography', 'capitals'],
    };

    expect(() => flashcardSchema.parse(validFlashcard)).not.toThrow();
  });

  test('should reject empty front or back', () => {
    const invalidFlashcards = [
      { front: '', back: 'Paris', tags: [] },
      { front: 'What is the capital of France?', back: '', tags: [] },
    ];

    invalidFlashcards.forEach(flashcard => {
      expect(() => flashcardSchema.parse(flashcard)).toThrow();
    });
  });

  test('should reject too many tags', () => {
    const flashcardWithTooManyTags = {
      front: 'Question',
      back: 'Answer',
      tags: Array(15).fill('tag'), // More than 10 tags
    };

    expect(() => flashcardSchema.parse(flashcardWithTooManyTags)).toThrow();
  });
});

describe('Search Schema Validation', () => {
  test('should validate correct search request', () => {
    const validSearch = {
      query: 'javascript tutorial',
      filters: {
        type: ['capsule', 'flashcard'] as const,
        category: ['programming'],
        difficulty: ['beginner'] as const,
      },
      page: 1,
      limit: 20,
    };

    expect(() => searchSchema.parse(validSearch)).not.toThrow();
  });

  test('should reject empty query', () => {
    const invalidSearch = {
      query: '',
    };

    expect(() => searchSchema.parse(invalidSearch)).toThrow();
  });

  test('should reject invalid page or limit', () => {
    const invalidSearches = [
      { query: 'test', page: 0 }, // Page must be at least 1
      { query: 'test', limit: 0 }, // Limit must be at least 1
      { query: 'test', limit: 200 }, // Limit too high
    ];

    invalidSearches.forEach(search => {
      expect(() => searchSchema.parse(search)).toThrow();
    });
  });
});