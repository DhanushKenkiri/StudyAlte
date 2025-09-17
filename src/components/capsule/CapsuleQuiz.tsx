import React, { useState } from 'react';
import {
  Box,
  CardContent,
  Typography,
  Card,
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  Timer as TimerIcon,
  TrendingUp as ScoreIcon,
  CheckCircle as CheckIcon,
  Cancel as WrongIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface CapsuleQuizProps {
  capsuleData: any;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const CapsuleQuiz: React.FC<CapsuleQuizProps> = ({
  capsuleData,
  onStartStudy,
}) => {
  const theme = useTheme();
  const quiz = capsuleData.quiz;

  const getQuizStats = () => {
    const attempts = quiz.attempts || [];
    const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a: any) => a.score)) : 0;
    const averageScore = attempts.length > 0 
      ? attempts.reduce((sum: number, a: any) => sum + a.score, 0) / attempts.length 
      : 0;
    const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    
    return {
      totalQuestions: quiz.questions.length,
      attempts: attempts.length,
      bestScore,
      averageScore,
      lastAttempt,
      passed: bestScore >= quiz.passingScore,
    };
  };

  const stats = getQuizStats();

  const getDifficultyBreakdown = () => {
    const breakdown = { easy: 0, medium: 0, hard: 0 };
    quiz.questions.forEach((q: any) => {
      breakdown[q.difficulty as keyof typeof breakdown]++;
    });
    return breakdown;
  };

  const difficultyBreakdown = getDifficultyBreakdown();

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <CardContent>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Knowledge Quiz
          </Typography>
          
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayIcon />}
            onClick={() => onStartStudy?.(capsuleData.id, 'quiz')}
          >
            {stats.attempts > 0 ? 'Retake Quiz' : 'Start Quiz'}
          </Button>
        </Box>

        {/* Quiz Overview */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <QuizIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Quiz Information
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {stats.totalQuestions}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Questions
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                      {quiz.timeLimit ? Math.ceil(quiz.timeLimit / 60) : '∞'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {quiz.timeLimit ? 'Minutes' : 'No Limit'}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {quiz.passingScore}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Passing Score
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {stats.attempts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Attempts
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              {/* Difficulty Breakdown */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Question Difficulty
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={`${difficultyBreakdown.easy} Easy`}
                    size="small"
                    sx={{
                      backgroundColor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main,
                    }}
                  />
                  <Chip
                    label={`${difficultyBreakdown.medium} Medium`}
                    size="small"
                    sx={{
                      backgroundColor: alpha(theme.palette.warning.main, 0.1),
                      color: theme.palette.warning.main,
                    }}
                  />
                  <Chip
                    label={`${difficultyBreakdown.hard} Hard`}
                    size="small"
                    sx={{
                      backgroundColor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                    }}
                  />
                </Box>
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Your Performance
              </Typography>
              
              {stats.attempts > 0 ? (
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Best Score</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {stats.bestScore}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={stats.bestScore}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: alpha(theme.palette.success.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          backgroundColor: stats.bestScore >= quiz.passingScore 
                            ? theme.palette.success.main 
                            : theme.palette.warning.main,
                        },
                      }}
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Average Score</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {Math.round(stats.averageScore)}%
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {stats.passed ? (
                      <>
                        <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                          Passed
                        </Typography>
                      </>
                    ) : (
                      <>
                        <WrongIcon sx={{ color: 'error.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
                          Not Passed
                        </Typography>
                      </>
                    )}
                  </Box>
                  
                  {stats.lastAttempt && (
                    <Typography variant="caption" color="text.secondary">
                      Last attempt: {formatDistanceToNow(new Date(stats.lastAttempt.completedAt), { addSuffix: true })}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <QuizIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No attempts yet
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Take the quiz to see your performance
                  </Typography>
                </Box>
              )}
            </Card>
          </Grid>
        </Grid>

        {/* Question Preview */}
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Question Preview
        </Typography>
        
        <Grid container spacing={2}>
          {quiz.questions.slice(0, 3).map((question: any, index: number) => (
            <Grid item xs={12} key={question.id}>
              <Card sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ flex: 1, mr: 2 }}>
                    {index + 1}. {question.question}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={question.difficulty}
                      size="small"
                      sx={{
                        backgroundColor: alpha(
                          question.difficulty === 'easy' ? theme.palette.success.main :
                          question.difficulty === 'medium' ? theme.palette.warning.main :
                          theme.palette.error.main, 0.1
                        ),
                        color: question.difficulty === 'easy' ? theme.palette.success.main :
                               question.difficulty === 'medium' ? theme.palette.warning.main :
                               theme.palette.error.main,
                      }}
                    />
                    
                    <Chip
                      label={question.type.replace('-', ' ')}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                
                {question.type === 'multiple-choice' && question.options && (
                  <List dense>
                    {question.options.slice(0, 2).map((option: string, optionIndex: number) => (
                      <ListItem key={optionIndex} sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={`${String.fromCharCode(65 + optionIndex)}. ${option}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                    {question.options.length > 2 && (
                      <ListItem sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={`... and ${question.options.length - 2} more options`}
                          primaryTypographyProps={{ 
                            variant: 'body2', 
                            style: { fontStyle: 'italic', color: theme.palette.text.secondary }
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                )}
                
                {question.timestamp && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Chip
                      icon={<TimerIcon />}
                      label={`Video timestamp: ${Math.floor(question.timestamp / 60)}:${(question.timestamp % 60).toString().padStart(2, '0')}`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>

        {quiz.questions.length > 3 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              ... and {quiz.questions.length - 3} more questions
            </Typography>
          </Box>
        )}

        {/* Previous Attempts */}
        {stats.attempts > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Previous Attempts
            </Typography>
            
            <Card>
              <List>
                {quiz.attempts.slice(-5).reverse().map((attempt: any, index: number) => (
                  <ListItem key={attempt.id} divider={index < Math.min(quiz.attempts.length, 5) - 1}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {attempt.score}%
                          </Typography>
                          
                          <Chip
                            label={attempt.score >= quiz.passingScore ? 'Passed' : 'Failed'}
                            size="small"
                            color={attempt.score >= quiz.passingScore ? 'success' : 'error'}
                          />
                          
                          <Typography variant="body2" color="text.secondary">
                            Time: {formatTime(attempt.timeSpent)}
                          </Typography>
                        </Box>
                      }
                      secondary={formatDistanceToNow(new Date(attempt.completedAt), { addSuffix: true })}
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          </Box>
        )}
      </Box>
    </CardContent>
  );
};