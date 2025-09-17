import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  Chip,
  LinearProgress,
  Collapse,
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Error,
  Warning,
  AccessTime,
  Visibility,
  ThumbUp,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { YouTubeService, YouTubeVideoMetadata } from '../../services/youtube/youtubeService';
import { debounce } from '../../utils/helpers';

interface VideoUrlInputProps {
  onVideoValidated?: (metadata: YouTubeVideoMetadata) => void;
  onValidationError?: (error: string) => void;
  disabled?: boolean;
  autoValidate?: boolean;
  showPreview?: boolean;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  metadata: YouTubeVideoMetadata | null;
  error: string | null;
  warnings: string[];
}

export const VideoUrlInput: React.FC<VideoUrlInputProps> = ({
  onVideoValidated,
  onValidationError,
  disabled = false,
  autoValidate = true,
  showPreview = true,
}) => {
  const [url, setUrl] = useState('');
  const [validation, setValidation] = useState<ValidationState>({
    isValidating: false,
    isValid: null,
    metadata: null,
    error: null,
    warnings: [],
  });

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce(async (videoUrl: string) => {
      if (!videoUrl.trim()) {
        setValidation({
          isValidating: false,
          isValid: null,
          metadata: null,
          error: null,
          warnings: [],
        });
        return;
      }

      setValidation(prev => ({ ...prev, isValidating: true, error: null }));

      try {
        // Basic URL format validation
        if (!YouTubeService.validateUrl(videoUrl)) {
          setValidation({
            isValidating: false,
            isValid: false,
            metadata: null,
            error: 'Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)',
            warnings: [],
          });
          onValidationError?.('Invalid YouTube URL format');
          return;
        }

        // Call backend validation API
        const response = await fetch('/api/videos/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({ videoUrl }),
        });

        if (!response.ok) {
          throw new Error(`Validation failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.valid) {
          setValidation({
            isValidating: false,
            isValid: true,
            metadata: result.metadata,
            error: null,
            warnings: result.warnings || [],
          });
          onVideoValidated?.(result.metadata);
        } else {
          setValidation({
            isValidating: false,
            isValid: false,
            metadata: result.metadata || null,
            error: result.error,
            warnings: result.warnings || [],
          });
          onValidationError?.(result.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to validate video';
        setValidation({
          isValidating: false,
          isValid: false,
          metadata: null,
          error: errorMessage,
          warnings: [],
        });
        onValidationError?.(errorMessage);
      }
    }, 1000),
    [onVideoValidated, onValidationError]
  );

  // Auto-validate when URL changes
  useEffect(() => {
    if (autoValidate && url) {
      debouncedValidate(url);
    }
  }, [url, autoValidate, debouncedValidate]);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setUrl(newUrl);
  };

  const handleManualValidate = () => {
    if (url.trim()) {
      debouncedValidate(url);
    }
  };

  const getValidationIcon = () => {
    if (validation.isValidating) {
      return <CircularProgress size={20} />;
    }
    if (validation.isValid === true) {
      return <CheckCircle color="success" />;
    }
    if (validation.isValid === false) {
      return <Error color="error" />;
    }
    return null;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Box>
      {/* URL Input */}
      <TextField
        fullWidth
        label="YouTube Video URL"
        placeholder="https://www.youtube.com/watch?v=..."
        value={url}
        onChange={handleUrlChange}
        disabled={disabled}
        InputProps={{
          endAdornment: getValidationIcon(),
        }}
        helperText={
          validation.isValidating
            ? 'Validating video...'
            : validation.error
            ? validation.error
            : 'Enter a YouTube video URL to get started'
        }
        error={validation.isValid === false}
        sx={{ mb: 2 }}
      />

      {/* Manual Validate Button */}
      {!autoValidate && (
        <Button
          variant="outlined"
          onClick={handleManualValidate}
          disabled={disabled || !url.trim() || validation.isValidating}
          startIcon={validation.isValidating ? <CircularProgress size={16} /> : <PlayArrow />}
          sx={{ mb: 2 }}
        >
          Validate Video
        </Button>
      )}

      {/* Validation Progress */}
      {validation.isValidating && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Checking video availability and metadata...
          </Typography>
        </Box>
      )}

      {/* Warnings */}
      <AnimatePresence>
        {validation.warnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Please note:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>
                    <Typography variant="body2">{warning}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Preview */}
      <AnimatePresence>
        {showPreview && validation.metadata && validation.isValid && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
                {/* Thumbnail */}
                <CardMedia
                  component="img"
                  sx={{
                    width: { xs: '100%', md: 320 },
                    height: { xs: 200, md: 180 },
                    objectFit: 'cover',
                  }}
                  image={validation.metadata.thumbnail.high}
                  alt={validation.metadata.title}
                />
                
                {/* Content */}
                <CardContent sx={{ flex: 1, p: 2 }}>
                  <Typography variant="h6" component="h3" gutterBottom noWrap>
                    {validation.metadata.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {validation.metadata.channelTitle}
                  </Typography>
                  
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {validation.metadata.description}
                  </Typography>
                  
                  {/* Stats */}
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      icon={<AccessTime />}
                      label={formatDuration(validation.metadata.duration)}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      icon={<Visibility />}
                      label={`${formatNumber(validation.metadata.viewCount)} views`}
                      size="small"
                      variant="outlined"
                    />
                    {validation.metadata.likeCount && (
                      <Chip
                        icon={<ThumbUp />}
                        label={formatNumber(validation.metadata.likeCount)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  
                  {/* Tags */}
                  {validation.metadata.tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {validation.metadata.tags.slice(0, 5).map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      ))}
                      {validation.metadata.tags.length > 5 && (
                        <Chip
                          label={`+${validation.metadata.tags.length - 5} more`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </Box>
                  )}
                </CardContent>
              </Box>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <Collapse in={validation.isValid === true}>
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2">
            Video validated successfully!
          </Typography>
          <Typography variant="body2">
            This video is ready for processing. You can now create a learning capsule.
          </Typography>
        </Alert>
      </Collapse>
    </Box>
  );
};