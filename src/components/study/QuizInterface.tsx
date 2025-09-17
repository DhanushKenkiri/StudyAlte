import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Fab,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Timer as TimerIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Flag as FlagIcon,
  Help as HelpIcon,
  Assessment as ResultsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestionComponent } from './QuestionComponent';
import { QuizResults } from './QuizResults';
import { QuizTimer } from './QuizTimer';

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

interface QuizInterfaceProps {
  quizId: string;
  title: string;
  questions: Question[];
  timeLimit?: number; // in seconds
  passingScore: number;
  allowReview?: boolean;
  shuffleQuestions?: boolean;
  onComplete?: (attempt: QuizAttempt) => void;
  onExit?: () => void;
}

export const QuizInterface: React.FC<QuizInterfaceProps> = ({
  quizId,
  title,
  questions,
  timeLimit,
  passingScore,
  allowReview = true,
  shuffleQuestions = false,
  onComplete,
  onExit,
}) => {
  const theme = useTheme();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, any>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0);
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout>();

  // Shuffle questions if requested
  const [shuffledQuestions] = useState(() => {
    if (shuffleQuestions) {
      return [...questions].sort(() => Math.random() - 0.5);
    }
    return questions;
  });

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const progress = shuffledQuestions.length > 0 ? ((currentQuestionIndex + 1) / shuffledQuestions.length) * 100 : 0;
  const answeredCount = answers.size;
  const totalQuestions = shuffledQuestions.length;

  // Timer management
  useEffect(() => {
    if (isStarted && !isPaused && !isCompleted && timeLimit) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStarted, isPaused, isCompleted, timeLimit]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isStarted || isPaused || isCompleted) return;

      switch (event.key.toLowerCase()) {
        case 'arrowleft':
          event.preventDefault();
          handlePrevious();
          break;
        case 'arrowright':
          event.preventDefault();
          handleNext();
          break;
        case 'f':
          event.preventDefault();
          handleToggleFlag();
          break;
        case 'enter':
          if (event.ctrlKey) {
            event.preventDefault();
            handleSubmit();
          }
          break;
        case 'escape':
          event.preventDefault();
          setIsPaused(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isStarted, isPaused, isCompleted, currentQuestionIndex]);

  const handleStart = () => {
    setIsStarted(true);
    startTimeRef.current = Date.now();
    
    const newAttempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      startTime: new Date().toISOString(),
      answers: new Map(),
      score: 0,
      timeSpent: 0,
      completed: false,
    };
    setAttempt(newAttempt);
  };

  const handleAnswer = (questionId: string, answer: any) => {
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, answer);
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleToggleFlag = () => {
    const newFlagged = new Set(flaggedQuestions);
    if (newFlagged.has(currentQuestion.id)) {
      newFlagged.delete(currentQuestion.id);
    } else {
      newFlagged.add(currentQuestion.id);
    }
    setFlaggedQuestions(newFlagged);
  };

  const calculateScore = useCallback(() => {
    let totalPoints = 0;
    let earnedPoints = 0;

    shuffledQuestions.forEach(question => {
      totalPoints += question.points;
      const userAnswer = answers.get(question.id);
      
      if (userAnswer !== undefined) {
        if (question.type === 'multiple-choice') {
          if (userAnswer === question.correctAnswer) {
            earnedPoints += question.points;
          }
        } else if (question.type === 'true-false') {
          if (userAnswer === question.correctAnswer) {
            earnedPoints += question.points;
          }
        } else if (question.type === 'short-answer') {
          // Simple string comparison for short answers
          const correct = String(question.correctAnswer).toLowerCase().trim();
          const user = String(userAnswer).toLowerCase().trim();
          if (correct === user) {
            earnedPoints += question.points;
          }
        }
      }
    });

    return totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  }, [shuffledQuestions, answers]);

  const handleSubmit = () => {
    if (answeredCount < totalQuestions) {
      setShowConfirmSubmit(true);
    } else {
      completeQuiz();
    }
  };

  const handleAutoSubmit = () => {
    completeQuiz();
  };

  const completeQuiz = () => {
    const endTime = Date.now();
    const timeSpent = Math.floor((endTime - startTimeRef.current) / 1000);
    const score = calculateScore();

    const completedAttempt: QuizAttempt = {
      id: attempt?.id || `attempt-${Date.now()}`,
      startTime: attempt?.startTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      answers,
      score,
      timeSpent,
      completed: true,
    };

    setAttempt(completedAttempt);
    setIsCompleted(true);
    setShowResults(true);
    onComplete?.(completedAttempt);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleExit = () => {
    if (isStarted && !isCompleted) {
      setShowConfirmExit(true);
    } else {
      onExit?.();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (!timeLimit) return 'text.primary';
    const percentage = (timeRemaining / timeLimit) * 100;
    if (percentage <= 10) return 'error.main';
    if (percentage <= 25) return 'warning.main';
    return 'text.primary';
  };

  // Pre-quiz screen
  if (!isStarted) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Card sx={{ maxWidth: 600, p: 4 }}>
          <CardContent>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
              <Chip
                label={`${totalQuestions} questions`}
                color="primary"
              />
              {timeLimit && (
                <Chip
                  label={`${Math.ceil(timeLimit / 60)} minutes`}
                  color="warning"
                  icon={<TimerIcon />}
                />
              )}
              <Chip
                label={`${passingScore}% to pass`}
                color="success"
              />
            </Box>

            <Typography variant="body1" paragraph>
              Test your understanding of the material with this comprehensive quiz.
              {timeLimit && ` You have ${Math.ceil(timeLimit / 60)} minutes to complete all questions.`}
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                Quiz Instructions:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Answer all questions to the best of your ability</li>
                <li>You can navigate between questions using the arrow keys</li>
                <li>Flag questions for review using the flag button or 'F' key</li>
                {allowReview && <li>Review your answers before submitting</li>}
                {timeLimit && <li>Submit before time runs out to avoid auto-submission</li>}
              </ul>
            </Alert>

            <Button
              variant="contained"
              size="large"
              startIcon={<StartIcon />}
              onClick={handleStart}
              sx={{ minWidth: 200 }}
            >
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Quiz results screen
  if (showResults && attempt) {
    return (
      <QuizResults
        attempt={attempt}
        questions={shuffledQuestions}
        passingScore={passingScore}
        onReview={() => setShowResults(false)}
        onExit={onExit}
        allowReview={allowReview}
      />
    );
  }

  // Main quiz interface
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${theme.palette.divider}`,
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handleExit}>
              <CloseIcon />
            </IconButton>
            
            <Typography variant="h6">
              {title}
            </Typography>
            
            <Chip
              label={`${currentQuestionIndex + 1} / ${totalQuestions}`}
              size="small"
              color="primary"
            />
            
            <Chip
              label={`${answeredCount} answered`}
              size="small"
              color={answeredCount === totalQuestions ? 'success' : 'default'}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {timeLimit && (
              <QuizTimer
                timeRemaining={timeRemaining}
                totalTime={timeLimit}
                onTimeUp={handleAutoSubmit}
              />
            )}
            
            <IconButton onClick={handlePause}>
              {isPaused ? <StartIcon /> : <PauseIcon />}
            </IconButton>
          </Box>
        </Box>
        
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
            },
          }}
        />
      </Box>

      {/* Main Content */}
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <AnimatePresence mode="wait">
          {!isPaused && currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <QuestionComponent
                question={currentQuestion}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={totalQuestions}
                answer={answers.get(currentQuestion.id)}
                onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
                isFlagged={flaggedQuestions.has(currentQuestion.id)}
                onToggleFlag={handleToggleFlag}
                showExplanation={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isPaused && (
          <Card sx={{ p: 4, textAlign: 'center', maxWidth: 400, mx: 'auto' }}>
            <CardContent>
              <PauseIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Quiz Paused
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Take a break! Click resume when you're ready to continue.
              </Typography>
              <Button
                variant="contained"
                startIcon={<StartIcon />}
                onClick={handlePause}
                sx={{ mr: 2 }}
              >
                Resume
              </Button>
              <Button variant="outlined" onClick={handleExit}>
                Exit Quiz
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {!isPaused && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4 }}>
            <Button
              variant="outlined"
              startIcon={<PrevIcon />}
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FlagIcon />}
                onClick={handleToggleFlag}
                color={flaggedQuestions.has(currentQuestion.id) ? 'warning' : 'inherit'}
              >
                {flaggedQuestions.has(currentQuestion.id) ? 'Unflag' : 'Flag'}
              </Button>
              
              {currentQuestionIndex === totalQuestions - 1 ? (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<StopIcon />}
                  onClick={handleSubmit}
                >
                  Submit Quiz
                </Button>
              ) : (
                <Button
                  variant="contained"
                  endIcon={<NextIcon />}
                  onClick={handleNext}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Floating Action Buttons */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {flaggedQuestions.size > 0 && (
          <Tooltip title={`${flaggedQuestions.size} flagged questions`}>
            <Fab
              size="small"
              sx={{ bgcolor: alpha(theme.palette.warning.main, 0.9) }}
            >
              <FlagIcon />
            </Fab>
          </Tooltip>
        )}
        
        <Tooltip title="Quiz Help">
          <Fab
            size="small"
            sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9) }}
          >
            <HelpIcon />
          </Fab>
        </Tooltip>
      </Box>

      {/* Confirm Submit Dialog */}
      <Dialog
        open={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
      >
        <DialogTitle>Submit Quiz?</DialogTitle>
        <DialogContent>
          <Typography>
            You have answered {answeredCount} out of {totalQuestions} questions.
            {answeredCount < totalQuestions && ` ${totalQuestions - answeredCount} questions remain unanswered.`}
          </Typography>
          <Typography sx={{ mt: 2 }}>
            Are you sure you want to submit your quiz?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmSubmit(false)}>
            Continue Quiz
          </Button>
          <Button onClick={completeQuiz} color="primary">
            Submit Quiz
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Exit Dialog */}
      <Dialog
        open={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
      >
        <DialogTitle>Exit Quiz?</DialogTitle>
        <DialogContent>
          <Typography>
            Your progress will be lost if you exit now. Are you sure you want to leave?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmExit(false)}>
            Stay
          </Button>
          <Button onClick={onExit} color="error">
            Exit Quiz
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};