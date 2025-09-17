import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  ButtonGroup,
  Chip,
  Alert,
  Snackbar,
  useTheme,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { InteractiveTranscriptNavigation } from '../components/transcript/InteractiveTranscriptNavigation';
import { TranscriptData } from '../services/transcript/transcriptService';

// Mock transcript data for demonstration
const demoTranscript: TranscriptData = {
  videoId: 'demo-video-123',
  language: 'en',
  duration: 480,
  confidence: 0.94,
  source: 'youtube',
  fullText: 'Welcome to this comprehensive tutorial on React development. In this video, we will explore the fundamentals of building interactive user interfaces. First, let me introduce the concept of components. Components are the building blocks of React applications. They allow us to create reusable pieces of UI. Next, we will discuss state management. State is how we handle data that changes over time in our applications. We will also cover event handling, which is crucial for creating interactive experiences. Props are another important concept that allows us to pass data between components. Finally, we will look at best practices for organizing your React code and optimizing performance.',
  segments: [
    {
      id: 'seg-1',
      text: 'Welcome to this comprehensive tutorial on React development.',
      start: 0,
      end: 4,
      confidence: 0.98,
    },
    {
      id: 'seg-2',
      text: 'In this video, we will explore the fundamentals of building interactive user interfaces.',
      start: 4,
      end: 10,
      confidence: 0.96,
    },
    {
      id: 'seg-3',
      text: 'First, let me introduce the concept of components.',
      start: 10,
      end: 14,
      confidence: 0.95,
    },
    {
      id: 'seg-4',
      text: 'Components are the building blocks of React applications.',
      start: 14,
      end: 18,
      confidence: 0.97,
    },
    {
      id: 'seg-5',
      text: 'They allow us to create reusable pieces of UI.',
      start: 18,
      end: 22,
      confidence: 0.93,
    },
    {
      id: 'seg-6',
      text: 'Next, we will discuss state management.',
      start: 22,
      end: 26,
      confidence: 0.96,
    },
    {
      id: 'seg-7',
      text: 'State is how we handle data that changes over time in our applications.',
      start: 26,
      end: 32,
      confidence: 0.94,
    },
    {
      id: 'seg-8',
      text: 'We will also cover event handling, which is crucial for creating interactive experiences.',
      start: 32,
      end: 38,
      confidence: 0.92,
    },
    {
      id: 'seg-9',
      text: 'Props are another important concept that allows us to pass data between components.',
      start: 38,
      end: 44,
      confidence: 0.95,
    },
    {
      id: 'seg-10',
      text: 'Finally, we will look at best practices for organizing your React code and optimizing performance.',
      start: 44,
      end: 52,
      confidence: 0.91,
    },
  ],
};

interface TranscriptNote {
  id: string;
  segmentId: string;
  content: string;
  timestamp: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isPrivate: boolean;
}

