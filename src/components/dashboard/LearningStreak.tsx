import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import {
  LocalFireDepartment as StreakIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

interface LearningStreakProps {
  streak: number;
  weeklyProgress: number;
  monthlyProgress: number;
  loading?: boolean;
}

export const LearningStreak: React.FC<LearningStreakProps> = ({
  streak,
  weeklyProgress,
  monthlyProgress,
  loading = false,
}) => {
  const theme = useTheme();

  const getStreakColor = (days: number) => {
    if (days >= 30) return theme.palette.error.main; // Fire red for long streaks
    if (days >= 14) return theme.palette.warning.main; // Orange for good streaks
    if (days >= 7) return theme.palette.info.main; // Blue for week streaks
    if (days >= 3) return theme.palette.success.main; // Green for starting streaks
    return theme.palette.grey[500]; // Grey for short streaks
  };

  const getStreakMessage = (days: number) => {
    if (days >= 30) return 'Amazing streak! 🔥';
    if (days >= 14) return 'Great momentum! 💪';
    if (days >= 7) return 'Keep it up! 🚀';
    if (days >= 3) return 'Good start! 👍';
    if (days >= 1) return 'Getting started! 🌱';
    return 'Start your streak today! ⭐';
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return theme.palette.success.main;
    if (progress >= 70) return theme.palette.info.main;
    if (progress >= 50) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  if (loading) {
    return (
      <Card sx={{ height: 200 }}>
        <CardContent>
          <Box sx={{ height: '100%', bgcolor: 'action.hover', borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  const streakColor = getStreakColor(streak);
  const weeklyColor = getProgressColor(weeklyProgress);
  const monthlyColor = getProgressColor(monthlyProgress);

  return (
    <Card sx={{ height: 200 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <StreakIcon sx={{ mr: 1, color: streakColor }} />
          <Typography variant="h6" component="h2">
            Learning Streak
          </Typography>
        </Box>

        {/* Streak Display */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: alpha(streakColor, 0.1),
              border: `3px solid ${alpha(streakColor, 0.3)}`,
              mb: 1,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: streakColor,
                lineHeight: 1,
              }}
            >
              {streak}
            </Typography>
          </Box>
          
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {streak === 1 ? 'Day' : 'Days'}
          </Typography>
          
          <Typography
            variant="caption"
            sx={{
              color: streakColor,
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            {getStreakMessage(streak)}
          </Typography>
        </Box>

        {/* Progress Indicators */}
        <Box sx={{ flex: 1 }}>
          {/* Weekly Progress */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                This Week
              </Typography>
              <Chip
                label={`${weeklyProgress}%`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: alpha(weeklyColor, 0.1),
                  color: weeklyColor,
                }}
              />
            </Box>
            
            <LinearProgress
              variant="determinate"
              value={weeklyProgress}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: alpha(weeklyColor, 0.2),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: weeklyColor,
                },
              }}
            />
          </Box>

          {/* Monthly Progress */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                This Month
              </Typography>
              <Chip
                label={`${monthlyProgress}%`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: alpha(monthlyColor, 0.1),
                  color: monthlyColor,
                }}
              />
            </Box>
            
            <LinearProgress
              variant="determinate"
              value={monthlyProgress}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: alpha(monthlyColor, 0.2),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: monthlyColor,
                },
              }}
            />
          </Box>
        </Box>

        {/* Motivational Footer */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {streak === 0 
                ? 'Start learning today to begin your streak!'
                : `Keep going to reach ${streak + 1} days!`
              }
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};