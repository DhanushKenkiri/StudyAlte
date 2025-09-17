import React, { useState } from 'react';
import {
  Box,
  CardContent,
  Typography,
  Card,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

interface CapsuleTranscriptProps {
  capsuleData: any;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const CapsuleTranscript: React.FC<CapsuleTranscriptProps> = ({
  capsuleData,
  onStartStudy,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSegments, setHighlightedSegments] = useState<Set<string>>(new Set());
  
  const transcript = capsuleData.transcript;
  const segments = transcript.segments || [];

  // Filter segments based on search query
  const filteredSegments = segments.filter((segment: any) =>
    searchQuery === '' || segment.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query) {
      const matchingSegments = new Set(
        segments
          .filter((segment: any) => segment.text.toLowerCase().includes(query.toLowerCase()))
          .map((segment: any) => segment.id)
      );
      setHighlightedSegments(matchingSegments);
    } else {
      setHighlightedSegments(new Set());
    }
  };

  const handlePlayAtTimestamp = (timestamp: number) => {
    // This would typically open the video at the specific timestamp
    window.open(`${capsuleData.videoUrl}&t=${timestamp}s`, '_blank');
  };

  const handleCopyTranscript = () => {
    const fullTranscript = segments
      .map((segment: any) => `[${formatTime(segment.startTime)}] ${segment.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullTranscript);
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: alpha(theme.palette.warning.main, 0.3) }}>
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <CardContent>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Video Transcript
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleCopyTranscript}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={handleCopyTranscript}
            >
              Copy All
            </Button>
          </Box>
        </Box>

        {/* Transcript Info */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Chip
            label={`${segments.length} segments`}
            sx={{
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          />
          <Chip
            label={`${transcript.language.toUpperCase()} language`}
            sx={{
              backgroundColor: alpha(theme.palette.secondary.main, 0.1),
              color: theme.palette.secondary.main,
            }}
          />
          <Chip
            label={`${Math.round(transcript.confidence * 100)}% confidence`}
            sx={{
              backgroundColor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.main,
            }}
          />
        </Box>

        {/* Search */}
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
                <IconButton
                  size="small"
                  onClick={() => handleSearch('')}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        {/* Search Results Info */}
        {searchQuery && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {filteredSegments.length} of {segments.length} segments match "{searchQuery}"
            </Typography>
          </Box>
        )}

        {/* Transcript Segments */}
        <Card sx={{ maxHeight: 600, overflow: 'auto' }}>
          <List>
            {filteredSegments.map((segment: any, index: number) => {
              const isHighlighted = highlightedSegments.has(segment.id);
              
              return (
                <ListItem
                  key={segment.id}
                  divider={index < filteredSegments.length - 1}
                  sx={{
                    alignItems: 'flex-start',
                    backgroundColor: isHighlighted 
                      ? alpha(theme.palette.warning.main, 0.1) 
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.action.hover, 0.5),
                    },
                  }}
                >
                  <Box sx={{ mr: 2, minWidth: 80 }}>
                    <Button
                      size="small"
                      startIcon={<PlayIcon />}
                      onClick={() => handlePlayAtTimestamp(segment.startTime)}
                      sx={{
                        minWidth: 'auto',
                        fontSize: '0.75rem',
                        color: 'primary.main',
                      }}
                    >
                      {formatTime(segment.startTime)}
                    </Button>
                  </Box>
                  
                  <ListItemText
                    primary={
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.6,
                          '& mark': {
                            backgroundColor: alpha(theme.palette.warning.main, 0.3),
                            padding: '2px 4px',
                            borderRadius: 1,
                          },
                        }}
                      >
                        {highlightText(segment.text, searchQuery)}
                      </Typography>
                    }
                    secondary={
                      segment.speaker && (
                        <Typography variant="caption" color="text.secondary">
                          Speaker: {segment.speaker}
                        </Typography>
                      )
                    }
                  />
                  
                  <IconButton
                    size="small"
                    onClick={() => navigator.clipboard.writeText(segment.text)}
                    sx={{ ml: 1 }}
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </ListItem>
              );
            })}
          </List>
        </Card>

        {filteredSegments.length === 0 && searchQuery && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No matches found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try searching with different keywords
            </Typography>
          </Box>
        )}

        {/* Transcript Actions */}
        <Card sx={{ mt: 3, p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.info.main, 0.05) }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Study with Transcript
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Use the transcript to follow along with the video or create your own notes.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => window.open(capsuleData.videoUrl, '_blank')}
            >
              Watch Video
            </Button>
            <Button
              variant="outlined"
              onClick={() => onStartStudy?.(capsuleData.id, 'notes')}
            >
              Create Notes
            </Button>
            <Button
              variant="outlined"
              onClick={handleCopyTranscript}
            >
              Copy Transcript
            </Button>
          </Box>
        </Card>
      </Box>
    </CardContent>
  );
};