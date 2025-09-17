import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Flip as FlipIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Close as CloseIcon,
  Shuffle as ShuffleIcon,
  Settings as SettingsIcon,
  Keyboard as KeyboardIcon,
  Psychology as FlashcardIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { FlashcardComponent } from './FlashcardComponent';
import { StudySessionStats } from './StudySessionStats';
import { SpacedRepetitionScheduler } from '../../services/spaced-repetition/SpacedRepetitionScheduler';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  lastReviewed?: string;
  nextReview?: string;
  reviewCount: number;
  correctCount: number;
  interval: number;
  easeFactor: number;
}

interface StudySession {
  id: string;
  startTime: string;
  endTime?: string;
  cardsStudied: number;
  correctAnswers: number;
  totalTime: number;
  mode: 'new' | 'review' | 'all' | 'difficult';
}

interface FlashcardStudyProps {
  capsuleId: string;
  flashcards: Flashcard[];
  studyMode: 'new' | 'review' | 'all' | 'difficult';
  onSessionComplete?: (session: StudySession) => void;
  onExit?: () => void;
}

export const FlashcardStudy: React.FC<FlashcardStudyProps> = ({
  capsuleId,
  flashcards,
  studyMode,
  onSessionComplete,
  onExit,
}) => {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [sessionStartTime] = useState(new Date().toISOString());
  const [studiedCards, setStudiedCards] = useState<Set<string>>(new Set());
  const [cardResponses, setCardResponses] = useState<Map<string, 'correct' | 'incorrect' | 'hard'>>(new Map());
  const [sessionStats, setSessionStats] = useState({
    cardsStudied: 0,
    correctAnswers: 0,
    totalTime: 0,
  });

  const timerRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(Date.now());
  const scheduler = useRef(new SpacedRepetitionScheduler());

  // Filter flashcards based on study mode
  const filteredCards = flashcards.filter(card => {
    switch (studyMode) {
      case 'new':
        return card.reviewCount === 0;
      case 'review':
        return card.nextReview && new Date(card.nextReview) <= new Date();
      case 'difficult':
        return card.difficulty === 'hard' || (card.reviewCount > 0 && (card.correctCount / card.reviewCount) < 0.7);
      case 'all':
      default:
        return true;
    }
  });

  const currentCard = filteredCards[currentIndex];
  const progress = filteredCards.length > 0 ? ((currentIndex + 1) / filteredCards.length) * 100 : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isPaused) return;

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'enter':
          event.preventDefault();
          handleFlip();
          break;
        case 'arrowleft':
        case 'a':
          event.preventDefault();
          handlePrevious();
          break;
        case 'arrowright':
        case 'd':
          event.preventDefault();
          handleNext();
          break;
        case '1':
          event.preventDefault();
          if (isFlipped) handleResponse('hard');
          break;
        case '2':
          event.preventDefault();
          if (isFlipped) handleResponse('incorrect');
          break;
        case '3':
          event.preventDefault();
          if (isFlipped) handleResponse('correct');
          break;
        case 'escape':
          event.preventDefault();
          setIsPaused(true);
          break;
        case '?':
          event.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isPaused, currentIndex]);

  // Timer for session tracking
  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setSessionStats(prev => ({
          ...prev,
          totalTime: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
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
  }, [isPaused]);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      // Session complete
      handleSessionComplete();
    }
  }, [currentIndex, filteredCards.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleResponse = useCallback((response: 'correct' | 'incorrect' | 'hard') => {
    if (!currentCard) return;

    const newStudiedCards = new Set(studiedCards);
    newStudiedCards.add(currentCard.id);
    setStudiedCards(newStudiedCards);

    const newResponses = new Map(cardResponses);
    newResponses.set(currentCard.id, response);
    setCardResponses(newResponses);

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      cardsStudied: newStudiedCards.size,
      correctAnswers: prev.correctAnswers + (response === 'correct' ? 1 : 0),
    }));

    // Update card with spaced repetition algorithm
    const updatedCard = scheduler.current.updateCard(currentCard, response);
    
    // Save updated card (this would typically be an API call)
    console.log('Updated card:', updatedCard);

    // Move to next card
    setTimeout(() => {
      handleNext();
    }, 500);
  }, [currentCard, studiedCards, cardResponses, handleNext]);

  const handleSessionComplete = useCallback(() => {
    const session: StudySession = {
      id: `session-${Date.now()}`,
      startTime: sessionStartTime,
      endTime: new Date().toISOString(),
      cardsStudied: sessionStats.cardsStudied,
      correctAnswers: sessionStats.correctAnswers,
      totalTime: sessionStats.totalTime,
      mode: studyMode,
    };

    onSessionComplete?.(session);
  }, [sessionStartTime, sessionStats, studyMode, onSessionComplete]);

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleExit = () => {
    if (studiedCards.size > 0) {
      // Show confirmation dialog
      setShowStats(true);
    } else {
      onExit?.();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (filteredCards.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
        }}
      >
        <FlashcardIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          No cards to study
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          There are no flashcards available for the selected study mode.
        </Typography>
        <Button variant="contained" onClick={onExit}>
          Back to Capsule
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', position: 'relative' }}>
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
              Flashcard Study - {studyMode.charAt(0).toUpperCase() + studyMode.slice(1)} Mode
            </Typography>
            
            <Chip
              label={`${currentIndex + 1} / ${filteredCards.length}`}
              size="small"
              color="primary"
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {formatTime(sessionStats.totalTime)}
            </Typography>
            
            <IconButton onClick={handlePause}>
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>
            
            <IconButton onClick={() => setShowKeyboardHelp(true)}>
              <KeyboardIcon />
            </IconButton>
            
            <IconButton onClick={() => setShowStats(true)}>
              <SettingsIcon />
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 120px)',
          p: 3,
        }}
      >
        <AnimatePresence mode="wait">
          {!isPaused && currentCard && (
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <FlashcardComponent
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={handleFlip}
                onResponse={handleResponse}
                showResponse={isFlipped}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isPaused && (
          <Card sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
            <CardContent>
              <PauseIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Study Session Paused
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Take a break! Press the play button or spacebar to continue.
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayIcon />}
                onClick={handlePause}
                sx={{ mr: 2 }}
              >
                Resume
              </Button>
              <Button variant="outlined" onClick={handleExit}>
                Exit Session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation Controls */}
        {!isPaused && (
          <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
            <Button
              variant="outlined"
              startIcon={<PrevIcon />}
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>
            
            <Button
              variant="contained"
              startIcon={<FlipIcon />}
              onClick={handleFlip}
              sx={{ minWidth: 120 }}
            >
              {isFlipped ? 'Hide Answer' : 'Show Answer'}
            </Button>
            
            <Button
              variant="outlined"
              endIcon={<NextIcon />}
              onClick={handleNext}
              disabled={currentIndex === filteredCards.length - 1}
            >
              Next
            </Button>
          </Box>
        )}
      </Box>

      {/* Floating Action Buttons */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Tooltip title="Keyboard Shortcuts">
          <Fab
            size="small"
            onClick={() => setShowKeyboardHelp(true)}
            sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9) }}
          >
            <KeyboardIcon />
          </Fab>
        </Tooltip>
        
        <Tooltip title="Session Stats">
          <Fab
            size="small"
            onClick={() => setShowStats(true)}
            sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9) }}
          >
            <SettingsIcon />
          </Fab>
        </Tooltip>
      </Box>

      {/* Session Stats Dialog */}
      <Dialog
        open={showStats}
        onClose={() => setShowStats(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Session Statistics</DialogTitle>
        <DialogContent>
          <StudySessionStats
            cardsStudied={sessionStats.cardsStudied}
            correctAnswers={sessionStats.correctAnswers}
            totalTime={sessionStats.totalTime}
            totalCards={filteredCards.length}
            studyMode={studyMode}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStats(false)}>
            Continue
          </Button>
          <Button onClick={handleExit} color="error">
            End Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Keyboard Help Dialog */}
      <Dialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Flip card</Typography>
              <Chip label="Space / Enter" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Previous card</Typography>
              <Chip label="← / A" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Next card</Typography>
              <Chip label="→ / D" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Mark as Hard</Typography>
              <Chip label="1" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Mark as Incorrect</Typography>
              <Chip label="2" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Mark as Correct</Typography>
              <Chip label="3" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Pause session</Typography>
              <Chip label="Esc" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Show this help</Typography>
              <Chip label="?" size="small" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKeyboardHelp(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};