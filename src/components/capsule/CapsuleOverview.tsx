import React from 'react';
import {
  Box,
  CardContent,
  Typography,
  Grid,
  Card,
  Button,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Psychology as FlashcardsIcon,
  Quiz as QuizIcon,
  Notes as NotesIcon,
  AccountTree as MindMapIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  TrendingUp as ProgressIcon,
  Star as StarIcon,
} from '@mui/icons-material';

interface CapsuleOverviewProps {
  capsuleData: any;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const CapsuleOverview: React.FC<CapsuleOverviewProps> = ({
  capsuleData,
  onStartStudy,
}) => {
  const theme = useTheme();

  const studyMaterials = [
    {
      id: 'summary',
      title: 'Summary',
      description: 'AI-generated key points and concepts',
      icon: <NotesIcon />,
      color: theme.palette.success.main,
      count: capsuleData.summary.sections.length,
      unit: 'sections',
      estimatedTime: 5,
      completed: false,
    },
    {
      id: 'flashcards',
      title: 'Flashcards',
      description: 'Interactive cards for spaced repetition',
      icon: <FlashcardsIcon />,
      color: theme.palette.warning.main,
      count: capsuleData.flashcards.length,
      unit: 'cards',
      estimatedTime: Math.ceil(capsuleData.flashcards.length * 0.5),
      completed: false,
    },
    {
      id: 'quiz',
      title: 'Quiz',
      description: 'Test your understanding',
      icon: <QuizIcon />,
      color: theme.palette.error.main,
      count: capsuleData.quiz.questions.length,
      unit: 'questions',
      estimatedTime: Math.ceil(capsuleData.quiz.questions.length * 1.5),
      completed: capsuleData.quiz.attempts.length > 0,
    },
    {
      id: 'mindmap',
      title: 'Mind Map',
      description: 'Visual concept relationships',
      icon: <MindMapIcon />,
      color: theme.palette.info.main,
      count: capsuleData.mindMap.nodes.length,
      unit: 'concepts',
      estimatedTime: 10,
      completed: false,
    },
  ];

  const getProgressStats = () => {
    const totalMaterials = studyMaterials.length;
    const completedMaterials = studyMaterials.filter(m => m.completed).length;
    const progressPercentage = (completedMaterials / totalMaterials) * 100;
    
    return {
      completed: completedMaterials,
      total: totalMaterials,
      percentage: progressPercentage,
    };
  };

  const progress = getProgressStats();

  return (
    <CardContent>
      <Grid container spacing={3}>
        {/* Progress Overview */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            <ProgressIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {Math.round(progress.percentage)}%
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Overall Progress
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress.percentage}
              sx={{
                height: 8,
                borderRadius: 4,
                mt: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {progress.completed} of {progress.total} materials completed
            </Typography>
          </Card>
        </Grid>

        {/* Study Time */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.05) }}>
            <ScheduleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {capsuleData.estimatedStudyTime}m
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Estimated Study Time
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Based on your learning pace
            </Typography>
          </Card>
        </Grid>

        {/* Difficulty */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
            <StarIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textTransform: 'capitalize' }}>
              {capsuleData.difficulty}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Difficulty Level
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Suitable for your skill level
            </Typography>
          </Card>
        </Grid>

        {/* Study Materials */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            Study Materials
          </Typography>
          
          <Grid container spacing={2}>
            {studyMaterials.map((material) => (
              <Grid item xs={12} sm={6} md={3} key={material.id}>
                <Card
                  sx={{
                    p: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        backgroundColor: alpha(material.color, 0.1),
                        color: material.color,
                        mr: 2,
                      }}
                    >
                      {material.icon}
                    </Box>
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {material.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {material.count} {material.unit}
                      </Typography>
                    </Box>
                    
                    {material.completed && (
                      <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex: 1 }}>
                    {material.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Chip
                      label={`~${material.estimatedTime} min`}
                      size="small"
                      variant="outlined"
                    />
                    {material.completed && (
                      <Chip
                        label="Completed"
                        size="small"
                        color="success"
                        icon={<CheckIcon />}
                      />
                    )}
                  </Box>
                  
                  <Button
                    variant={material.completed ? 'outlined' : 'contained'}
                    startIcon={<PlayIcon />}
                    onClick={() => onStartStudy?.(capsuleData.id, material.id)}
                    sx={{
                      backgroundColor: material.completed ? 'transparent' : material.color,
                      borderColor: material.color,
                      color: material.completed ? material.color : 'white',
                      '&:hover': {
                        backgroundColor: material.completed 
                          ? alpha(material.color, 0.1) 
                          : alpha(material.color, 0.8),
                      },
                    }}
                  >
                    {material.completed ? 'Review' : 'Start'}
                  </Button>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Key Insights */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Key Insights
          </Typography>
          
          <Card sx={{ p: 2 }}>
            <List dense>
              {capsuleData.summary.keyPoints.slice(0, 5).map((point: string, index: number) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={point}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { lineHeight: 1.4 },
                    }}
                  />
                </ListItem>
              ))}
            </List>
            
            {capsuleData.summary.keyPoints.length > 5 && (
              <Button
                size="small"
                onClick={() => onStartStudy?.(capsuleData.id, 'summary')}
                sx={{ mt: 1 }}
              >
                View All Insights
              </Button>
            )}
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Recent Activity
          </Typography>
          
          <Card sx={{ p: 2 }}>
            {capsuleData.quiz.attempts.length > 0 ? (
              <List dense>
                {capsuleData.quiz.attempts.slice(0, 3).map((attempt: any, index: number) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <QuizIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Quiz completed - ${attempt.score}%`}
                      secondary={new Date(attempt.completedAt).toLocaleDateString()}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No activity yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Start studying to see your progress here
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </CardContent>
  );
};