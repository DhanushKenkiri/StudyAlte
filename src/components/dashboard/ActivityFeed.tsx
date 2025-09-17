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
  Chip,
  IconButton,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  Quiz as QuizIcon,
  Psychology as FlashcardIcon,
  Notes as NotesIcon,
  AccountTree as MindMapIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: 'video' | 'quiz' | 'flashcard' | 'note' | 'mindmap';
  title: string;
  description: string;
  timestamp: string;
  progress?: number;
  score?: number;
}

interface ActivityFeedProps {
  activities: Activity[];
  onActivityClick?: (activity: Activity) => void;
  loading?: boolean;
  maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  onActivityClick,
  loading = false,
  maxItems = 10,
}) => {
  const theme = useTheme();

  const getActivityIcon = (type: Activity['type']) => {
    const iconProps = { fontSize: 'small' as const };
    
    switch (type) {
      case 'video':
        return <VideoIcon {...iconProps} />;
      case 'quiz':
        return <QuizIcon {...iconProps} />;
      case 'flashcard':
        return <FlashcardIcon {...iconProps} />;
      case 'note':
        return <NotesIcon {...iconProps} />;
      case 'mindmap':
        return <MindMapIcon {...iconProps} />;
      default:
        return <PlayIcon {...iconProps} />;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'video':
        return theme.palette.primary.main;
      case 'quiz':
        return theme.palette.error.main;
      case 'flashcard':
        return theme.palette.warning.main;
      case 'note':
        return theme.palette.success.main;
      case 'mindmap':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getActivityTypeLabel = (type: Activity['type']) => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'quiz':
        return 'Quiz';
      case 'flashcard':
        return 'Flashcard';
      case 'note':
        return 'Note';
      case 'mindmap':
        return 'Mind Map';
      default:
        return 'Activity';
    }
  };

  const formatActivityDescription = (activity: Activity) => {
    let description = activity.description;
    
    if (activity.progress !== undefined) {
      description += ` (${activity.progress}% complete)`;
    }
    
    if (activity.score !== undefined) {
      description += ` - Score: ${activity.score}%`;
    }
    
    return description;
  };

  if (loading) {
    return (
      <Card sx={{ height: 400 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <List>
            {[...Array(5)].map((_, index) => (
              <ListItem key={index}>
                <ListItemAvatar>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'action.hover',
                      borderRadius: '50%',
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

  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card sx={{ height: 400 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" component="h2">
              Recent Activity
            </Typography>
          </Box>
          
          <Chip
            label={`${activities.length} activities`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Activity List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {displayActivities.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
              <Typography variant="body2">
                No recent activity
              </Typography>
              <Typography variant="caption">
                Start learning to see your progress here
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {displayActivities.map((activity, index) => {
                const color = getActivityColor(activity.type);
                const isCompleted = activity.progress === 100;
                
                return (
                  <React.Fragment key={activity.id}>
                    <ListItem
                      onClick={() => onActivityClick?.(activity)}
                      sx={{
                        cursor: onActivityClick ? 'pointer' : 'default',
                        borderRadius: 2,
                        mb: 1,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': onActivityClick ? {
                          backgroundColor: alpha(color, 0.05),
                          transform: 'translateX(4px)',
                        } : {},
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            backgroundColor: alpha(color, 0.1),
                            color: color,
                            width: 40,
                            height: 40,
                          }}
                        >
                          {getActivityIcon(activity.type)}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 600,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {activity.title}
                            </Typography>
                            
                            {isCompleted && (
                              <CheckIcon
                                sx={{
                                  fontSize: 16,
                                  color: 'success.main',
                                }}
                              />
                            )}
                            
                            <Chip
                              label={getActivityTypeLabel(activity.type)}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                backgroundColor: alpha(color, 0.1),
                                color: color,
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                mb: 0.5,
                              }}
                            >
                              {formatActivityDescription(activity)}
                            </Typography>
                            
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontSize: '0.7rem' }}
                            >
                              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                            </Typography>
                          </Box>
                        }
                      />
                      
                      {onActivityClick && (
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </ListItem>
                    
                    {index < displayActivities.length - 1 && (
                      <Divider variant="inset" component="li" />
                    )}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Box>

        {/* Show More Link */}
        {activities.length > maxItems && (
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
              View all {activities.length} activities
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};