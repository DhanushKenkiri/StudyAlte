import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Slider,
  Typography,
  LinearProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Fullscreen as FullscreenIcon,
  SkipPrevious as SkipPreviousIcon,
  SkipNext as SkipNextIcon,
} from '@mui/icons-material';

interface TranscriptSegmentData {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  confidence?: number;
}

interface VideoPlayerProps {
  videoUrl: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  segments?: TranscriptSegmentData[];
  autoPlay?: boolean;
  showControls?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  currentTime = 0,
  onTimeUpdate,
  segments = [],
  autoPlay = false,
  showControls = true,
}) => {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeVideoId(videoUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}` : null;

  // Sync external currentTime with video
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 1) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate?.(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleError = () => {
    setError('Failed to load video');
    setIsLoading(false);
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      onTimeUpdate?.(newTime);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const jumpToSegment = (direction: 'prev' | 'next') => {
    if (!segments.length || !videoRef.current) return;

    const currentVideoTime = videoRef.current.currentTime;
    let targetSegment: TranscriptSegmentData | null = null;

    if (direction === 'next') {
      targetSegment = segments.find(segment => segment.startTime > currentVideoTime) || null;
    } else {
      const reversedSegments = [...segments].reverse();
      targetSegment = reversedSegments.find(segment => segment.startTime < currentVideoTime - 1) || null;
    }

    if (targetSegment) {
      handleSeek(targetSegment.startTime);
    }
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

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" align="center">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // For YouTube videos, use iframe embed
  if (embedUrl) {
    return (
      <Card>
        <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
          <iframe
            src={embedUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Video Player"
          />
        </Box>
      </Card>
    );
  }

  // For other video sources, use HTML5 video element
  return (
    <Card>
      <Box sx={{ position: 'relative' }}>
        {isLoading && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}>
            <LinearProgress />
          </Box>
        )}
        
        <video
          ref={videoRef}
          src={videoUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          autoPlay={autoPlay}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />

        {showControls && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              color: 'white',
              p: 2,
            }}
          >
            {/* Progress Bar */}
            <Box sx={{ mb: 1 }}>
              <Slider
                value={currentTime}
                max={duration}
                onChange={(_, value) => handleSeek(value as number)}
                sx={{
                  color: 'white',
                  '& .MuiSlider-thumb': {
                    backgroundColor: 'white',
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: 'white',
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'rgba(255,255,255,0.3)',
                  },
                }}
              />
            </Box>

            {/* Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {segments.length > 0 && (
                  <Tooltip title="Previous segment">
                    <IconButton
                      size="small"
                      onClick={() => jumpToSegment('prev')}
                      sx={{ color: 'white' }}
                    >
                      <SkipPreviousIcon />
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                  <IconButton
                    onClick={togglePlayPause}
                    sx={{ color: 'white' }}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </IconButton>
                </Tooltip>

                {segments.length > 0 && (
                  <Tooltip title="Next segment">
                    <IconButton
                      size="small"
                      onClick={() => jumpToSegment('next')}
                      sx={{ color: 'white' }}
                    >
                      <SkipNextIcon />
                    </IconButton>
                  </Tooltip>
                )}

                <Typography variant="body2" sx={{ ml: 1 }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
                  <IconButton
                    size="small"
                    onClick={toggleMute}
                    sx={{ color: 'white' }}
                  >
                    {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                  </IconButton>
                </Tooltip>

                <Box sx={{ width: 100 }}>
                  <Slider
                    value={isMuted ? 0 : volume}
                    max={1}
                    step={0.1}
                    onChange={(_, value) => handleVolumeChange(value as number)}
                    sx={{
                      color: 'white',
                      '& .MuiSlider-thumb': {
                        backgroundColor: 'white',
                      },
                      '& .MuiSlider-track': {
                        backgroundColor: 'white',
                      },
                      '& .MuiSlider-rail': {
                        backgroundColor: 'rgba(255,255,255,0.3)',
                      },
                    }}
                  />
                </Box>

                <Tooltip title="Fullscreen">
                  <IconButton
                    size="small"
                    onClick={toggleFullscreen}
                    sx={{ color: 'white' }}
                  >
                    <FullscreenIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
};