import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  LinearProgress,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Search,
  PlayArrow,
  Pause,
  Download,
  MoreVert,
  Highlight,
  Clear,
  ContentCopy,
  FindInPage,
  AccessTime,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { TranscriptData, TranscriptSegment } from '../../services/transcript/transcriptService';

interface TranscriptViewerProps {
  transcript: TranscriptData;
  currentTime?: number; // Current video playback time in seconds
  onSeekTo?: (time: number) => void; // Callback to seek video to specific time
  onPlay?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
  showTimestamps?: boolean;
  allowSearch?: boolean;
  allowExport?: boolean;
  height?: number | string;
}

interface SearchResult {
  segment: TranscriptSegment;
  segmentIndex: number;
  match: string;
  context: string;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  currentTime = 0,
  onSeekTo,
  onPlay,
  onPause,
  isPlaying = false,
  showTimestamps = true,
  allowSearch = true,
  allowExport = true,
  height = 400,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [highlightedSegments, setHighlightedSegments] = useState<Set<number>>(new Set());
  
  const listRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<{ [key: number]: HTMLDivElement }>({});

  // Find current active segment based on playback time
  const activeSegmentIndex = useMemo(() => {
    return transcript.segments.findIndex(
      segment => currentTime >= segment.start && currentTime <= segment.end
    );
  }, [transcript.segments, currentTime]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentIndex >= 0 && segmentRefs.current[activeSegmentIndex]) {
      segmentRefs.current[activeSegmentIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setHighlightedSegments(new Set());
      return;
    }

    const results: SearchResult[] = [];
    const highlightedIndices = new Set<number>();
    
    transcript.segments.forEach((segment, index) => {
      const regex = new RegExp(query.trim(), 'gi');
      const matches = segment.text.match(regex);
      
      if (matches) {
        highlightedIndices.add(index);
        results.push({
          segment,
          segmentIndex: index,
          match: matches[0],
          context: segment.text,
        });
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    setHighlightedSegments(highlightedIndices);

    // Scroll to first result
    if (results.length > 0) {
      const firstResultIndex = results[0].segmentIndex;
      if (segmentRefs.current[firstResultIndex]) {
        segmentRefs.current[firstResultIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  const navigateSearchResults = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }

    setCurrentSearchIndex(newIndex);
    
    const resultIndex = searchResults[newIndex].segmentIndex;
    if (segmentRefs.current[resultIndex]) {
      segmentRefs.current[resultIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setHighlightedSegments(new Set());
  };

  // Export functionality
  const handleExport = (format: 'txt' | 'srt' | 'vtt' | 'json') => {
    let content = '';
    let filename = `transcript-${transcript.videoId}`;
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = transcript.fullText;
        filename += '.txt';
        break;
      
      case 'srt':
        content = exportToSRT(transcript);
        filename += '.srt';
        break;
      
      case 'vtt':
        content = exportToVTT(transcript);
        filename += '.vtt';
        mimeType = 'text/vtt';
        break;
      
      case 'json':
        content = JSON.stringify(transcript, null, 2);
        filename += '.json';
        mimeType = 'application/json';
        break;
    }

    // Create and download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportMenuAnchor(null);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript.fullText);
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
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="h3">
            Transcript
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {allowSearch && (
              <Tooltip title="Search transcript">
                <IconButton
                  size="small"
                  onClick={() => setShowSearch(!showSearch)}
                  color={showSearch ? 'primary' : 'default'}
                >
                  <Search />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Copy to clipboard">
              <IconButton size="small" onClick={copyToClipboard}>
                <ContentCopy />
              </IconButton>
            </Tooltip>
            {allowExport && (
              <>
                <Tooltip title="Export transcript">
                  <IconButton
                    size="small"
                    onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                  >
                    <Download />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={exportMenuAnchor}
                  open={Boolean(exportMenuAnchor)}
                  onClose={() => setExportMenuAnchor(null)}
                >
                  <MenuItem onClick={() => handleExport('txt')}>Plain Text (.txt)</MenuItem>
                  <MenuItem onClick={() => handleExport('srt')}>SubRip (.srt)</MenuItem>
                  <MenuItem onClick={() => handleExport('vtt')}>WebVTT (.vtt)</MenuItem>
                  <MenuItem onClick={() => handleExport('json')}>JSON (.json)</MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </Box>

        {/* Transcript Info */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
            icon={<AccessTime />}
          />
          <Chip
            label={`${Math.round(transcript.confidence * 100)}% confidence`}
            size="small"
            variant="outlined"
            color={transcript.confidence > 0.8 ? 'success' : transcript.confidence > 0.6 ? 'warning' : 'error'}
          />
        </Box>
      </Box>

      {/* Search Bar */}
      <Collapse in={showSearch}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: <FindInPage sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: searchQuery && (
                  <IconButton size="small" onClick={clearSearch}>
                    <Clear />
                  </IconButton>
                ),
              }}
            />
            {searchResults.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                <Typography variant="caption" color="text.secondary">
                  {currentSearchIndex + 1} of {searchResults.length}
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigateSearchResults('prev')}
                  disabled={searchResults.length === 0}
                >
                  ↑
                </Button>
                <Button
                  size="small"
                  onClick={() => navigateSearchResults('next')}
                  disabled={searchResults.length === 0}
                >
                  ↓
                </Button>
              </Box>
            )}
          </Box>
          {searchResults.length === 0 && searchQuery && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              No results found for "{searchQuery}"
            </Typography>
          )}
        </Box>
      </Collapse>

      {/* Transcript Content */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'grey.100',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'grey.400',
            borderRadius: 4,
          },
        }}
      >
        <List sx={{ p: 0 }}>
          {transcript.segments.map((segment, index) => {
            const isActive = index === activeSegmentIndex;
            const isHighlighted = highlightedSegments.has(index);
            const isCurrentSearchResult = 
              currentSearchIndex >= 0 && 
              searchResults[currentSearchIndex]?.segmentIndex === index;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
              >
                <ListItem
                  ref={(el) => {
                    if (el) segmentRefs.current[index] = el;
                  }}
                  sx={{
                    py: 1,
                    px: 2,
                    cursor: onSeekTo ? 'pointer' : 'default',
                    bgcolor: isActive
                      ? 'primary.50'
                      : isCurrentSearchResult
                      ? 'warning.50'
                      : isHighlighted
                      ? 'grey.50'
                      : 'transparent',
                    borderLeft: isActive ? 3 : 0,
                    borderColor: 'primary.main',
                    '&:hover': {
                      bgcolor: onSeekTo ? 'grey.100' : 'transparent',
                    },
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => onSeekTo?.(segment.start)}
                >
                  {showTimestamps && (
                    <Box sx={{ mr: 2, minWidth: 60 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                        }}
                      >
                        {formatTime(segment.start)}
                      </Typography>
                    </Box>
                  )}
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          lineHeight: 1.6,
                          color: isActive ? 'primary.main' : 'text.primary',
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {highlightSearchText(segment.text, searchQuery)}
                      </Typography>
                    }
                  />
                  {onSeekTo && (
                    <IconButton
                      size="small"
                      sx={{ ml: 1, opacity: 0.7 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeekTo(segment.start);
                      }}
                    >
                      <PlayArrow fontSize="small" />
                    </IconButton>
                  )}
                </ListItem>
                {index < transcript.segments.length - 1 && (
                  <Divider variant="inset" component="li" />
                )}
              </motion.div>
            );
          })}
        </List>
      </Box>

      {/* Footer */}
      {transcript.source !== 'youtube' && (
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Alert severity="info" sx={{ py: 0 }}>
            <Typography variant="caption">
              Transcript generated using {transcript.source === 'aws-transcribe' ? 'AWS Transcribe' : 'manual input'}
              {transcript.confidence < 0.8 && ' - Lower confidence, may contain errors'}
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );
};

// Helper functions for export
function exportToSRT(transcript: TranscriptData): string {
  return transcript.segments
    .map((segment, index) => {
      const startTime = formatSRTTime(segment.start);
      const endTime = formatSRTTime(segment.end);
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join('\n');
}

function exportToVTT(transcript: TranscriptData): string {
  const header = 'WEBVTT\n\n';
  const cues = transcript.segments
    .map(segment => {
      const startTime = formatVTTTime(segment.start);
      const endTime = formatVTTTime(segment.end);
      
      return `${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join('\n');
  
  return header + cues;
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}