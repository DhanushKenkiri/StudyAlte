import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Alert,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Quiz as QuizIcon,
} from '@mui/icons-material';
import { QuizInterface } from '../components/study/QuizInterface';

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

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimit?: number;
  passingScore: number;
  allowReview: boolean;
  shuffleQuestions: boolean;
  maxAttempts?: number;
  attempts: Array<{
    id: string;
    score: number;
    completedAt: string;
    timeSpent: number;
  }>;
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

export const QuizPage: React.FC = () => {
  const { capsuleId, quizId } = useParams<{ capsuleId: string; quizId?: string }>();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [capsuleId, quizId]);

  const loadQuiz = async () => {
    if (!capsuleId) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = quizId 
        ? `/api/quizzes/${quizId}`
        : `/api/capsules/${capsuleId}/quiz`;
        
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load quiz: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Mock data if API doesn't exist yet
      const mockQuiz: Quiz = {
        id: quizId || `${capsuleId}-quiz`,
        title: data.title || 'Knowledge Check Quiz',
        description: data.description || 'Test your understanding of the material',
        questions: data.questions || [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is the main topic of this video?',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 0,
            explanation: 'This is the correct answer because...',
            difficulty: 'medium',
            points: 10,
            timestamp: 120,
          },
          {
            id: 'q2',
            type: 'true-false',
            question: 'The concept explained in the video is fundamental to understanding the subject.',
            correctAnswer: true,
            explanation: 'This statement is true because...',
            difficulty: 'easy',
            points: 5,
            timestamp: 300,
          },
          {
            id: 'q3',
            type: 'short-answer',
            question: 'Explain the key concept discussed in your own words.',
            correctAnswer: 'sample answer',
            explanation: 'A good answer should include...',
            difficulty: 'hard',
            points: 15,
            timestamp: 450,
          },
        ],
        timeLimit: data.timeLimit || 1800, // 30 minutes
        passingScore: data.passingScore || 70,
        allowReview: data.allowReview !== false,
        shuffleQuestions: data.shuffleQuestions || false,
        maxAttempts: data.maxAttempts,
        attempts: data.attempts || [],
      };
      
      setQuiz(mockQuiz);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load quiz';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = async (attempt: QuizAttempt) => {
    try {
      // Save quiz attempt to backend
      await fetch('/api/quiz-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          ...attempt,
          quizId: quiz?.id,
          capsuleId,
          answers: Array.from(attempt.answers.entries()),
        }),
      });

      console.log('Quiz attempt saved:', attempt);
    } catch (error) {
      console.error('Failed to save quiz attempt:', error);
      // Continue anyway - the quiz completion is still valid
    }
  };

  const handleExit = () => {
    navigate(`/capsules/${capsuleId}`);
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
          <CircularProgress size={64} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Loading quiz...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Preparing your knowledge assessment
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
              Failed to load quiz
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
            <Button onClick={loadQuiz} sx={{ mt: 2 }}>
              Try Again
            </Button>
          </Alert>
        </Box>
      </Container>
    );
  }

  if (!quiz) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <QuizIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Quiz not found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The requested quiz could not be found.
          </Typography>
          <Button onClick={handleExit} sx={{ mt: 2 }}>
            Back to Capsule
          </Button>
        </Box>
      </Container>
    );
  }

  // Check if user has exceeded max attempts
  if (quiz.maxAttempts && quiz.attempts.length >= quiz.maxAttempts) {
    const bestScore = Math.max(...quiz.attempts.map(a => a.score));
    const passed = bestScore >= quiz.passingScore;
    
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Alert severity={passed ? 'success' : 'warning'} sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Maximum Attempts Reached
            </Typography>
            <Typography variant="body2">
              You have completed the maximum number of attempts ({quiz.maxAttempts}) for this quiz.
              Your best score is {bestScore}%.
            </Typography>
          </Alert>
          
          <Button variant="contained" onClick={handleExit}>
            Back to Capsule
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <QuizInterface
      quizId={quiz.id}
      title={quiz.title}
      questions={quiz.questions}
      timeLimit={quiz.timeLimit}
      passingScore={quiz.passingScore}
      allowReview={quiz.allowReview}
      shuffleQuestions={quiz.shuffleQuestions}
      onComplete={handleQuizComplete}
      onExit={handleExit}
    />
  );
};