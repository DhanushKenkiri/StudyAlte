import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlashcardStudy } from '../FlashcardStudy';

// Mock the FlashcardComponent
jest.mock('../FlashcardComponent', () => ({
  FlashcardComponent: ({ card, isFlipped, onFlip, onResponse, showResponse }: any) => (
    <div data-testid="flashcard-component">
      <div data-testid="card-front">{card.front}</div>
      {isFlipped && <div data-testid="card-back">{card.back}</div>}
      <button onClick={onFlip}>Flip Card</button>
      {showResponse && (
        <div>
          <button onClick={() => onResponse('correct')}>Correct</button>
          <button onClick={() => onResponse('incorrect')}>Incorrect</button>
          <button onClick={() => onResponse('hard')}>Hard</button>
        </div>
      )}
    </div>
  ),
}));

// Mock the StudySessionStats component
jest.mock('../StudySessionStats', () => ({
  StudySessionStats: ({ cardsStudied, correctAnswers, totalTime }: any) => (
    <div data-testid="study-session-stats">
      <div>Cards: {cardsStudied}</div>
      <div>Correct: {correctAnswers}</div>
      <div>Time: {totalTime}</div>
    </div>
  ),
}));

// Mock the SpacedRepetitionScheduler
jest.mock('../../services/spaced-repetition/SpacedRepetitionScheduler', () => ({
  SpacedRepetitionScheduler: jest.fn().mockImplementation(() => ({
    updateCard: jest.fn((card, response) => ({
      ...card,
      reviewCount: card.reviewCount + 1,
      correctCount: card.correctCount + (response === 'correct' ? 1 : 0),
    })),
  })),
}));

const mockFlashcards = [
  {
    id: 'card-1',
    front: 'What is React?',
    back: 'A JavaScript library for building user interfaces',
    difficulty: 'medium' as const,
    tags: ['react', 'javascript'],
    reviewCount: 0,
    correctCount: 0,
    interval: 1,
    easeFactor: 2.5,
  },
  {
    id: 'card-2',
    front: 'What is JSX?',
    back: 'A syntax extension for JavaScript',
    difficulty: 'easy' as const,
    tags: ['react', 'jsx'],
    reviewCount: 2,
    correctCount: 1,
    interval: 3,
    easeFactor: 2.2,
  },
  {
    id: 'card-3',
    front: 'What is a component?',
    back: 'A reusable piece of UI',
    difficulty: 'hard' as const,
    tags: ['react', 'components'],
    reviewCount: 5,
    correctCount: 2,
    interval: 1,
    easeFactor: 1.8,
    nextReview: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Due yesterday
  },
];

describe('FlashcardStudy', () => {
  const mockOnSessionComplete = jest.fn();
  const mockOnExit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders flashcard study interface', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    expect(screen.getByText('Flashcard Study - All Mode')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByTestId('flashcard-component')).toBeInTheDocument();
  });

  it('filters cards based on study mode', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="new"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Only new cards (reviewCount === 0) should be shown
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByTestId('card-front')).toHaveTextContent('What is React?');
  });

  it('handles card flipping', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    const flipButton = screen.getByText('Flip Card');
    fireEvent.click(flipButton);

    expect(screen.getByTestId('card-back')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Test spacebar to flip
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByTestId('card-back')).toBeInTheDocument();

    // Test arrow keys for navigation
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('card-front')).toHaveTextContent('What is JSX?');
  });

  it('handles card responses and updates session stats', async () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Flip the card first
    const flipButton = screen.getByText('Flip Card');
    fireEvent.click(flipButton);

    // Mark as correct
    const correctButton = screen.getByText('Correct');
    fireEvent.click(correctButton);

    // Wait for the automatic progression
    await waitFor(() => {
      expect(screen.getByTestId('card-front')).toHaveTextContent('What is JSX?');
    });
  });

  it('handles session pause and resume', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Pause the session
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Study Session Paused')).toBeInTheDocument();

    // Resume the session
    const resumeButton = screen.getByText('Resume');
    fireEvent.click(resumeButton);
    expect(screen.getByTestId('flashcard-component')).toBeInTheDocument();
  });

  it('completes session when all cards are studied', async () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={[mockFlashcards[0]]} // Only one card
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Flip and answer the card
    const flipButton = screen.getByText('Flip Card');
    fireEvent.click(flipButton);

    const correctButton = screen.getByText('Correct');
    fireEvent.click(correctButton);

    await waitFor(() => {
      expect(mockOnSessionComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          cardsStudied: 1,
          correctAnswers: 1,
          mode: 'all',
        })
      );
    });
  });

  it('shows keyboard help dialog', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Open keyboard help
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Space / Enter')).toBeInTheDocument();
  });

  it('shows session stats dialog', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Click settings button to show stats
    const settingsButtons = screen.getAllByRole('button');
    const settingsButton = settingsButtons.find(button => 
      button.querySelector('[data-testid="SettingsIcon"]')
    );
    
    if (settingsButton) {
      fireEvent.click(settingsButton);
      expect(screen.getByText('Session Statistics')).toBeInTheDocument();
    }
  });

  it('handles empty flashcard list', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={[]}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    expect(screen.getByText('No cards to study')).toBeInTheDocument();
    expect(screen.getByText('Back to Capsule')).toBeInTheDocument();
  });

  it('tracks study time', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="all"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Fast-forward time
    jest.advanceTimersByTime(60000); // 1 minute

    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('handles review mode filtering', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="review"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Should show only cards that are due for review
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByTestId('card-front')).toHaveTextContent('What is a component?');
  });

  it('handles difficult mode filtering', () => {
    render(
      <FlashcardStudy
        capsuleId="test-capsule"
        flashcards={mockFlashcards}
        studyMode="difficult"
        onSessionComplete={mockOnSessionComplete}
        onExit={mockOnExit}
      />
    );

    // Should show cards marked as hard or with low accuracy
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByTestId('card-front')).toHaveTextContent('What is a component?');
  });
});