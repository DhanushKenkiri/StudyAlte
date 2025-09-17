import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoProcessingInterface } from '../VideoProcessingInterface';
import { useVideoProcessing } from '../../../hooks/useVideoProcessing';

// Mock the hook
jest.mock('../../../hooks/useVideoProcessing');
const mockUseVideoProcessing = useVideoProcessing as jest.MockedFunction<typeof useVideoProcessing>;

// Mock the VideoUrlInput component
jest.mock('../VideoUrlInput', () => ({
  VideoUrlInput: ({ onVideoValidated, onValidationError }: any) => (
    <div data-testid="video-url-input">
      <button
        onClick={() => onVideoValidated({
          url: 'https://youtube.com/watch?v=test',
          title: 'Test Video',
          thumbnail: { high: 'test-thumbnail.jpg' },
        })}
      >
        Validate Video
      </button>
      <button onClick={() => onValidationError('Test error')}>
        Trigger Error
      </button>
    </div>
  ),
}));

describe('VideoProcessingInterface', () => {
  const mockStartProcessing = jest.fn();
  const mockCancelProcessing = jest.fn();
  const mockRetryProcessing = jest.fn();
  const mockOnProcessingComplete = jest.fn();
  const mockOnProcessingError = jest.fn();

  beforeEach(() => {
    mockUseVideoProcessing.mockReturnValue({
      jobs: [],
      activeJobs: [],
      completedJobs: [],
      errorJobs: [],
      startProcessing: mockStartProcessing,
      cancelProcessing: mockCancelProcessing,
      retryProcessing: mockRetryProcessing,
      removeJob: jest.fn(),
      clearCompleted: jest.fn(),
      isProcessing: false,
    });

    jest.clearAllMocks();
  });

  it('renders the video processing interface', () => {
    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    expect(screen.getByText('Process YouTube Video')).toBeInTheDocument();
    expect(screen.getByTestId('video-url-input')).toBeInTheDocument();
  });

  it('shows start processing button after video validation', async () => {
    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Validate a video
    fireEvent.click(screen.getByText('Validate Video'));

    await waitFor(() => {
      expect(screen.getByText('Start Processing')).toBeInTheDocument();
    });
  });

  it('starts processing when start button is clicked', async () => {
    mockStartProcessing.mockResolvedValue('job-123');

    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Validate a video first
    fireEvent.click(screen.getByText('Validate Video'));

    await waitFor(() => {
      expect(screen.getByText('Start Processing')).toBeInTheDocument();
    });

    // Start processing
    fireEvent.click(screen.getByText('Start Processing'));

    await waitFor(() => {
      expect(mockStartProcessing).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=test',
        expect.objectContaining({
          url: 'https://youtube.com/watch?v=test',
          title: 'Test Video',
        })
      );
    });
  });

  it('shows processing progress when job is active', () => {
    const mockJob = {
      id: 'job-123',
      videoUrl: 'https://youtube.com/watch?v=test',
      videoTitle: 'Test Video',
      videoThumbnail: 'test-thumbnail.jpg',
      status: 'processing' as const,
      progress: 50,
      currentStep: 'transcript',
      steps: [
        { id: 'validation', label: 'Video Validation', status: 'completed' as const },
        { id: 'transcript', label: 'Extract Transcript', status: 'processing' as const, progress: 75 },
        { id: 'summary', label: 'Generate Summary', status: 'pending' as const },
      ],
      startedAt: new Date().toISOString(),
    };

    mockUseVideoProcessing.mockReturnValue({
      jobs: [mockJob],
      activeJobs: [mockJob],
      completedJobs: [],
      errorJobs: [],
      startProcessing: mockStartProcessing,
      cancelProcessing: mockCancelProcessing,
      retryProcessing: mockRetryProcessing,
      removeJob: jest.fn(),
      clearCompleted: jest.fn(),
      isProcessing: true,
    });

    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Validate and set current job
    fireEvent.click(screen.getByText('Validate Video'));

    expect(screen.getByText('Processing Progress')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('shows completion state when job is completed', () => {
    const mockJob = {
      id: 'job-123',
      videoUrl: 'https://youtube.com/watch?v=test',
      videoTitle: 'Test Video',
      videoThumbnail: 'test-thumbnail.jpg',
      status: 'completed' as const,
      progress: 100,
      currentStep: 'mindmap',
      steps: [
        { id: 'validation', label: 'Video Validation', status: 'completed' as const },
        { id: 'transcript', label: 'Extract Transcript', status: 'completed' as const },
        { id: 'summary', label: 'Generate Summary', status: 'completed' as const },
        { id: 'flashcards', label: 'Create Flashcards', status: 'completed' as const },
        { id: 'quiz', label: 'Generate Quiz', status: 'completed' as const },
        { id: 'mindmap', label: 'Build Mind Map', status: 'completed' as const },
      ],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      capsuleId: 'capsule-123',
    };

    mockUseVideoProcessing.mockReturnValue({
      jobs: [mockJob],
      activeJobs: [],
      completedJobs: [mockJob],
      errorJobs: [],
      startProcessing: mockStartProcessing,
      cancelProcessing: mockCancelProcessing,
      retryProcessing: mockRetryProcessing,
      removeJob: jest.fn(),
      clearCompleted: jest.fn(),
      isProcessing: false,
    });

    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    expect(screen.getByText('Processing Complete!')).toBeInTheDocument();
    expect(screen.getByText('View Learning Capsule')).toBeInTheDocument();
  });

  it('handles processing errors', async () => {
    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Trigger validation error
    fireEvent.click(screen.getByText('Trigger Error'));

    await waitFor(() => {
      expect(mockOnProcessingError).toHaveBeenCalledWith('Test error');
    });
  });

  it('allows canceling processing', async () => {
    const mockJob = {
      id: 'job-123',
      videoUrl: 'https://youtube.com/watch?v=test',
      videoTitle: 'Test Video',
      videoThumbnail: 'test-thumbnail.jpg',
      status: 'processing' as const,
      progress: 30,
      currentStep: 'transcript',
      steps: [],
      startedAt: new Date().toISOString(),
    };

    mockUseVideoProcessing.mockReturnValue({
      jobs: [mockJob],
      activeJobs: [mockJob],
      completedJobs: [],
      errorJobs: [],
      startProcessing: mockStartProcessing,
      cancelProcessing: mockCancelProcessing,
      retryProcessing: mockRetryProcessing,
      removeJob: jest.fn(),
      clearCompleted: jest.fn(),
      isProcessing: true,
    });

    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Validate video and set current job
    fireEvent.click(screen.getByText('Validate Video'));

    // Click cancel button
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Confirm cancellation in dialog
    const confirmButton = screen.getByText('Cancel Processing');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCancelProcessing).toHaveBeenCalledWith('job-123');
    });
  });

  it('allows retrying failed processing', async () => {
    const mockJob = {
      id: 'job-123',
      videoUrl: 'https://youtube.com/watch?v=test',
      videoTitle: 'Test Video',
      videoThumbnail: 'test-thumbnail.jpg',
      status: 'error' as const,
      progress: 25,
      currentStep: 'transcript',
      steps: [
        { id: 'validation', label: 'Video Validation', status: 'completed' as const },
        { id: 'transcript', label: 'Extract Transcript', status: 'error' as const, error: 'Failed to extract transcript' },
      ],
      error: 'Processing failed',
      startedAt: new Date().toISOString(),
    };

    mockUseVideoProcessing.mockReturnValue({
      jobs: [mockJob],
      activeJobs: [],
      completedJobs: [],
      errorJobs: [mockJob],
      startProcessing: mockStartProcessing,
      cancelProcessing: mockCancelProcessing,
      retryProcessing: mockRetryProcessing,
      removeJob: jest.fn(),
      clearCompleted: jest.fn(),
      isProcessing: false,
    });

    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Validate video and set current job
    fireEvent.click(screen.getByText('Validate Video'));

    // Click retry button
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockRetryProcessing).toHaveBeenCalledWith('job-123');
    });
  });

  it('resets interface when reset button is clicked', async () => {
    render(
      <VideoProcessingInterface
        onProcessingComplete={mockOnProcessingComplete}
        onProcessingError={mockOnProcessingError}
      />
    );

    // Validate a video first
    fireEvent.click(screen.getByText('Validate Video'));

    await waitFor(() => {
      expect(screen.getByText('Start Processing')).toBeInTheDocument();
    });

    // Reset interface
    fireEvent.click(screen.getByText('Reset'));

    // Should not show start processing button anymore
    expect(screen.queryByText('Start Processing')).not.toBeInTheDocument();
  });
});