import React, { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';

interface TranscriptSegmentData {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  confidence?: number;
}

interface TranscriptSearchProps {
  results: string[];
  segments: TranscriptSegmentData[];
  onResultClick: (index: number) => void;
}

export const TranscriptSearch: React.FC<TranscriptSearchProps> = ({
  results,
  segments,
  onResultClick,
}) => {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
    setCurrentIndex(newIndex);
    onResultClick(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onResultClick(newIndex);
  };

  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
    onResultClick(index);
  };

  if (results.length === 0) {
    return null;
  }

  const currentSegment = segments.find(s => s.id === results[currentIndex]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {currentIndex + 1} of {results.length}
      </Typography>
      
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Previous result">
          <Button onClick={handlePrevious} disabled={results.length <= 1}>
            <PrevIcon />
          </Button>
        </Tooltip>
        
        <Tooltip title="Next result">
          <Button onClick={handleNext} disabled={results.length <= 1}>
            <NextIcon />
          </Button>
        </Tooltip>
      </ButtonGroup>

      {currentSegment && (
        <Chip
          label={`${formatTime(currentSegment.startTime)}`}
          size="small"
          clickable
          onClick={() => onResultClick(currentIndex)}
          icon={<PlayIcon />}
          sx={{
            backgroundColor: theme.palette.primary.light,
            color: theme.palette.primary.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.primary.main,
            },
          }}
        />
      )}
    </Box>
  );
};