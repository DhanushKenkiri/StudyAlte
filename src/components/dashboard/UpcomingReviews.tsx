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
  Button,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Psychology as FlashcardIcon,
  Quiz as QuizIcon,
  Notifications as NotificationIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, isAfter, isBefore, addHours } from 'date-fns';

interface Review {
  id: string;
  type: 'flashcard' | 'quiz';
  title: string;
  dueDate: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

interface UpcomingReviewsProps {
  reviews: Review[];
  onReviewStart?: (reviewId: string) => void;
  loading?: boolean;
  maxItems?: number;
}

export const UpcomingReviews: React.FC<UpcomingReviewsProps> = ({
  reviews,
  onReviewStart,
  loading = false,
  maxItems = 5,
}) => {
  const theme = useTheme();

  const getReviewIcon = (type: Review['type']) => {
    switch (type) {
      case 'flashcard':
        return <FlashcardIcon fontSize="small" />;
      case 'quiz':
        return <QuizIcon fontSize="small" />;
      default:
        return <ScheduleIcon fontSize="small" />;
    }
  };

  const getReviewColor = (type: Review['type']) => {
    switch (type) {
      case 'flashcard':
        return theme.palette.warning.main;
      case 'quiz':
        return theme.palette.error.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const getDifficultyColor = (difficulty: Review['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return theme.palette.success.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'hard':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getUrgencyStatus = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const oneHour = addHours(now, 1);
    const sixHours = addHours(now, 6);

    if (isBefore(due, now)) {
      return { status: 'overdue', color: theme.palette.error.main, label: 'Overdue' };
    } else if (isBefore(due, oneHour)) {
      return { status: 'urgent', color: theme.palette.warning.main, label: 'Due soon' };
    } else if (isBefore(due, sixHours)) {
      return { status: 'upcoming', color: theme.palette.info.main, label: 'Due today' };
    } else {
      return { status: 'scheduled', color: theme.palette.success.main, label: 'Scheduled' };
    }
  };

  const formatDueTime = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    
    if (isBefore(due, now)) {
      return `${formatDistanceToNow(due)} ago`;
    } else {
      return `in ${formatDistanceToNow(due)}`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upcoming Reviews
          </Typography>
          <List>
            {[...Array(3)].map((_, index) => (
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

  // Sort reviews by due date
  const sortedReviews = [...reviews].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  const displayReviews = sortedReviews.slice(0, maxItems);
  const overdueCount = reviews.filter(review => 
    isBefore(new Date(review.dueDate), new Date())
  ).length;

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" component="h2">
              Upcoming Reviews
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {overdueCount > 0 && (
              <Chip
                icon={<NotificationIcon />}
                label={`${overdueCount} overdue`}
                size="small"
                color="error"
                variant="outlined"
              />
            )}
            <Chip
              label={`${reviews.length} total`}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Reviews List */}
        {displayReviews.length === 0 ? (
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
            <ScheduleIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">
              No reviews scheduled
            </Typography>
            <Typography variant="caption">
              Complete some learning activities to schedule reviews
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {displayReviews.map((review, index) => {
              const reviewColor = getReviewColor(review.type);
              const difficultyColor = getDifficultyColor(review.difficulty);
              const urgency = getUrgencyStatus(review.dueDate);
              
              return (
                <React.Fragment key={review.id}>
                  <ListItem
                    sx={{
                      borderRadius: 2,
                      mb: index < displayReviews.length - 1 ? 1 : 0,
                      border: urgency.status === 'overdue' ? `1px solid ${alpha(theme.palette.error.main, 0.3)}` : 'none',
                      backgroundColor: urgency.status === 'overdue' ? alpha(theme.palette.error.main, 0.02) : 'transparent',
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          backgroundColor: alpha(reviewColor, 0.1),
                          color: reviewColor,
                          width: 40,
                          height: 40,
                        }}
                      >
                        {getReviewIcon(review.type)}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
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
                            {review.title}
                          </Typography>
                          
                          <Chip
                            label={urgency.label}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: alpha(urgency.color, 0.1),
                              color: urgency.color,
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip
                              label={review.type === 'flashcard' ? 'Flashcards' : 'Quiz'}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                backgroundColor: alpha(reviewColor, 0.1),
                                color: reviewColor,
                              }}
                            />
                            
                            <Chip
                              label={review.difficulty}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                backgroundColor: alpha(difficultyColor, 0.1),
                                color: difficultyColor,
                              }}
                            />
                            
                            <Typography variant="caption" color="text.secondary">
                              {review.count} {review.type === 'flashcard' ? 'cards' : 'questions'}
                            </Typography>
                          </Box>
                          
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            Due {formatDueTime(review.dueDate)}
                          </Typography>
                        </Box>
                      }
                    />
                    
                    {/* Start Button */}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<StartIcon />}
                      onClick={() => onReviewStart?.(review.id)}
                      sx={{
                        ml: 1,
                        borderColor: alpha(reviewColor, 0.3),
                        color: reviewColor,
                        '&:hover': {
                          borderColor: reviewColor,
                          backgroundColor: alpha(reviewColor, 0.08),
                        },
                      }}
                    >
                      Start
                    </Button>
                  </ListItem>
                  
                  {index < displayReviews.length - 1 && (
                    <Divider variant="inset" component="li" />
                  )}
                </React.Fragment>
              );
            })}
          </List>
        )}

        {/* Show More Link */}
        {reviews.length > maxItems && (
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
              View all {reviews.length} reviews
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};