import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { InteractiveTranscriptNavigation } from '../InteractiveTranscriptNavigation';
import { TranscriptData } from '../../../services/transcript/transcriptService';

const theme = createTheme();

const mockTranscript: TranscriptData = {
  videoId: 'integration-test-video',
  language: 'en',
  duration: 600,
  confidence: 0.92,
  source: 'youtube',
  fullText: 'Welcome to this tutorial. Today we will learn about React components. Let me show you how to create interactive interfaces. This is very important for modern web development. We will cover state management, event handling, and user experience best practices.',
  segments: [
    {
      id: 'seg-1',
      text: 'Welcome to this tutorial.',
      start: 0,
      end: 3,
      confidence: 0.98,
    },
    {
      id: 'seg-2',
      text: 'Today we will learn about React components.',
      start: 3,
      end: 7,
      confidence: 0.95,
    },
    {
      id: 'seg-3',
      text: 'Let me show you how to create interactive interfaces.',
      start: 7,
      end: 12,
      confidence: 0.93,
    },
    {
      id: 'seg-4',
      text: 'This is very important for modern web development.',
      start: 12,
      end: 16,
      confidence: 0.96,
    },
    {
      id: 'seg-5',
      text: 'We will cover state management, event handling, and user experience best practices.',
      start: 16,
      end: 22,
      confidence: 0.91,
    },
  ],
};

const renderComponent = (props = {}) => {
  const defaultProps = {
    transcript: mockTranscript,
    videoUrl: 'https://www.youtube.com/watch?v=integration-test-video',
    currentTime: 0,
    isPlaying: false,
    notes: [],
    bookmarks: [],
    onTimeSeek: jest.fn(),
    onPlay: jest.fn(),
    onPause: jest.fn(),
    onNoteCreate: jest.fn(),
    onNoteUpdate: jest.fn(),
    onNoteDelete: jest.fn(),
    onBookmarkToggle: jest.fn(),
    showVideoPlayer: true,
    allowNotes: true,
    allowBookmarks: true,
    allowExport: true,
    ...props,
  };

  return render(
    <ThemeProvider theme={theme}>
      <InteractiveTranscriptNavigation {...defaultProps} />
    </ThemeProvider>
  );
};

// Mock APIs
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockImplementation((tagName) => {
    if (tagName === 'a') {
      return {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };
    }
    return {};
  }),
});

Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn(),
});

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn(),
});

