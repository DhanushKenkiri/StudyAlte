import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fab,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  PlayArrow as PlayIcon,
  Note as NoteIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Highlight as HighlightIcon,
  VolumeUp as SpeakerIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { TranscriptSegment } from './TranscriptSegment';
import { TranscriptSearch } from './TranscriptSearch';
import { NoteEditor } from './NoteEditor';
import { VideoPlayer } from './VideoPlayer';

interface TranscriptSegmentData {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  confidence?: number;
}

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

interface InteractiveTranscriptProps {
  videoId: string;
  videoUrl: string;
  segments: TranscriptSegmentData[];
  currentTime?: number;
  onTimeSeek?: (time: number) => void;
  onNoteCreate?: (note: Omit<TranscriptNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onNoteUpdate?: (noteId: string, updates: Partial<TranscriptNote>) => void;
  onNoteDelete?: (noteId: string) => void;
  showVideoPlayer?: boolean;
  allowNotes?: boolean;
  allowBookmarks?: boolean;
}

export const InteractiveTranscript: React.FC<InteractiveTranscriptProps> = ({
  videoId,
  videoUrl,
  segments,
  currentTime = 0,
  onTimeSeek,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  showVideoPlayer = true,
  allowNotes = true,
  allowBookmarks = true,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [highlightedSegments, setHighlightedSegments] = useState<Set<string>>(new Set());
  const [bookmarkedSegments, setBookmarkedSegments] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<TranscriptNote[]>([]);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [selectedSegmentForNote, setSelectedSegmentForNote] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    segmentId: string;
  } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Find current active segment based on video time
  useEffect(() => {
    const currentSegment = segments.find(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );
    
    if (currentSegment && currentSegment.id !== activeSegment) {
      setActiveSegment(currentSegment.id);
      
      // Auto-scroll to active segment
      if (autoScroll && transcriptRef.current) {
        const segmentElement = segmentRefs.current.get(currentSegment.id);
        if (segmentElement) {
          segmentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    }
  }, [currentTime, segments, activeSegment, autoScroll]);

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setHighlightedSegments(new Set());
      return;
    }

    const results: string[] = [];
    const highlighted = new Set<string>();
    
    segments.forEach(segment => {
      if (segment.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(segment.id);
        highlighted.add(segment.id);
      }
    });
    
    setSearchResults(results);
    setHighlightedSegments(highlighted);
  }, [segments]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHighlightedSegments(new Set());
  };

  const handleSegmentClick = (segment: TranscriptSegmentData) => {
    onTimeSeek?.(segment.startTime);
    setActiveSegment(segment.id);
  };

  const handleSegmentContextMenu = (event: React.MouseEvent, segmentId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      segmentId,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleBookmarkToggle = (segmentId: string) => {
    const newBookmarks = new Set(bookmarkedSegments);
    if (newBookmarks.has(segmentId)) {
      newBookmarks.delete(segmentId);
    } else {
      newBookmarks.add(segmentId);
    }
    setBookmarkedSegments(newBookmarks);
    handleContextMenuClose();
  };

  const handleAddNote = (segmentId: string) => {
    setSelectedSegmentForNote(segmentId);
    setShowNoteEditor(true);
    handleContextMenuClose();
  };

  const handleCopySegment = (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId);
    if (segment) {
      const timestamp = formatTime(segment.startTime);
      const text = `[${timestamp}] ${segment.text}`;
      navigator.clipboard.writeText(text);
    }
    handleContextMenuClose();
  };