export const TranscriptDemoPage: React.FC = () => {
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState<TranscriptNote[]>([
    {
      id: 'demo-note-1',
      segmentId: 'seg-3',
      content: 'This is a key concept - components are fundamental to React',
      timestamp: 10,
      createdAt: '2023-12-01T10:00:00Z',
      updatedAt: '2023-12-01T10:00:00Z',
      tags: ['components', 'fundamentals'],
      isPrivate: false,
    },
    {
      id: 'demo-note-2',
      segmentId: 'seg-6',
      content: 'State management is crucial for dynamic applications',
      timestamp: 22,
      createdAt: '2023-12-01T10:05:00Z',
      updatedAt: '2023-12-01T10:05:00Z',
      tags: ['state', 'management'],
      isPrivate: true,
    },
  ]);
  const [bookmarks, setBookmarks] = useState<string[]>(['seg-3', 'seg-6', 'seg-9']);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Simulate video playback
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    
    // Simple simulation of video progress
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 0.5;
        if (newTime >= demoTranscript.duration) {
          setIsPlaying(false);
          clearInterval(interval);
          return demoTranscript.duration;
        }
        return newTime;
      });
    }, 500);

    // Store interval ID for cleanup
    (window as any).playbackInterval = interval;
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if ((window as any).playbackInterval) {
      clearInterval((window as any).playbackInterval);
    }
  }, []);

  const handleTimeSeek = useCallback((time: number) => {
    setCurrentTime(time);
    setSnackbarMessage(`Seeked to ${Math.floor(time / 60)}:${(Math.floor(time % 60)).toString().padStart(2, '0')}`);
  }, []);

  const handleNoteCreate = useCallback((noteData: Omit<TranscriptNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: TranscriptNote = {
      ...noteData,
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setNotes(prev => [...prev, newNote]);
    setSnackbarMessage('Note created successfully!');
  }, []);

  const handleNoteUpdate = useCallback((noteId: string, updates: Partial<TranscriptNote>) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, ...updates, updatedAt: new Date().toISOString() }
        : note
    ));
    setSnackbarMessage('Note updated successfully!');
  }, []);

  const handleNoteDelete = useCallback((noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setSnackbarMessage('Note deleted successfully!');
  }, []);

  const handleBookmarkToggle = useCallback((segmentId: string) => {
    setBookmarks(prev => {
      const isBookmarked = prev.includes(segmentId);
      const newBookmarks = isBookmarked
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId];
      
      setSnackbarMessage(isBookmarked ? 'Bookmark removed' : 'Bookmark added');
      return newBookmarks;
    });
  }, []);

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
    if ((window as any).playbackInterval) {
      clearInterval((window as any).playbackInterval);
    }
    setSnackbarMessage('Demo reset');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Interactive Transcript Navigation Demo
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Experience the full functionality of our interactive transcript system with video synchronization,
          search capabilities, note-taking, and bookmarking features.
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          This is a demonstration of the Interactive Transcript Navigation component. 
          The video playback is simulated for demo purposes. In a real application, 
          this would be synchronized with an actual video player.
        </Alert>
      </Box>

      {/* Demo Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h6">Demo Controls</Typography>
            <ButtonGroup>
              <Button
                variant={isPlaying ? 'outlined' : 'contained'}
                startIcon={<PlayIcon />}
                onClick={handlePlay}
                disabled={isPlaying || currentTime >= demoTranscript.duration}
              >
                Play
              </Button>
              <Button
                variant={isPlaying ? 'contained' : 'outlined'}
                startIcon={<PauseIcon />}
                onClick={handlePause}
                disabled={!isPlaying}
              >
                Pause
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleReset}
              >
                Reset
              </Button>
            </ButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              label={`Current Time: ${formatTime(currentTime)}`} 
              color="primary" 
              variant="outlined" 
            />
            <Chip 
              label={`Duration: ${formatTime(demoTranscript.duration)}`} 
              variant="outlined" 
            />
            <Chip 
              label={`Status: ${isPlaying ? 'Playing' : 'Paused'}`} 
              color={isPlaying ? 'success' : 'default'}
              variant="outlined" 
            />
            <Chip 
              label={`Notes: ${notes.length}`} 
              color="info" 
              variant="outlined" 
            />
            <Chip 
              label={`Bookmarks: ${bookmarks.length}`} 
              color="warning" 
              variant="outlined" 
            />
          </Box>
        </CardContent>
      </Card>

      {/* Feature Highlights */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Try These Features:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="🔍 Search transcript content" size="small" />
            <Chip label="📝 Add notes to segments" size="small" />
            <Chip label="🔖 Bookmark important parts" size="small" />
            <Chip label="⏯️ Click segments to seek" size="small" />
            <Chip label="📱 Right-click for context menu" size="small" />
            <Chip label="📊 View notes panel" size="small" />
            <Chip label="📤 Export transcript" size="small" />
            <Chip label="⚙️ Customize settings" size="small" />
          </Box>
        </CardContent>
      </Card>

      {/* Interactive Transcript Component */}
      <Box sx={{ height: '80vh' }}>
        <InteractiveTranscriptNavigation
          transcript={demoTranscript}
          videoUrl="https://www.youtube.com/watch?v=demo-video-123"
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeSeek={handleTimeSeek}
          onPlay={handlePlay}
          onPause={handlePause}
          notes={notes}
          onNoteCreate={handleNoteCreate}
          onNoteUpdate={handleNoteUpdate}
          onNoteDelete={handleNoteDelete}
          bookmarks={bookmarks}
          onBookmarkToggle={handleBookmarkToggle}
          showVideoPlayer={true}
          allowNotes={true}
          allowBookmarks={true}
          allowExport={true}
        />
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};