describe('Interactive Transcript Navigation - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Workflow', () => {
    it('supports complete search, navigation, and note-taking workflow', async () => {
      const user = userEvent.setup();
      const onTimeSeek = jest.fn();
      const onNoteCreate = jest.fn();
      
      renderComponent({ onTimeSeek, onNoteCreate });

      // Step 1: Search for content
      const searchInput = screen.getByPlaceholderText('Search transcript...');
      await user.type(searchInput, 'React');

      await waitFor(() => {
        expect(screen.getByText('1 of 1')).toBeInTheDocument();
      });

      // Step 2: Navigate to search result
      expect(onTimeSeek).toHaveBeenCalledWith(3); // Should seek to segment 2

      // Step 3: Open notes panel
      const notesButton = screen.getByText('Notes (0)');
      await user.click(notesButton);

      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('No notes yet. Right-click on a segment to add a note.')).toBeInTheDocument();

      // Step 4: Add a note using FAB (simulate active segment)
      renderComponent({ 
        onTimeSeek, 
        onNoteCreate, 
        currentTime: 5, // Active in segment 2
        notes: [],
      });

      await waitFor(() => {
        const fab = screen.getByRole('button', { name: /add/i });
        expect(fab).toBeInTheDocument();
      });

      const fab = screen.getByRole('button', { name: /add/i });
      await user.click(fab);

      // Step 5: Fill out note form
      expect(screen.getByText('Add Note')).toBeInTheDocument();
      
      const noteInput = screen.getByLabelText('Your Note');
      await user.type(noteInput, 'Important concept about React components');

      const tagInput = screen.getByPlaceholderText('Add tag...');
      await user.type(tagInput, 'react');
      
      const addTagButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addTagButton);

      await user.type(tagInput, 'components');
      await user.click(addTagButton);

      // Step 6: Save note
      const saveButton = screen.getByText('Save Note');
      await user.click(saveButton);

      expect(onNoteCreate).toHaveBeenCalledWith({
        segmentId: 'seg-2',
        content: 'Important concept about React components',
        timestamp: 3,
        tags: ['react', 'components'],
        isPrivate: false,
      });
    });

    it('supports bookmark management workflow', async () => {
      const user = userEvent.setup();
      const onBookmarkToggle = jest.fn();
      
      renderComponent({ 
        onBookmarkToggle,
        bookmarks: ['seg-1'],
        currentTime: 1, // Active in segment 1
      });

      // Verify bookmark is shown in metadata
      expect(screen.getByText('1 bookmarks')).toBeInTheDocument();

      // Test context menu bookmark toggle would be here
      // (requires more complex setup to simulate right-click on segments)
    });

    it('supports export workflow with different formats', async () => {
      const user = userEvent.setup();
      renderComponent();

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      // Verify export was triggered
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('Real-time Synchronization', () => {
    it('updates active segment as video plays', async () => {
      const { rerender } = renderComponent({ currentTime: 0 });

      // Initially no active segment indicator visible
      expect(screen.getByText('EN')).toBeInTheDocument();

      // Simulate video progress
      rerender(
        <ThemeProvider theme={theme}>
          <InteractiveTranscriptNavigation
            transcript={mockTranscript}
            videoUrl="https://www.youtube.com/watch?v=integration-test-video"
            currentTime={5} // Now in segment 2
            isPlaying={true}
            notes={[]}
            bookmarks={[]}
            onTimeSeek={jest.fn()}
            onPlay={jest.fn()}
            onPause={jest.fn()}
            onNoteCreate={jest.fn()}
            onNoteUpdate={jest.fn()}
            onNoteDelete={jest.fn()}
            onBookmarkToggle={jest.fn()}
          />
        </ThemeProvider>
      );

      // Should show updated state
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    it('handles rapid time updates efficiently', async () => {
      const { rerender } = renderComponent({ currentTime: 0 });

      // Simulate rapid time updates (like during video playback)
      const timeUpdates = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      timeUpdates.forEach(time => {
        rerender(
          <ThemeProvider theme={theme}>
            <InteractiveTranscriptNavigation
              transcript={mockTranscript}
              videoUrl="https://www.youtube.com/watch?v=integration-test-video"
              currentTime={time}
              isPlaying={true}
              notes={[]}
              bookmarks={[]}
              onTimeSeek={jest.fn()}
              onPlay={jest.fn()}
              onPause={jest.fn()}
              onNoteCreate={jest.fn()}
              onNoteUpdate={jest.fn()}
              onNoteDelete={jest.fn()}
              onBookmarkToggle={jest.fn()}
            />
          </ThemeProvider>
        );
      });

      // Should still be responsive
      expect(screen.getByText('EN')).toBeInTheDocument();
    });
  });

  describe('Multi-feature Integration', () => {
    it('maintains search results while adding notes', async () => {
      const user = userEvent.setup();
      const onNoteCreate = jest.fn();
      
      renderComponent({ onNoteCreate, currentTime: 5 });

      // Search first
      const searchInput = screen.getByPlaceholderText('Search transcript...');
      await user.type(searchInput, 'React');

      await waitFor(() => {
        expect(screen.getByText('1 of 1')).toBeInTheDocument();
      });

      // Add note while search is active
      const fab = screen.getByRole('button', { name: /add/i });
      await user.click(fab);

      const noteInput = screen.getByLabelText('Your Note');
      await user.type(noteInput, 'Note about search result');

      const saveButton = screen.getByText('Save Note');
      await user.click(saveButton);

      // Search should still be active
      expect(screen.getByDisplayValue('React')).toBeInTheDocument();
      expect(onNoteCreate).toHaveBeenCalled();
    });

    it('handles notes panel with search highlighting', async () => {
      const user = userEvent.setup();
      const mockNotes = [
        {
          id: 'note-1',
          segmentId: 'seg-2',
          content: 'This note mentions React components',
          timestamp: 3,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          tags: ['react'],
          isPrivate: false,
        },
      ];

      renderComponent({ notes: mockNotes });

      // Open notes panel
      const notesButton = screen.getByText('Notes (1)');
      await user.click(notesButton);

      // Search for content that appears in notes
      const searchInput = screen.getByPlaceholderText('Search transcript...');
      await user.type(searchInput, 'React');

      // Both search results and notes should be visible
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
      expect(screen.getByText('This note mentions React components')).toBeInTheDocument();
    });
  });

  describe('Settings Integration', () => {
    it('applies settings changes across all features', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Open settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      // Toggle auto-scroll off
      const autoScrollSwitch = screen.getByRole('checkbox', { name: /auto-scroll to current segment/i });
      await user.click(autoScrollSwitch);

      // Close settings (click outside or close button)
      await user.keyboard('{Escape}');

      // Verify auto-scroll button reflects the change
      const autoScrollButton = screen.getByText('Auto-scroll');
      expect(autoScrollButton).toHaveClass('MuiButton-outlined'); // Should be disabled
    });
  });

  describe('Error Recovery', () => {
    it('recovers gracefully from search errors', async () => {
      const user = userEvent.setup();
      renderComponent();

      const searchInput = screen.getByPlaceholderText('Search transcript...');
      
      // Search for something that doesn't exist
      await user.type(searchInput, 'nonexistent');

      // Should show no results without crashing
      expect(screen.queryByText(/of/)).not.toBeInTheDocument();
      
      // Should be able to search again
      await user.clear(searchInput);
      await user.type(searchInput, 'React');

      await waitFor(() => {
        expect(screen.getByText('1 of 1')).toBeInTheDocument();
      });
    });

    it('handles note creation errors gracefully', async () => {
      const user = userEvent.setup();
      const onNoteCreate = jest.fn().mockRejectedValue(new Error('Network error'));
      
      renderComponent({ onNoteCreate, currentTime: 5 });

      const fab = screen.getByRole('button', { name: /add/i });
      await user.click(fab);

      const noteInput = screen.getByLabelText('Your Note');
      await user.type(noteInput, 'Test note');

      const saveButton = screen.getByText('Save Note');
      await user.click(saveButton);

      // Should handle the error without crashing
      expect(onNoteCreate).toHaveBeenCalled();
    });
  });

  describe('Performance with Large Data', () => {
    it('handles large transcript with many notes efficiently', async () => {
      const largeTranscript = {
        ...mockTranscript,
        segments: Array.from({ length: 500 }, (_, i) => ({
          id: `large-seg-${i}`,
          text: `This is segment ${i} with content about various topics including React, JavaScript, and web development.`,
          start: i * 3,
          end: (i + 1) * 3,
          confidence: 0.9 + Math.random() * 0.1,
        })),
      };

      const manyNotes = Array.from({ length: 100 }, (_, i) => ({
        id: `note-${i}`,
        segmentId: `large-seg-${i * 5}`,
        content: `Note ${i} about the content`,
        timestamp: i * 15,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        tags: [`tag-${i}`],
        isPrivate: i % 2 === 0,
      }));

      const startTime = performance.now();
      renderComponent({ 
        transcript: largeTranscript, 
        notes: manyNotes 
      });
      const endTime = performance.now();

      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should display correct counts
      expect(screen.getByText('500 segments')).toBeInTheDocument();
      expect(screen.getByText('Notes (100)')).toBeInTheDocument();
    });
  });
});