  const handleNoteSubmit = (noteContent: string, tags: string[], isPrivate: boolean) => {
    if (!selectedSegmentForNote) return;

    const segment = segments.find(s => s.id === selectedSegmentForNote);
    if (!segment) return;

    const newNote: Omit<TranscriptNote, 'id' | 'createdAt' | 'updatedAt'> = {
      segmentId: selectedSegmentForNote,
      content: noteContent,
      timestamp: segment.startTime,
      tags,
      isPrivate,
    };

    onNoteCreate?.(newNote);
    setShowNoteEditor(false);
    setSelectedSegmentForNote(null);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const exportTranscript = () => {
    const transcriptText = segments
      .map(segment => `[${formatTime(segment.startTime)}] ${segment.text}`)
      .join('\n');
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${videoId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const jumpToSearchResult = (index: number) => {
    if (index >= 0 && index < searchResults.length) {
      const segmentId = searchResults[index];
      const segment = segments.find(s => s.id === segmentId);
      if (segment) {
        handleSegmentClick(segment);
      }
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Video Player */}
      {showVideoPlayer && (
        <Box sx={{ mb: 2 }}>
          <VideoPlayer
            videoUrl={videoUrl}
            currentTime={currentTime}
            onTimeUpdate={onTimeSeek}
            segments={segments}
          />
        </Box>
      )}

      {/* Search and Controls */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            
            <Tooltip title="Export transcript">
              <IconButton onClick={exportTranscript}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}>
              <IconButton
                onClick={() => setAutoScroll(!autoScroll)}
                color={autoScroll ? 'primary' : 'default'}
              >
                <PlayIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          {/* Search Results Summary */}
          {searchResults.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {searchResults.length} results found
              </Typography>
              <TranscriptSearch
                results={searchResults}
                segments={segments}
                onResultClick={jumpToSearchResult}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Transcript Content */}
      <Card sx={{ flex: 1, overflow: 'hidden' }}>
        <CardContent sx={{ height: '100%', p: 0 }}>
          <Box
            ref={transcriptRef}
            sx={{
              height: '100%',
              overflow: 'auto',
              p: 2,
            }}
          >
            <List sx={{ p: 0 }}>
              <AnimatePresence>
                {segments.map((segment, index) => (
                  <motion.div
                    key={segment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <TranscriptSegment
                      ref={(el) => {
                        if (el) {
                          segmentRefs.current.set(segment.id, el);
                        }
                      }}
                      segment={segment}
                      isActive={activeSegment === segment.id}
                      isHighlighted={highlightedSegments.has(segment.id)}
                      isBookmarked={bookmarkedSegments.has(segment.id)}
                      searchQuery={searchQuery}
                      notes={notes.filter(note => note.segmentId === segment.id)}
                      onClick={() => handleSegmentClick(segment)}
                      onContextMenu={(e) => handleSegmentContextMenu(e, segment.id)}
                      onNoteClick={(noteId) => {
                        // Handle note click - could open note editor or show note details
                        console.log('Note clicked:', noteId);
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
          </Box>
        </CardContent>
      </Card>

      {/* Floating Action Button for Quick Note */}
      {allowNotes && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => {
            if (activeSegment) {
              handleAddNote(activeSegment);
            }
          }}
          disabled={!activeSegment}
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
        <MenuItem onClick={() => contextMenu && handleSegmentClick(segments.find(s => s.id === contextMenu.segmentId)!)}>
          <PlayIcon sx={{ mr: 1 }} />
          Play from here
        </MenuItem>
        
        <MenuItem onClick={() => contextMenu && handleCopySegment(contextMenu.segmentId)}>
          <CopyIcon sx={{ mr: 1 }} />
          Copy segment
        </MenuItem>
        
        {allowBookmarks && (
          <MenuItem onClick={() => contextMenu && handleBookmarkToggle(contextMenu.segmentId)}>
            {contextMenu && bookmarkedSegments.has(contextMenu.segmentId) ? (
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
          <MenuItem onClick={() => contextMenu && handleAddNote(contextMenu.segmentId)}>
            <NoteIcon sx={{ mr: 1 }} />
            Add note
          </MenuItem>
        )}
      </Menu>

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
              segmentText={segments.find(s => s.id === selectedSegmentForNote)?.text || ''}
              onSubmit={handleNoteSubmit}
              onCancel={() => setShowNoteEditor(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};