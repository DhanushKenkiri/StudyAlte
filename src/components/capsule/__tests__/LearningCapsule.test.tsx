import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LearningCapsule } from '../LearningCapsule';

// Mock the tab components
jest.mock('../CapsuleOverview', () => ({
  CapsuleOverview: ({ capsuleData, onStartStudy }: any) => (
    <div data-testid="capsule-overview">
      Overview for {capsuleData?.title}
      <button onClick={() => onStartStudy?.('test-id', 'flashcards')}>
        Start Flashcards
      </button>
    </div>
  ),
}));

jest.mock('../CapsuleSummary', () => ({
  CapsuleSummary: ({ capsuleData }: any) => (
    <div data-testid="capsule-summary">Summary for {capsuleData?.title}</div>
  ),
}));

jest.mock('../CapsuleFlashcards', () => ({
  CapsuleFlashcards: ({ capsuleData }: any) => (
    <div data-testid="capsule-flashcards">Flashcards for {capsuleData?.title}</div>
  ),
}));

jest.mock('../CapsuleQuiz', () => ({
  CapsuleQuiz: ({ capsuleData }: any) => (
    <div data-testid="capsule-quiz">Quiz for {capsuleData?.title}</div>
  ),
}));

jest.mock('../CapsuleMindMap', () => ({
  CapsuleMindMap: ({ capsuleData }: any) => (
    <div data-testid="capsule-mindmap">Mind Map for {capsuleData?.title}</div>
  ),
}));

jest.mock('../CapsuleTranscript', () => ({
  CapsuleTranscript: ({ capsuleData }: any) => (
    <div data-testid="capsule-transcript">Transcript for {capsuleData?.title}</div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockCapsuleData = {
  id: 'test-capsule-id',
  title: 'Test Learning Capsule',
  description: 'A test capsule for unit testing',
  videoUrl: 'https://youtube.com/watch?v=test',
  videoThumbnail: 'https://img.youtube.com/vi/test/maxresdefault.jpg',
  videoDuration: 3600,
  channelTitle: 'Test Channel',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  viewCount: 1000,
  isFavorite: false,
  tags: ['test', 'learning', 'education'],
  difficulty: 'intermediate',
  estimatedStudyTime: 30,
  completionRate: 75,
  summary: {
    content: 'Test summary content',
    keyPoints: ['Point 1', 'Point 2', 'Point 3'],
    sections: [
      { title: 'Section 1', content: 'Content 1', timestamp: 100 },
      { title: 'Section 2', content: 'Content 2', timestamp: 200 },
    ],
  },
  flashcards: [
    {
      id: 'card-1',
      front: 'Test question',
      back: 'Test answer',
      difficulty: 'medium',
      tags: ['test'],
      reviewCount: 5,
      correctCount: 4,
    },
  ],
  quiz: {
    id: 'quiz-1',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: 'Test explanation',
        difficulty: 'medium',
      },
    ],
    passingScore: 70,
    attempts: [
      {
        id: 'attempt-1',
        score: 85,
        completedAt: '2023-01-01T12:00:00Z',
        timeSpent: 300,
      },
    ],
  },
  mindMap: {
    nodes: [
      { id: 'node-1', label: 'Main Concept', type: 'main', x: 0, y: 0 },
      { id: 'node-2', label: 'Sub Concept', type: 'concept', x: 100, y: 100 },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ],
  },
  transcript: {
    segments: [
      {
        id: 'seg-1',
        text: 'Hello and welcome to this video',
        startTime: 0,
        endTime: 3,
      },
    ],
    language: 'en',
    confidence: 0.95,
  },
};

describe('LearningCapsule', () => {
  const mockOnEdit = jest.fn();
  const mockOnShare = jest.fn();
  const mockOnExport = jest.fn();
  const mockOnFavoriteToggle = jest.fn();
  const mockOnStartStudy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCapsuleData),
    });
  });

  it('renders the component', () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    // The component should render without crashing
    expect(document.body).toBeInTheDocument();
  });

  it('loads and displays capsule data', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Learning Capsule')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Channel')).toBeInTheDocument();
    expect(screen.getByText('intermediate')).toBeInTheDocument();
    expect(screen.getByText('75% complete')).toBeInTheDocument();
  });

  it('displays all tabs', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Learning Capsule')).toBeInTheDocument();
    });

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Flashcards')).toBeInTheDocument();
    expect(screen.getByText('Quiz')).toBeInTheDocument();
    expect(screen.getByText('Mind Map')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('capsule-overview')).toBeInTheDocument();
    });

    // Click on Summary tab
    fireEvent.click(screen.getByText('Summary'));
    expect(screen.getByTestId('capsule-summary')).toBeInTheDocument();

    // Click on Flashcards tab
    fireEvent.click(screen.getByText('Flashcards'));
    expect(screen.getByTestId('capsule-flashcards')).toBeInTheDocument();
  });

  it('handles favorite toggle', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Learning Capsule')).toBeInTheDocument();
    });

    // Mock the favorite toggle API call
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const favoriteButton = screen.getByRole('button', { name: /favorite/i });
    fireEvent.click(favoriteButton);

    await waitFor(() => {
      expect(mockOnFavoriteToggle).toHaveBeenCalledWith('test-capsule-id', true);
    });
  });

  it('handles share menu', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Learning Capsule')).toBeInTheDocument();
    });

    // Click share button
    const shareButton = screen.getByRole('button', { name: /share/i });
    fireEvent.click(shareButton);

    // Click on "Copy Link" option
    const copyLinkOption = screen.getByText('Copy Link');
    fireEvent.click(copyLinkOption);

    expect(mockOnShare).toHaveBeenCalledWith('test-capsule-id', 'link');
  });

  it('handles export menu', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Learning Capsule')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(exportButton);

    // Click on "Export as PDF" option
    const pdfOption = screen.getByText('Export as PDF');
    fireEvent.click(pdfOption);

    expect(mockOnExport).toHaveBeenCalledWith('test-capsule-id', 'pdf');
  });

  it('handles start study callback', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('capsule-overview')).toBeInTheDocument();
    });

    // Click the "Start Flashcards" button in the overview component
    const startButton = screen.getByText('Start Flashcards');
    fireEvent.click(startButton);

    expect(mockOnStartStudy).toHaveBeenCalledWith('test-id', 'flashcards');
  });

  it('handles API errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load learning capsule')).toBeInTheDocument();
    });

    expect(screen.getByText('API Error')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('handles edit action', async () => {
    render(
      <LearningCapsule
        capsuleId="test-capsule-id"
        onEdit={mockOnEdit}
        onShare={mockOnShare}
        onExport={mockOnExport}
        onFavoriteToggle={mockOnFavoriteToggle}
        onStartStudy={mockOnStartStudy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Learning Capsule')).toBeInTheDocument();
    });

    // Click more menu button
    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);

    // Click edit option
    const editOption = screen.getByText('Edit Capsule');
    fireEvent.click(editOption);

    expect(mockOnEdit).toHaveBeenCalledWith('test-capsule-id');
  });
});