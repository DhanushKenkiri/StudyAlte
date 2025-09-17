import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RetryIcon,
  Home as HomeIcon,
  Visibility as ReviewIcon,
  TrendingUp as StatsIcon,
  Timer as TimerIcon,
  Psychology as BrainIcon,
} from '@mui/icons-material';
import { QuestionComponent } from './QuestionComponent';

interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timestamp?: number;
  points: number;
}

interface QuizAttempt {
  id: string;
  startTime: string;
  endTime?: string;
  answers: Map<string, any>;
  score: number;
  timeSpent: number;
  completed: boolean;
}

interface QuizResultsProps {
  attempt: QuizAttempt;
  questions: Question[];
  passingScore: number;
  onReview?: () => void;
  onRetry?: () => void;
  onExit?: () => void;
  allowReview?: boolean;
}

export const QuizResults: React.FC<QuizResultsProps> = ({
  attempt,
  questions,
  passingScore,
  onReview,
  onRetry,
  onExit,
  allowReview = true,
}) => {
  const theme = useTheme();
  const [showDetailedReview, setShowDetailedReview] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | false>(false);

  const passed = attempt.score >= passingScore;
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = Math.round((attempt.score / 100) * totalPoints);

  // Calculate detailed statistics
  const getDetailedStats = () => {
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;
    const difficultyStats = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
    const typeStats = { 'multiple-choice': { correct: 0, total: 0 }, 'true-false': { correct: 0, total: 0 }, 'short-answer': { correct: 0, total: 0 } };

    questions.forEach(question => {
      const userAnswer = attempt.answers.get(question.id);
      difficultyStats[question.difficulty].total++;
      typeStats[question.type].total++;

      if (userAnswer === undefined) {
        unansweredQuestions++;
      } else {
        let isCorrect = false;
        
        if (question.type === 'multiple-choice' || question.type === 'true-false') {
          isCorrect = userAnswer === question.correctAnswer;
        } else if (question.type === 'short-answer') {
          const correct = String(question.correctAnswer).toLowerCase().trim();
          const user = String(userAnswer).toLowerCase().trim();
          isCorrect = correct === user;
        }

        if (isCorrect) {
          correctAnswers++;
          difficultyStats[question.difficulty].correct++;
          typeStats[question.type].correct++;
        } else {
          incorrectAnswers++;
        }
      }
    });

    return {
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      difficultyStats,
      typeStats,
    };
  };

  const stats = getDetailedStats();

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPerformanceMessage = () => {
    if (attempt.score >= 90) {
      return {
        message: "Outstanding performance! You've mastered this material.",
        color: 'success.main',
        icon: <BrainIcon />,
      };
    } else if (attempt.score >= 80) {
      return {
        message: "Great job! You have a solid understanding of the material.",
        color: 'success.main',
        icon: <CheckCircle />,
      };
    } else if (attempt.score >= passingScore) {
      return {
        message: "Good work! You've passed, but there's room for improvement.",
        color: 'info.main',
        icon: <CheckCircle />,
      };
    } else if (attempt.score >= 50) {
      return {
        message: "You're getting there! Review the material and try again.",
        color: 'warning.main',
        icon: <StatsIcon />,
      };
    } else {
      return {
        message: "Don't give up! Review the material thoroughly and retake the quiz.",
        color: 'error.main',
        icon: <RetryIcon />,
      };
    }
  };

  const performance = getPerformanceMessage();

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedQuestion(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Results Header */}
        <Card sx={{ mb: 3, textAlign: 'center' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ mb: 3 }}>
              {passed ? (
                <PassIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              ) : (
                <FailIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              )}
              
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                {passed ? 'Congratulations!' : 'Quiz Complete'}
              </Typography>
              
              <Typography variant="h2" sx={{ fontWeight: 800, color: passed ? 'success.main' : 'error.main', mb: 1 }}>
                {attempt.score}%
              </Typography>
              
              <Chip
                label={passed ? 'PASSED' : 'FAILED'}
                color={passed ? 'success' : 'error'}
                size="large"
                sx={{ fontSize: '1rem', fontWeight: 600, px: 2, py: 1 }}
              />
            </Box>

            <Alert severity={passed ? 'success' : 'error'} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {performance.icon}
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {performance.message}
                </Typography>
              </Box>
            </Alert>

            <Typography variant="body1" color="text.secondary">
              You scored {earnedPoints} out of {totalPoints} points
              {passingScore > 0 && ` (${passingScore}% required to pass)`}
            </Typography>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {stats.correctAnswers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Correct
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {stats.incorrectAnswers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Incorrect
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {stats.unansweredQuestions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Skipped
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <TimerIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatTime(attempt.timeSpent)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Time Spent
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Detailed Performance Analysis */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Performance Analysis
            </Typography>
            
            {/* By Difficulty */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Performance by Difficulty
              </Typography>
              
              {Object.entries(stats.difficultyStats).map(([difficulty, stat]) => {
                const percentage = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
                const color = difficulty === 'easy' ? 'success' : difficulty === 'medium' ? 'warning' : 'error';
                
                return (
                  <Box key={difficulty} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {difficulty}
                      </Typography>
                      <Typography variant="body2">
                        {stat.correct}/{stat.total} ({Math.round(percentage)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      color={color as any}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                );
              })}
            </Box>

            {/* By Question Type */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Performance by Question Type
              </Typography>
              
              {Object.entries(stats.typeStats).map(([type, stat]) => {
                const percentage = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
                const displayName = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return (
                  <Box key={type} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2">
                        {displayName}
                      </Typography>
                      <Typography variant="body2">
                        {stat.correct}/{stat.total} ({Math.round(percentage)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3, flexWrap: 'wrap' }}>
          {allowReview && (
            <Button
              variant="outlined"
              startIcon={<ReviewIcon />}
              onClick={() => setShowDetailedReview(!showDetailedReview)}
              size="large"
            >
              {showDetailedReview ? 'Hide' : 'Review'} Answers
            </Button>
          )}
          
          {onRetry && (
            <Button
              variant="outlined"
              startIcon={<RetryIcon />}
              onClick={onRetry}
              size="large"
            >
              Retake Quiz
            </Button>
          )}
          
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={onExit}
            size="large"
          >
            Back to Course
          </Button>
        </Box>

        {/* Detailed Review */}
        {showDetailedReview && allowReview && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Detailed Answer Review
              </Typography>
              
              {questions.map((question, index) => (
                <Accordion
                  key={question.id}
                  expanded={expandedQuestion === question.id}
                  onChange={handleAccordionChange(question.id)}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ flex: 1 }}>
                        Question {index + 1}
                      </Typography>
                      
                      {(() => {
                        const userAnswer = attempt.answers.get(question.id);
                        let isCorrect = false;
                        
                        if (userAnswer !== undefined) {
                          if (question.type === 'multiple-choice' || question.type === 'true-false') {
                            isCorrect = userAnswer === question.correctAnswer;
                          } else if (question.type === 'short-answer') {
                            const correct = String(question.correctAnswer).toLowerCase().trim();
                            const user = String(userAnswer).toLowerCase().trim();
                            isCorrect = correct === user;
                          }
                        }
                        
                        return (
                          <Chip
                            label={userAnswer === undefined ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect'}
                            color={userAnswer === undefined ? 'default' : isCorrect ? 'success' : 'error'}
                            size="small"
                          />
                        );
                      })()}
                    </Box>
                  </AccordionSummary>
                  
                  <AccordionDetails>
                    <QuestionComponent
                      question={question}
                      questionNumber={index + 1}
                      totalQuestions={questions.length}
                      answer={attempt.answers.get(question.id)}
                      onAnswer={() => {}} // Read-only in review mode
                      showExplanation={true}
                      showCorrectAnswer={true}
                      isReviewMode={true}
                    />
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};