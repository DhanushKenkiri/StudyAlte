import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  ButtonGroup,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
  Fab,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Note as NoteIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
  Highlight as HighlightIcon,
  VolumeUp as SpeakerIcon,
  AccessTime as TimeIcon,
  KeyboardArrowUp as UpIcon,
  KeyboardArrowDown as DownIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { TranscriptViewer } from './TranscriptViewer';
import { TranscriptSegment } from './TranscriptSegment';
import { NoteEditor } from './NoteEditor';
import { VideoPlayer } from './VideoPlayer';
import { TranscriptData, TranscriptSegment as TranscriptSegmentData } from '../../services/transcript/transcriptService';

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

interface InteractiveTranscriptNavigationProps {
  transcript: TranscriptData;
  videoUrl?: string;
  currentTime?: number;
  isPlaying?: boolean;
  onTimeSeek?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  notes?: TranscriptNote[];
  onNoteCreate?: (note: Omit<TranscriptNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onNoteUpdate?: (noteId: string, updates: Partial<TranscriptNote>) => void;
  onNoteDelete?: (noteId: string) => void;
  bookmarks?: string[];
  onBookmarkToggle?: (segmentId: string) => void;
  showVideoPlayer?: boolean;
  allowNotes?: boolean;
  allowBookmarks?: boolean;
  allowExport?: boolean;
}

export const InteractiveTranscriptNavigation: React.FC<InteractiveTranscriptNavigationProps> = ({
  transcript,
  videoUrl,
  currentTime = 0,
  isPlaying = false,
  onTimeSeek,
  onPlay,
  onPause,
  notes = [],
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  bookmarks = [],
  onBookmarkToggle,
  showVideoPlayer = true,
  allowNotes = true,
  allowBookmarks = true,
  allowExport = true,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [highlightedSegments, setHighlightedSegments] = useState<Set<number>>(new Set());
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [selectedSegmentForNote, setSelectedSegmentForNote] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    segmentIndex: number;
  } | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<{ [key: number]: HTMLDivElement }>({});

  // Find current active segment based on playback time
  useEffect(() => {
    const newActiveIndex = transcript.segments.findIndex(
      segment => currentTime >= segment.start && currentTime <= segment.end
    );
    
    if (newActiveIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(newActiveIndex);
      
      // Auto-scroll to active segment
      if (autoScroll && newActiveIndex >= 0 && segmentRefs.current[newActiveIndex]) {
        segmentRefs.current[newActiveIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentTime, transcript.segments, activeSegmentIndex, autoScroll]);

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setHighlightedSegments(new Set());
      return;
    }

    const results: number[] = [];
    const highlighted = new Set<number>();
    
    transcript.segments.forEach((segment, index) => {
      if (segment.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(index);
        highlighted.add(index);
      }
    });
    
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    setHighlightedSegments(highlighted);

    // Jump to first result
    if (results.length > 0) {
      jumpToSegment(results[0]);
    }
  }, [transcript.segments]);

  const navigateSearchResults = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }

