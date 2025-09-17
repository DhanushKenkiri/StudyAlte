import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ThumbUp as CorrectIcon,
  ThumbDown as IncorrectIcon,
  Warning as HardIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

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

interface FlashcardComponentProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  onResponse?: (response: 'correct' | 'incorrect' | 'hard') => void;
  showResponse?: boolean;
  size?: 'small' | 'medium' | 'large';
  interactive?: boolean;
}

export const FlashcardComponent: React.FC<FlashcardComponentProps> = ({
  card,
  isFlipped,
  onFlip,
  onResponse,
  showResponse = false,
  size = 'large',
  interactive = true,
}) => {
  const theme = useTheme();

  const getDifficultyColor = (difficulty: string) => {
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

  const getCardSize = () => {
    switch (size) {
      case 'small':
        return { width: 300, height: 200 };
      case 'medium':
        return { width: 400, height: 250 };
      case 'large':
      default:
        return { width: 500, height: 300 };
    }
  };

  const cardSize = getCardSize();

  const flipVariants = {
    front: {
      rotateY: 0,
      transition: { duration: 0.6, ease: 'easeInOut' }
    },
    back: {
      rotateY: 180,
      transition: { duration: 0.6, ease: 'easeInOut' }
    }
  };

  const contentVariants = {
    front: {
      rotateY: 0,
      opacity: 1,
      transition: { duration: 0.3, delay: 0.3 }
    },
    back: {
      rotateY: 180,
      opacity: 1,
      transition: { duration: 0.3, delay: 0.3 }
    }
  };

  return (
    <Box
      sx={{
        perspective: '1000px',
        width: cardSize.width,
        height: cardSize.height,
        mx: 'auto',
      }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          cursor: interactive ? 'pointer' : 'default',
        }}
        variants={flipVariants}
        animate={isFlipped ? 'back' : 'front'}
        onClick={interactive ? onFlip : undefined}
      >
        {/* Front of card */}
        <Card
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            boxShadow: theme.shadows[4],
            '&:hover': interactive ? {
              boxShadow: theme.shadows[8],
              transform: 'translateY(-2px)',
            } : {},
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
            {/* Card Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Chip
                label={card.difficulty}
                size="small"
                sx={{
                  backgroundColor: alpha(getDifficultyColor(card.difficulty), 0.1),
                  color: getDifficultyColor(card.difficulty),
                  textTransform: 'capitalize',
                }}
              />
              
              {card.reviewCount > 0 && (
                <Chip
                  label={`${Math.round((card.correctCount / card.reviewCount) * 100)}%`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            {/* Question */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography
                variant={size === 'small' ? 'h6' : size === 'medium' ? 'h5' : 'h4'}
                component="div"
                sx={{
                  textAlign: 'center',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: 'text.primary',
                }}
              >
                {card.front}
              </Typography>
            </Box>

            {/* Tags */}
            {card.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 2 }}>
                {card.tags.slice(0, 3).map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                ))}
                {card.tags.length > 3 && (
                  <Chip
                    label={`+${card.tags.length - 3}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
              </Box>
            )}

            {/* Flip Hint */}
            {interactive && !isFlipped && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Click or press Space to reveal answer
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Back of card */}
        <Card
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            display: 'flex',
            flexDirection: 'column',
            border: `2px solid ${alpha(theme.palette.success.main, 0.2)}`,
            boxShadow: theme.shadows[4],
            bgcolor: alpha(theme.palette.success.main, 0.02),
          }}
        >
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
            {/* Card Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Chip
                label="Answer"
                size="small"
                color="success"
              />
              
              <Chip
                label={`Review #${card.reviewCount + 1}`}
                size="small"
                variant="outlined"
              />
            </Box>

            {/* Answer */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography
                variant={size === 'small' ? 'body1' : size === 'medium' ? 'h6' : 'h5'}
                component="div"
                sx={{
                  textAlign: 'center',
                  fontWeight: 400,
                  lineHeight: 1.5,
                  color: 'text.primary',
                }}
              >
                {card.back}
              </Typography>
            </Box>

            {/* Response Buttons */}
            {showResponse && onResponse && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<HardIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResponse('hard');
                  }}
                  sx={{ flex: 1, fontSize: '0.8rem' }}
                >
                  Hard (1)
                </Button>
                
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<IncorrectIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResponse('incorrect');
                  }}
                  sx={{ flex: 1, fontSize: '0.8rem' }}
                >
                  Wrong (2)
                </Button>
                
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CorrectIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResponse('correct');
                  }}
                  sx={{ flex: 1, fontSize: '0.8rem' }}
                >
                  Correct (3)
                </Button>
              </Box>
            )}

            {/* Flip Hint */}
            {interactive && isFlipped && !showResponse && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Click or press Space to flip back
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
};