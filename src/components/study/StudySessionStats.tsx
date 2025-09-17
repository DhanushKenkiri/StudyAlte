import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Timer as TimerIcon,
  Psychology as FlashcardIcon,
  TrendingUp as AccuracyIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';

interface StudySessionStatsProps {
  cardsStudied: number;
  correctAnswers: number;
  totalTime: number;
  totalCards: number;
  studyMode: 'new' | 'review' | 'all' | 'difficult';
}

export const StudySessionStats: React.FC<StudySessionStatsProps> = ({
  cardsStudied,
  correctAnswers,
  totalTime,
  totalCards,
  studyMode,
}) => {
  const theme = useTheme();

  const accuracy = cardsStudied > 0 ? (correctAnswers / cardsStudied) * 100 : 0;
  const progress = totalCards > 0 ? (cardsStudied / totalCards) * 100 : 0;
  const averageTimePerCard = cardsStudied > 0 ? totalTime / cardsStudied : 0;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return theme.palette.success.main;
    if (accuracy >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getStudyModeLabel = (mode: string) => {
    switch (mode) {
      case 'new':
        return 'New Cards';
      case 'review':
        return 'Review Cards';
      case 'difficult':
        return 'Difficult Cards';
      case 'all':
      default:
        return 'All Cards';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Study Session Progress
        </Typography>
        <Chip
          label={getStudyModeLabel(studyMode)}
          color="primary"
          sx={{ mb: 2 }}
        />
      </Box>

      {/* Progress Overview */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Session Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {cardsStudied} / {totalCards} cards
          </Typography>
        </Box>
        
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
            },
          }}
        />
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {Math.round(progress)}% complete
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <FlashcardIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {cardsStudied}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cards Studied
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={{ bgcolor: alpha(getAccuracyColor(accuracy), 0.05) }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <AccuracyIcon sx={{ fontSize: 32, color: getAccuracyColor(accuracy), mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {Math.round(accuracy)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Accuracy
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.05) }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <TimerIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {formatTime(totalTime)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.05) }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SpeedIcon sx={{ fontSize: 32, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {averageTimePerCard > 0 ? Math.round(averageTimePerCard) : 0}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg per Card
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Insights */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Performance Insights
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {accuracy >= 80 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.success.main,
                }}
              />
              <Typography variant="body2">
                Excellent accuracy! You're mastering these concepts.
              </Typography>
            </Box>
          )}
          
          {accuracy < 60 && cardsStudied > 3 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.warning.main,
                }}
              />
              <Typography variant="body2">
                Consider reviewing the material before continuing.
              </Typography>
            </Box>
          )}
          
          {averageTimePerCard > 30 && cardsStudied > 3 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.info.main,
                }}
              />
              <Typography variant="body2">
                Take your time to think through each answer.
              </Typography>
            </Box>
          )}
          
          {averageTimePerCard < 10 && accuracy > 90 && cardsStudied > 5 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.success.main,
                }}
              />
              <Typography variant="body2">
                Great speed and accuracy! You've got this down.
              </Typography>
            </Box>
          )}
          
          {cardsStudied === 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.grey[500],
                }}
              />
              <Typography variant="body2">
                Start studying to see your performance insights.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Study Recommendations */}
      {cardsStudied > 0 && (
        <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Next Steps
          </Typography>
          
          {accuracy >= 80 && progress >= 100 && (
            <Typography variant="body2">
              🎉 Session complete! Consider moving to more challenging cards or taking a break.
            </Typography>
          )}
          
          {accuracy < 60 && (
            <Typography variant="body2">
              📚 Review the material and try these cards again later for better retention.
            </Typography>
          )}
          
          {progress < 100 && accuracy >= 70 && (
            <Typography variant="body2">
              ⚡ You're doing well! Continue with the remaining {totalCards - cardsStudied} cards.
            </Typography>
          )}
          
          {cardsStudied >= 10 && totalTime > 600 && (
            <Typography variant="body2">
              ☕ You've been studying for a while. Consider taking a short break.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};