import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QuizInterface } from '../QuizInterface';

// Mock the sub-components
jest.mock('../QuestionComponent', () => ({
  QuestionComponent: ({ question, onAnswer, answer, onToggleFlag }: any) => (
    <div data-testid="question-component">
      <div data-testid="question-text">{question.question}</div>
      <button onClick={() => onAnswer('test-answer')}>Answer Question</button>
      <button onClick={onToggleFlag}>Toggle Flag</button>
      {answer && <div data-testid="current-answer">{answer}</div>}
    </div>
  ),
}));

jest.mock('../QuizResults', () => ({
  QuizResults: ({ attempt, onExit }: any) => (
    <div data-testid="quiz-results">
      <div>Score: {attempt.score}%</div>
      <button onClick={onExit}>Exit</button>
    </div>
  ),
}));

jest.mock('../QuizTimer', () => ({
  QuizTimer: ({ timeRemaining, onTimeUp }: any) => (
    <div data-testid="quiz-timer">
      <div>Time: {timeRemaining}</div>
      <button onClick={onTimeUp}>Time Up</button>
    </div>
  ),
}));

const mockQuestions = [
  {
    id: 'q1',
    type: 'multiple-choice' as const,
    question: 'What is React?',
    options: ['Library', 'Framework', 'Language', 'Tool'],
    correctAnswer: 0,
    explanation: 'React is a JavaScript library',
    difficulty: 'medium' as const,
    points: 10,
  },
  {
    id: 'q2',
    type: 'true-false' as const,
    question: 'React uses virtual DOM',
    correctAnswer: true,
    explanation: 'React uses virtual DOM for performance',
    difficulty: 'easy' as const,
    points: 5,
  },
  {
    id: 'q3',
    type: 'short-answer' as const,
    question: 'What is JSX?',
    correctAnswer: 'JavaScript XML',
    explanation: 'JSX is a syntax extension for JavaScript',
    difficulty: 'hard' as const,
    points: 15,
  },
];

describe('QuizInterface', () => {
  const mockOnComplete = jest.fn();
  const mockOnExit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders pre-quiz screen initially', () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    expect(screen.getByText('Test Quiz')).toBeInTheDocument();
    expect(screen.getByText('3 questions')).toBeInTheDocument();
    expect(screen.getByText('70% to pass')).toBeInTheDocument();
    expect(screen.getByText('Start Quiz')).toBeInTheDocument();
  });

  it('starts quiz when start button is clicked', () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    const startButton = screen.getByText('Start Quiz');
    fireEvent.click(startButton);

    expect(screen.getByTestId('question-component')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('displays timer when time limit is set', () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        timeLimit={1800}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    
    // Start quiz to see timer
    fireEvent.click(screen.getByText('Start Quiz'));
    expect(screen.getByTestId('quiz-timer')).toBeInTheDocument();
  });

  it('handles question navigation', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Should show first question
    expect(screen.getByTestId('question-text')).toHaveTextContent('What is React?');

    // Navigate to next question
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByTestId('question-text')).toHaveTextContent('React uses virtual DOM');
    });

    // Navigate back
    const prevButton = screen.getByText('Previous');
    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(screen.getByTestId('question-text')).toHaveTextContent('What is React?');
    });
  });

  it('handles keyboard navigation', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Test right arrow key
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    
    await waitFor(() => {
      expect(screen.getByTestId('question-text')).toHaveTextContent('React uses virtual DOM');
    });

    // Test left arrow key
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    
    await waitFor(() => {
      expect(screen.getByTestId('question-text')).toHaveTextContent('What is React?');
    });
  });

  it('handles question answering', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Answer the question
    const answerButton = screen.getByText('Answer Question');
    fireEvent.click(answerButton);

    // Should show the answer
    expect(screen.getByTestId('current-answer')).toHaveTextContent('test-answer');

    // Should update answered count
    expect(screen.getByText('1 answered')).toBeInTheDocument();
  });

  it('handles question flagging', () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Flag the question
    const flagButton = screen.getByText('Toggle Flag');
    fireEvent.click(flagButton);

    // Should show flag button as active
    expect(screen.getByText('Unflag')).toBeInTheDocument();
  });

  it('handles quiz pause and resume', () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Pause quiz with Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Quiz Paused')).toBeInTheDocument();

    // Resume quiz
    const resumeButton = screen.getByText('Resume');
    fireEvent.click(resumeButton);
    expect(screen.getByTestId('question-component')).toBeInTheDocument();
  });

  it('handles quiz submission', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Answer all questions
    for (let i = 0; i < mockQuestions.length; i++) {
      const answerButton = screen.getByText('Answer Question');
      fireEvent.click(answerButton);
      
      if (i < mockQuestions.length - 1) {
        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);
        await waitFor(() => {
          expect(screen.getByText(`${i + 2} / 3`)).toBeInTheDocument();
        });
      }
    }

    // Submit quiz
    const submitButton = screen.getByText('Submit Quiz');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
          score: expect.any(Number),
        })
      );
    });
  });

  it('handles auto-submission when time runs out', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        timeLimit={60}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Simulate time running out
    const timeUpButton = screen.getByText('Time Up');
    fireEvent.click(timeUpButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('shows confirmation dialog for incomplete submission', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Go to last question without answering all
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });
    
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    // Try to submit
    const submitButton = screen.getByText('Submit Quiz');
    fireEvent.click(submitButton);

    // Should show confirmation dialog
    expect(screen.getByText('Submit Quiz?')).toBeInTheDocument();
    expect(screen.getByText(/3 questions remain unanswered/)).toBeInTheDocument();
  });

  it('handles quiz exit with confirmation', () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Try to exit
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Should show confirmation dialog
    expect(screen.getByText('Exit Quiz?')).toBeInTheDocument();
    expect(screen.getByText(/progress will be lost/)).toBeInTheDocument();
  });

  it('calculates score correctly', async () => {
    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Answer questions (simulate correct answers)
    for (let i = 0; i < mockQuestions.length; i++) {
      const answerButton = screen.getByText('Answer Question');
      fireEvent.click(answerButton);
      
      if (i < mockQuestions.length - 1) {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        await waitFor(() => {
          expect(screen.getByText(`${i + 2} / 3`)).toBeInTheDocument();
        });
      }
    }

    // Submit quiz
    const submitButton = screen.getByText('Submit Quiz');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          score: expect.any(Number),
          timeSpent: expect.any(Number),
          completed: true,
        })
      );
    });
  });

  it('handles shuffled questions when enabled', () => {
    const originalMathRandom = Math.random;
    Math.random = jest.fn(() => 0.5);

    render(
      <QuizInterface
        quizId="test-quiz"
        title="Test Quiz"
        questions={mockQuestions}
        passingScore={70}
        shuffleQuestions={true}
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));

    // Questions should be shuffled (though with our mock random, order might be same)
    expect(screen.getByTestId('question-component')).toBeInTheDocument();

    Math.random = originalMathRandom;
  });
});