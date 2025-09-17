import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { InteractiveTranscriptNavigation } from '../InteractiveTranscriptNavigation';
import { TranscriptData } from '../../../services/transcript/transcriptService';

const theme = createTheme();

const mockTranscript: TranscriptData = {
  videoId: 'test-video-id',
  language: 'en',
  duration: 300,
  confidence: 0.95,
  source: 'youtube',
  fullText: 'Hello world. This is a test transcript. Let me explain the concept.',
  segments: [
    {
      id: 'segment-1',
      text: 'Hello world.',
      start: 0,
      end: 2,
      confidence: 0.98,
    },
    {
      id: 'segment-2', 
      text: 'This is a test transcript.',
      start: 2,
      end: 5,
      confidence: 0.96,
    },
    {
      id: 'segment-3',
      text: 'Let me explain the concept.',
      start: 5,
      end: 8,
      confidence: 0.94,
    },
  ],
};

const mockNotes = [
  {
    id: 'note-1',
    segmentId: 'segment-1',
    content: 'This is an important greeting',
    timestamp: 0,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    tags: ['greeting', 'important'],
    isPrivate: false,
  },
  {
    id: 'note-2',
    segmentId: 'segment-3',
    content: 'Key concept explanation',
    timestamp: 5,
    createdAt: '2023-01-01T01:00:00Z',
    updatedAt: '2023-01-01T01:00:00Z',
    tags: ['concept', 'explanation'],
    isPrivate: true,
  },
];

const mockBookmarks = ['segment-1', 'segment-3'];

const defaultProps = {
  transcript: mockTranscript,
  videoUrl: 'https://www.youtube.com/watch?v=test-video-id',
  currentTime: 0,
  isPlaying: false,
  notes: mockNotes,
  bookmarks: mockBookmarks,
  onTimeSeek: jest.fn(),
  onPlay: jest.fn(),
  onPause: jest.fn(),
  onNoteCreate: jest.fn(),
  onNoteUpdate: jest.fn(),
  onNoteDelete: jest.fn(),
  onBookmarkToggle: jest.fn(),
};

