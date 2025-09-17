import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  LinearProgress,
  IconButton,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  PlayArrow as PlayIcon,
  MoreVert as MoreVertIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  progress: number;
  lastWatched: string;
  channelTitle: string;
}

interface RecentVideosProps {
  videos: Video[];
  onVideoClick?: (videoId: string) => void;
  loading?: boolean;
  maxItems?: number;
}

export const RecentVideos: React.FC<RecentVideosProps> = ({
  videos,
  onVideoClick,
  loading = false,
  maxItems = 5,
}) => {
  const theme = useTheme();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return theme.palette.success.main;
    if (progress >= 75) return theme.palette.info.main;
    if (progress >= 50) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  const getProgressLabel = (progress: number) => {
    if (progress === 100) return 'Completed';
    if (progress >= 75) return 'Almost done';
    if (progress >= 50) return 'In progress';
    if (progress > 0) return 'Started';
    return 'Not started';
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Videos
          </Typography>
          <List>
            {[...Array(3)].map((_, index) => (
              <ListItem key={index}>
                <ListItemAvatar>
                  <Box
                    sx={{
                      width: 80,
                      height: 45,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  />
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ height: 16, bgcolor: 'action.hover', borderRadius: 1, mb: 1 }} />
                  }
                  secondary={
                    <Box sx={{ height: 12, width: '70%', bgcolor: 'action.hover', borderRadius: 1 }} />
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  }

  const displayVideos = videos.slice(0, maxItems);

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <VideoIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" component="h2">
              Recent Videos
            </Typography>
          </Box>
          
          <Chip
            label={`${videos.length} videos`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Videos List */}
        {displayVideos.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <VideoIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">
              No videos yet
            </Typography>
            <Typography variant="caption">
              Add your first YouTube video to get started
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {displayVideos.map((video, index) => {
              const progressColor = getProgressColor(video.progress);
              
              return (
                <ListItem
                  key={video.id}
                  onClick={() => onVideoClick?.(video.id)}
                  sx={{
                    cursor: onVideoClick ? 'pointer' : 'default',
                    borderRadius: 2,
                    mb: index < displayVideos.length - 1 ? 1 : 0,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': onVideoClick ? {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      transform: 'translateX(4px)',
                    } : {},
                  }}
                >
                  {/* Thumbnail */}
                  <ListItemAvatar>
                    <Box
                      sx={{
                        position: 'relative',
                        width: 80,
                        height: 45,
                        borderRadius: 1,
                        overflow: 'hidden',
                        backgroundColor: 'action.hover',
                      }}
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      
                      {/* Duration overlay */}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          color: 'white',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        {formatDuration(video.duration)}
                      </Box>
                      
                      {/* Play button overlay */}
                      {onVideoClick && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '50%',
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s ease-in-out',
                            '.MuiListItem-root:hover &': {
                              opacity: 1,
                            },
                          }}
                        >
                          <PlayIcon sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                      )}
                    </Box>
                  </ListItemAvatar>
                  
                  {/* Content */}
                  <ListItemText
                    primary={
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.3,
                            mb: 0.5,
                          }}
                        >
                          {video.title}
                        </Typography>
                        
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 1 }}
                        >
                          {video.channelTitle}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        {/* Progress Bar */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={video.progress}
                            sx={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: alpha(progressColor, 0.2),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 2,
                                backgroundColor: progressColor,
                              },
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              ml: 1,
                              fontWeight: 600,
                              color: progressColor,
                              minWidth: 35,
                            }}
                          >
                            {video.progress}%
                          </Typography>
                        </Box>
                        
                        {/* Status and Last Watched */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Chip
                            label={getProgressLabel(video.progress)}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: alpha(progressColor, 0.1),
                              color: progressColor,
                            }}
                          />
                          
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <TimeIcon sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary' }} />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontSize: '0.7rem' }}
                            >
                              {formatDistanceToNow(new Date(video.lastWatched), { addSuffix: true })}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    }
                  />
                  
                  {/* Actions */}
                  <IconButton size="small" sx={{ color: 'text.secondary' }}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </ListItem>
              );
            })}
          </List>
        )}

        {/* Show More Link */}
        {videos.length > maxItems && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography
              variant="body2"
              color="primary"
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              View all {videos.length} videos
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};