    setCurrentSearchIndex(newIndex);
    jumpToSegment(searchResults[newIndex]);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setHighlightedSegments(new Set());
  };

  const jumpToSegment = (segmentIndex: number) => {
    const segment = transcript.segments[segmentIndex];
    if (segment && onTimeSeek) {
      onTimeSeek(segment.start);
      setActiveSegmentIndex(segmentIndex);
      
      // Scroll to segment
      if (segmentRefs.current[segmentIndex]) {
        segmentRefs.current[segmentIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  const handleSegmentClick = (segmentIndex: number) => {
    jumpToSegment(segmentIndex);
  };

  const handleSegmentContextMenu = (event: React.MouseEvent, segmentIndex: number) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      segmentIndex,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleBookmarkToggle = (segmentIndex: number) => {
    const segment = transcript.segments[segmentIndex];
    if (segment && onBookmarkToggle) {
      onBookmarkToggle(segment.id || `segment-${segmentIndex}`);
      setSnackbarMessage(
        bookmarks.includes(segment.id || `segment-${segmentIndex}`)
          ? 'Bookmark removed'
          : 'Bookmark added'
      );
    }
    handleContextMenuClose();
  };

  const handleAddNote = (segmentIndex: number) => {
    const segment = transcript.segments[segmentIndex];
    if (segment) {
      setSelectedSegmentForNote(segment.id || `segment-${segmentIndex}`);
      setShowNoteEditor(true);
    }
    handleContextMenuClose();
  };

  const handleCopySegment = (segmentIndex: number) => {
    const segment = transcript.segments[segmentIndex];
    if (segment) {
      const timestamp = formatTime(segment.start);
      const text = `[${timestamp}] ${segment.text}`;
      navigator.clipboard.writeText(text);
      setSnackbarMessage('Segment copied to clipboard');
    }
    handleContextMenuClose();
  };

  const handleNoteSubmit = (content: string, tags: string[], isPrivate: boolean) => {
    if (!selectedSegmentForNote) return;

    const segmentIndex = transcript.segments.findIndex(
      s => (s.id || `segment-${transcript.segments.indexOf(s)}`) === selectedSegmentForNote
    );
    const segment = transcript.segments[segmentIndex];
    
    if (segment && onNoteCreate) {
      const newNote: Omit<TranscriptNote, 'id' | 'createdAt' | 'updatedAt'> = {
        segmentId: selectedSegmentForNote,
        content,
        timestamp: segment.start,
        tags,
        isPrivate,
      };

      onNoteCreate(newNote);
      setSnackbarMessage('Note added successfully');
    }

    setShowNoteEditor(false);
    setSelectedSegmentForNote(null);
  };

  const exportTranscript = (format: 'txt' | 'srt' | 'vtt' | 'json') => {
    let content = '';
    let filename = `transcript-${transcript.videoId}`;
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = transcript.fullText;
        filename += '.txt';
        break;
      
      case 'srt':
        content = exportToSRT();
        filename += '.srt';
        break;
      
      case 'vtt':
        content = exportToVTT();
        filename += '.vtt';
        mimeType = 'text/vtt';
        break;
      
      case 'json':
        content = JSON.stringify({
          ...transcript,
          notes: notes,
          bookmarks: bookmarks,
        }, null, 2);
        filename += '.json';
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSnackbarMessage(`Transcript exported as ${format.toUpperCase()}`);
  };

  const exportToSRT = (): string => {
    return transcript.segments
      .map((segment, index) => {
        const startTime = formatSRTTime(segment.start);
        const endTime = formatSRTTime(segment.end);
        
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
      })
      .join('\n');
  };

  const exportToVTT = (): string => {
    const header = 'WEBVTT\n\n';
    const cues = transcript.segments
      .map(segment => {
        const startTime = formatVTTTime(segment.start);
        const endTime = formatVTTTime(segment.end);
        
        return `${startTime} --> ${endTime}\n${segment.text}\n`;
      })
      .join('\n');
    
    return header + cues;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSRTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const formatVTTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const highlightSearchText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.trim()})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Video Player */}
      {showVideoPlayer && videoUrl && (
        <Box sx={{ mb: 2 }}>
          <VideoPlayer
            videoUrl={videoUrl}
            currentTime={currentTime}
            onTimeUpdate={onTimeSeek}
            segments={transcript.segments}
            autoPlay={false}
            showControls={true}
          />
        </Box>
      )}

      {/* Search and Controls Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={clearSearch}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              size="small"
            />
            
            {/* Search Navigation */}
            {searchResults.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {currentSearchIndex + 1} of {searchResults.length}
                </Typography>
                <ButtonGroup size="small">
                  <Button onClick={() => navigateSearchResults('prev')}>
                    <UpIcon />
                  </Button>
                  <Button onClick={() => navigateSearchResults('next')}>
                    <DownIcon />
                  </Button>
                </ButtonGroup>
              </Box>
            )}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}>
              <Button
                size="small"
                variant={autoScroll ? 'contained' : 'outlined'}
                onClick={() => setAutoScroll(!autoScroll)}
                startIcon={autoScroll ? <SyncIcon /> : <SyncDisabledIcon />}
              >
                Auto-scroll
              </Button>
            </Tooltip>

            {allowNotes && (
              <Tooltip title="Show notes panel">
                <Button
                  size="small"
                  variant={showNotesPanel ? 'contained' : 'outlined'}
                  onClick={() => setShowNotesPanel(!showNotesPanel)}
                  startIcon={<NoteIcon />}
                >
                  Notes ({notes.length})
                </Button>
              </Tooltip>
            )}

            {allowExport && (
              <Tooltip title="Export transcript">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => exportTranscript('txt')}
                  startIcon={<DownloadIcon />}
                >
                  Export
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setShowSettings(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Transcript Info */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Chip
              label={`${transcript.language.toUpperCase()}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${transcript.segments.length} segments`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${formatTime(transcript.duration)}`}
              size="small"
              variant="outlined"
              icon={<TimeIcon />}
            />
            {notes.length > 0 && (
              <Chip
                label={`${notes.length} notes`}
                size="small"
                variant="outlined"
                icon={<NoteIcon />}
                color="primary"
              />
            )}
            {bookmarks.length > 0 && (
              <Chip
                label={`${bookmarks.length} bookmarks`}
                size="small"
                variant="outlined"
                icon={<BookmarkIcon />}
                color="secondary"
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
        {/* Transcript Content */}
        <Card sx={{ flex: 1, overflow: 'hidden' }}>
          <CardContent sx={{ height: '100%', p: 0 }}>
            <TranscriptViewer
              transcript={transcript}
              currentTime={currentTime}
              onSeekTo={onTimeSeek}
              onPlay={onPlay}
              onPause={onPause}
              isPlaying={isPlaying}
              showTimestamps={showTimestamps}
              allowSearch={false} // We handle search in the parent
              allowExport={false} // We handle export in the parent
              height="100%"
            />
          </CardContent>
        </Card>

        {/* Notes Panel */}
        {showNotesPanel && allowNotes && (
          <Card sx={{ width: 300, overflow: 'hidden' }}>
            <CardContent sx={{ height: '100%', p: 0 }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">Notes</Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                <List>
                  {notes.map((note) => (
                    <ListItem key={note.id} sx={{ mb: 1 }}>
                      <Card sx={{ width: '100%' }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            {note.content}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                            {note.tags.map((tag) => (
                              <Chip key={tag} label={tag} size="small" />
                            ))}
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            {formatTime(note.timestamp)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </ListItem>
                  ))}
                  {notes.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      No notes yet. Right-click on a segment to add a note.
                    </Typography>
                  )}
                </List>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Floating Action Button for Quick Note */}
      {allowNotes && activeSegmentIndex >= 0 && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => handleAddNote(activeSegmentIndex)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => contextMenu && handleSegmentClick(contextMenu.segmentIndex)}>
          <PlayIcon sx={{ mr: 1 }} />
          Play from here
        </MenuItem>
        
        <MenuItem onClick={() => contextMenu && handleCopySegment(contextMenu.segmentIndex)}>
          <ShareIcon sx={{ mr: 1 }} />
          Copy segment
        </MenuItem>
        
        {allowBookmarks && (
          <MenuItem onClick={() => contextMenu && handleBookmarkToggle(contextMenu.segmentIndex)}>
            {contextMenu && bookmarks.includes(transcript.segments[contextMenu.segmentIndex]?.id || `segment-${contextMenu.segmentIndex}`) ? (
              <>
                <BookmarkIcon sx={{ mr: 1 }} />
                Remove bookmark
              </>
            ) : (
              <>
                <BookmarkBorderIcon sx={{ mr: 1 }} />
                Add bookmark
              </>
            )}
          </MenuItem>
        )}
        
        {allowNotes && (
          <MenuItem onClick={() => contextMenu && handleAddNote(contextMenu.segmentIndex)}>
            <NoteIcon sx={{ mr: 1 }} />
            Add note
          </MenuItem>
        )}
      </Menu>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transcript Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                />
              }
              label="Show timestamps"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
              }
              label="Auto-scroll to current segment"
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Note Editor Dialog */}
      <Dialog
        open={showNoteEditor}
        onClose={() => setShowNoteEditor(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Note</DialogTitle>
        <DialogContent>
          {selectedSegmentForNote && (
            <NoteEditor
              segmentId={selectedSegmentForNote}
              segmentText={
                transcript.segments.find(
                  s => (s.id || `segment-${transcript.segments.indexOf(s)}`) === selectedSegmentForNote
                )?.text || ''
              }
              onSubmit={handleNoteSubmit}
              onCancel={() => setShowNoteEditor(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Box>
  );
};