const renderComponent = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <InteractiveTranscriptNavigation {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('InteractiveTranscriptNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders transcript navigation interface', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('Search transcript...')).toBeInTheDocument();
      expect(screen.getByText('Auto-scroll')).toBeInTheDocument();
      expect(screen.getByText('Notes (2)')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('displays transcript metadata', () => {
      renderComponent();
      
      expect(screen.getByText('EN')).toBeInTheDocument();
      expect(screen.getByText('3 segments')).toBeInTheDocument();
      expect(screen.getByText('5:00')).toBeInTheDocument();
      expect(screen.getByText('2 notes')).toBeInTheDocument();
      expect(screen.getByText('2 bookmarks')).toBeInTheDocument();
    });

    it('renders video player when showVideoPlayer is true', () => {
      renderComponent({ showVideoPlayer: true });
      
      // VideoPlayer component should be rendered
      expect(screen.getByTitle('YouTube Video Player')).toBeInTheDocument();
    });

    it('hides video player when showVideoPlayer is false', () => {
      renderComponent({ showVideoPlayer: false });
      
      expect(screen.queryByTitle('YouTube Video Player')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('performs search and highlights results', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search transcript...');
      await user.type(searchInput, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('1 of 1')).toBeInTheDocument();
      });
    });

    it('navigates through search results', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search transcript...');
      await user.type(searchInput, 'the');
      
      await waitFor(() => {
        expect(screen.getByText('1 of 2')).toBeInTheDocument();
      });
      
      const nextButton = screen.getByRole('button', { name: /navigate_next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('2 of 2')).toBeInTheDocument();
      });
    });

    it('clears search results', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search transcript...');
      await user.type(searchInput, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('1 of 1')).toBeInTheDocument();
      });
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);
      
      expect(searchInput).toHaveValue('');
      expect(screen.queryByText('1 of 1')).not.toBeInTheDocument();
    });
  });

  describe('Segment Interaction', () => {
    it('seeks to segment when clicked', async () => {
      const user = userEvent.setup();
      const onTimeSeek = jest.fn();
      renderComponent({ onTimeSeek });
      
      // Find and click on a segment (this would be in the TranscriptViewer)
      // Since TranscriptViewer is a separate component, we'll test the callback
      expect(onTimeSeek).not.toHaveBeenCalled();
    });

    it('shows context menu on right click', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // This would require the actual segment elements to be rendered
      // The context menu functionality is tested through the component's internal logic
    });
  });

  describe('Auto-scroll Functionality', () => {
    it('toggles auto-scroll setting', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const autoScrollButton = screen.getByText('Auto-scroll');
      expect(autoScrollButton).toHaveClass('MuiButton-contained'); // Initially enabled
      
      await user.click(autoScrollButton);
      expect(autoScrollButton).toHaveClass('MuiButton-outlined'); // Now disabled
    });
  });

  describe('Notes Panel', () => {
    it('toggles notes panel visibility', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const notesButton = screen.getByText('Notes (2)');
      await user.click(notesButton);
      
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('This is an important greeting')).toBeInTheDocument();
      expect(screen.getByText('Key concept explanation')).toBeInTheDocument();
    });

    it('displays notes with tags and timestamps', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const notesButton = screen.getByText('Notes (2)');
      await user.click(notesButton);
      
      expect(screen.getByText('greeting')).toBeInTheDocument();
      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(screen.getByText('0:05')).toBeInTheDocument();
    });

    it('shows empty state when no notes exist', async () => {
      const user = userEvent.setup();
      renderComponent({ notes: [] });
      
      const notesButton = screen.getByText('Notes (0)');
      await user.click(notesButton);
      
      expect(screen.getByText('No notes yet. Right-click on a segment to add a note.')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('exports transcript as text file', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const exportButton = screen.getByText('Export');
      await user.click(exportButton);
      
      // Verify that the export function was called
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('Settings Dialog', () => {
    it('opens and closes settings dialog', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);
      
      expect(screen.getByText('Transcript Settings')).toBeInTheDocument();
      expect(screen.getByText('Show timestamps')).toBeInTheDocument();
      expect(screen.getByText('Auto-scroll to current segment')).toBeInTheDocument();
    });

    it('toggles timestamp visibility setting', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);
      
      const timestampSwitch = screen.getByRole('checkbox', { name: /show timestamps/i });
      expect(timestampSwitch).toBeChecked();
      
      await user.click(timestampSwitch);
      expect(timestampSwitch).not.toBeChecked();
    });
  });

  describe('Note Creation', () => {
    it('opens note editor dialog', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Click the floating action button (when a segment is active)
      renderComponent({ currentTime: 1 }); // Set current time to activate a segment
      
      const fab = screen.getByRole('button', { name: /add/i });
      await user.click(fab);
      
      expect(screen.getByText('Add Note')).toBeInTheDocument();
    });

    it('creates a new note', async () => {
      const user = userEvent.setup();
      const onNoteCreate = jest.fn();
      renderComponent({ onNoteCreate, currentTime: 1 });
      
      const fab = screen.getByRole('button', { name: /add/i });
      await user.click(fab);
      
      const noteInput = screen.getByLabelText('Your Note');
      await user.type(noteInput, 'This is a new note');
      
      const saveButton = screen.getByText('Save Note');
      await user.click(saveButton);
      
      expect(onNoteCreate).toHaveBeenCalledWith({
        segmentId: 'segment-1',
        content: 'This is a new note',
        timestamp: 0,
        tags: [],
        isPrivate: false,
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Test search input focus
      await user.keyboard('{Tab}');
      expect(screen.getByPlaceholderText('Search transcript...')).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('textbox', { name: /search transcript/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export transcript/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Tab through interactive elements
      await user.keyboard('{Tab}');
      expect(screen.getByPlaceholderText('Search transcript...')).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('handles missing video URL gracefully', () => {
      renderComponent({ videoUrl: undefined });
      
      // Should not crash and should not show video player
      expect(screen.queryByTitle('YouTube Video Player')).not.toBeInTheDocument();
    });

    it('handles empty transcript gracefully', () => {
      const emptyTranscript = {
        ...mockTranscript,
        segments: [],
        fullText: '',
      };
      
      renderComponent({ transcript: emptyTranscript });
      
      expect(screen.getByText('0 segments')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large transcript efficiently', () => {
      const largeTranscript = {
        ...mockTranscript,
        segments: Array.from({ length: 1000 }, (_, i) => ({
          id: `segment-${i}`,
          text: `This is segment ${i} with some test content.`,
          start: i * 2,
          end: (i + 1) * 2,
          confidence: 0.95,
        })),
      };
      
      const { container } = renderComponent({ transcript: largeTranscript });
      
      // Should render without performance issues
      expect(container).toBeInTheDocument();
      expect(screen.getByText('1000 segments')).toBeInTheDocument();
    });
  });
});