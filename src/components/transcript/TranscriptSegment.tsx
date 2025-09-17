import React, { forwardRef } from 'react';
import {
  Box,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  IconButton,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Bookmark as BookmarkIcon,
  Note as NoteIcon,
  VolumeUp as SpeakerIcon,
} from '@mui/icons-material';

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

interface TranscriptSegmentProps {
  segment: TranscriptSegmentData;
  isActive?: boolean;
  isHighlighted?: boolean;
  isBookmarked?: boolean;
  searchQuery?: string;
  notes?: TranscriptNote[];
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onNoteClick?: (noteId: string) => void;
}

export const TranscriptSegment = forwardRef<HTMLLIElement, TranscriptSegmentProps>(({
  segment,
  isActive = false,
  isHighlighted = false,
  isBookmarked = false,
  searchQuery = '',
  notes = [],
  onClick,
  onContextMenu,
  onNoteClick,
}, ref) => {
  const theme = useTheme();

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark
          key={index}
          style={{
            backgroundColor: alpha(theme.palette.warning.main, 0.4),
            color: theme.palette.warning.contrastText,
            padding: '2px 4px',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {part}
        </mark>
      ) : part
    );
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return theme.palette.text.secondary;
    if (confidence >= 0.9) return theme.palette.success.main;
    if (confidence >= 0.7) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <ListItem
      ref={ref}
      onClick={onClick}
      onContextMenu={onContextMenu}
      sx={{
        alignItems: 'flex-start',
        py: 1.5,
        px: 2,
        cursor: 'pointer',
        borderRadius: 2,
        mb: 0.5,
        transition: 'all 0.2s ease-in-out',
        backgroundColor: isActive
          ? alpha(theme.palette.primary.main, 0.1)
          : isHighlighted
          ? alpha(theme.palette.warning.main, 0.1)
          : 'transparent',
        border: isActive
          ? `2px solid ${alpha(theme.palette.primary.main, 0.3)}`
          : '2px solid transparent',
        '&:hover': {
          backgroundColor: isActive
            ? alpha(theme.palette.primary.main, 0.15)
            : alpha(theme.palette.action.hover, 0.8),
          transform: 'translateX(4px)',
        },
      }}
    >
      {/* Timestamp and Play Button */}
      <Box sx={{ mr: 2, minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          sx={{
            backgroundColor: isActive
              ? theme.palette.primary.main
              : alpha(theme.palette.primary.main, 0.1),
            color: isActive ? 'white' : 'primary.main',
            mb: 0.5,
            '&:hover': {
              backgroundColor: isActive
                ? alpha(theme.palette.primary.main, 0.8)
                : alpha(theme.palette.primary.main, 0.2),
            },
          }}
        >
          <PlayIcon fontSize="small" />
        </IconButton>
        
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            color: isActive ? 'primary.main' : 'text.secondary',
          }}
        >
          {formatTime(segment.startTime)}
        </Typography>
      </Box>

      {/* Content */}
      <ListItemText
        primary={
          <Box>
            {/* Speaker and Metadata */}
            {(segment.speaker || segment.confidence) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {segment.speaker && (
                  <Chip
                    icon={<SpeakerIcon />}
                    label={segment.speaker}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
                
                {segment.confidence && (
                  <Chip
                    label={`${Math.round(segment.confidence * 100)}%`}
                    size="small"
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      backgroundColor: alpha(getConfidenceColor(segment.confidence), 0.1),
                      color: getConfidenceColor(segment.confidence),
                    }}
                  />
                )}
              </Box>
            )}
            
            {/* Transcript Text */}
            <Typography
              variant="body1"
              sx={{
                lineHeight: 1.6,
                color: isActive ? 'text.primary' : 'text.secondary',
                fontWeight: isActive ? 500 : 400,
                '& mark': {
                  backgroundColor: alpha(theme.palette.warning.main, 0.4),
                  color: theme.palette.warning.contrastText,
                  padding: '2px 4px',
                  borderRadius: 4,
                  fontWeight: 600,
                },
              }}
            >
              {highlightText(segment.text, searchQuery)}
            </Typography>
            
            {/* Notes Preview */}
            {notes.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {notes.slice(0, 2).map((note) => (
                  <Chip
                    key={note.id}
                    label={note.content.substring(0, 30) + (note.content.length > 30 ? '...' : '')}
                    size="small"
                    clickable
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteClick?.(note.id);
                    }}
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      color: theme.palette.info.main,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.info.main, 0.2),
                      },
                    }}
                  />
                ))}
                
                {notes.length > 2 && (
                  <Chip
                    label={`+${notes.length - 2} more`}
                    size="small"
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      color: theme.palette.info.main,
                    }}
                  />
                )}
              </Box>
            )}
          </Box>
        }
      />

      {/* Action Indicators */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, ml: 1 }}>
        {isBookmarked && (
          <BookmarkIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        )}
        
        {notes.length > 0 && (
          <Badge badgeContent={notes.length} color="info">
            <NoteIcon sx={{ color: 'info.main', fontSize: 20 }} />
          </Badge>
        )}
      </Box>
    </ListItem>
  );
});