import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Alert,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Psychology as FlashcardIcon,
} from '@mui/icons-material';
import { FlashcardStudy } from '../components/study/FlashcardStudy';

interface StudySession {
  id: string;
  startTime: string;
  endTime?: string;
  cardsStudied: number;
  correctAnswers: number;
  totalTime: number;
  mode: 'new' | 'review' | 'all' | 'difficult';
}

export const FlashcardStudyPage: React.FC = () => {
  const { capsuleId } = useParams<{ capsuleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [completedSession, setCompletedSession] = useState<StudySession | null>(null);

  const studyMode = (searchParams.get('mode') as 'new' | 'review' | 'all' | 'difficult') || 'all';

  useEffect(() => {
    loadFlashcards();
  }, [capsuleId]);

  const loadFlashcards = async () => {
    if (!capsuleId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/capsules/${capsuleId}/flashcards`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load flashcards: ${response.statusText}`);
      }

      const data = await response.json();
      setFlashcards(data.flashcards || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load flashcards';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionComplete = async (session: StudySession) => {
    try {
      // Save session to backend
      await fetch(`/api/study-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          ...session,
          capsuleId,
          type: 'flashcards',
        }),
      });

      setCompletedSession(session);
      setSessionComplete(true);
    } catch (error) {
      console.error('Failed to save study session:', error);
      // Still show completion dialog even if save fails
      setCompletedSession(session);
      setSessionComplete(true);
    }
  };

  const handleExit = () => {
    navigate(`/capsules/${capsuleId}`);
  };

  const handleContinueStudying = () => {
    setSessionComplete(false);
    setCompletedSession(null);
    // Reload flashcards to get updated data
    loadFlashcards();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  if (!capsuleId) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            <Typography variant="h6">
              Invalid capsule ID
            </Typography>
            <Typography variant="body2">
              The capsule ID is missing or invalid.
            </Typography>
          </Alert>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <FlashcardIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Loading flashcards...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Preparing your study session
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            <Typography variant="h6" gutterBottom>
              Failed to load flashcards
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
            <Button onClick={loadFlashcards} sx={{ mt: 2 }}>
              Try Again
            </Button>
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Box>
      <FlashcardStudy
        capsuleId={capsuleId}
        flashcards={flashcards}
        studyMode={studyMode}
        onSessionComplete={handleSessionComplete}
        onExit={handleExit}
      />

      {/* Session Complete Dialog */}
      <Dialog
        open={sessionComplete}
        onClose={() => setSessionComplete(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <SuccessIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <Typography variant="h5" component="div">
            Study Session Complete!
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {completedSession && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body1" paragraph>
                Great job studying {getStudyModeLabel(completedSession.mode).toLowerCase()}!
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                <Card sx={{ minWidth: 120 }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {completedSession.cardsStudied}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cards Studied
                    </Typography>
                  </CardContent>
                </Card>
                
                <Card sx={{ minWidth: 120 }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {Math.round((completedSession.correctAnswers / completedSession.cardsStudied) * 100)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Accuracy
                    </Typography>
                  </CardContent>
                </Card>
                
                <Card sx={{ minWidth: 120 }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {formatTime(completedSession.totalTime)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Study Time
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
                <Chip
                  label={getStudyModeLabel(completedSession.mode)}
                  color="primary"
                />
                <Chip
                  label={`${completedSession.correctAnswers}/${completedSession.cardsStudied} correct`}
                  color="success"
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Your progress has been saved and spaced repetition schedules have been updated.
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="outlined"
            onClick={handleContinueStudying}
            sx={{ mr: 1 }}
          >
            Study More Cards
          </Button>
          <Button
            variant="contained"
            onClick={handleExit}
          >
            Back to Capsule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};