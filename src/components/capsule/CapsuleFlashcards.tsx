import React, { useState } from 'react';
import {
  Box,
  CardContent,
  Typography,
  Card,
  Button,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Shuffle as ShuffleIcon,
  FilterList as FilterIcon,
  Psychology as FlashcardIcon,
  Schedule as ScheduleIcon,
  TrendingUp as ProgressIcon,
  Star as DifficultyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface CapsuleFlashcardsProps {
  capsuleData: any;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const CapsuleFlashcards: React.FC<CapsuleFlashcardsProps> = ({
  capsuleData,
  onStartStudy,
}) => {
  const theme = useTheme();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showDueOnly, setShowDueOnly] = useState(false);

  const flashcards = capsuleData.flashcards || [];
  
  // Get unique tags from all flashcards
  const allTags = Array.from(new Set(flashcards.flatMap((card: any) => card.tags)));
  
  // Filter flashcards based on current filters
  const filteredFlashcards = flashcards.filter((card: any) => {
    if (selectedDifficulty !== 'all' && card.difficulty !== selectedDifficulty) {
      return false;
    }
    
    if (selectedTags.length > 0 && !selectedTags.some(tag => card.tags.includes(tag))) {
      return false;
    }
    
    if (showDueOnly && card.nextReview && new Date(card.nextReview) > new Date()) {
      return false;
    }
    
    return true;
  });

  // Calculate statistics
  const getFlashcardStats = () => {
    const total = flashcards.length;
    const reviewed = flashcards.filter((card: any) => card.reviewCount > 0).length;
    const due = flashcards.filter((card: any) => 
      !card.nextReview || new Date(card.nextReview) <= new Date()
    ).length;
    
    const difficultyBreakdown = {
      easy: flashcards.filter((card: any) => card.difficulty === 'easy').length,
      medium: flashcards.filter((card: any) => card.difficulty === 'medium').length,
      hard: flashcards.filter((card: any) => card.difficulty === 'hard').length,
    };
    
    const averageAccuracy = flashcards.length > 0 
      ? flashcards.reduce((sum: number, card: any) => 
          sum + (card.reviewCount > 0 ? (card.correctCount / card.reviewCount) * 100 : 0), 0
        ) / flashcards.length
      : 0;
    
    return {
      total,
      reviewed,
      due,
      difficultyBreakdown,
      averageAccuracy,
    };
  };

  const stats = getFlashcardStats();

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

  const handleStartStudySession = (mode: 'all' | 'due' | 'new' | 'difficult') => {
    // This would typically navigate to a study session with the specified mode
    onStartStudy?.(capsuleData.id, `flashcards-${mode}`);
  };

  return (
    <CardContent>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Flashcards ({filteredFlashcards.length} of {flashcards.length})
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => setFilterDialogOpen(true)}>
              <FilterIcon />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<ShuffleIcon />}
              onClick={() => handleStartStudySession('all')}
            >
              Shuffle Study
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={() => handleStartStudySession('due')}
            >
              Study Due Cards
            </Button>
          </Box>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <FlashcardIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Cards
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
              <ScheduleIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.due}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Due for Review
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.05) }}>
              <ProgressIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {Math.round(stats.averageAccuracy)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Accuracy
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.info.main, 0.05) }}>
              <DifficultyIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.reviewed}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cards Reviewed
              </Typography>
            </Card>
          </Grid>
        </Grid>

        {/* Study Options */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                p: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                },
              }}
              onClick={() => handleStartStudySession('due')}
            >
              <Box sx={{ textAlign: 'center' }}>
                <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Review Due Cards
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Study cards that are due for review
                </Typography>
                <Chip
                  label={`${stats.due} cards`}
                  color="warning"
                  size="small"
                />
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                p: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                },
              }}
              onClick={() => handleStartStudySession('new')}
            >
              <Box sx={{ textAlign: 'center' }}>
                <PlayIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Learn New Cards
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Study cards you haven't seen yet
                </Typography>
                <Chip
                  label={`${stats.total - stats.reviewed} cards`}
                  color="primary"
                  size="small"
                />
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                p: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                },
              }}
              onClick={() => handleStartStudySession('difficult')}
            >
              <Box sx={{ textAlign: 'center' }}>
                <DifficultyIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Difficult Cards
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Focus on challenging cards
                </Typography>
                <Chip
                  label={`${stats.difficultyBreakdown.hard} cards`}
                  color="error"
                  size="small"
                />
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                p: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                },
              }}
              onClick={() => handleStartStudySession('all')}
            >
              <Box sx={{ textAlign: 'center' }}>
                <ShuffleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Random Review
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Study all cards in random order
                </Typography>
                <Chip
                  label={`${stats.total} cards`}
                  color="success"
                  size="small"
                />
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Flashcard Preview */}
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Card Preview
        </Typography>
        
        <Grid container spacing={2}>
          {filteredFlashcards.slice(0, 6).map((card: any, index: number) => (
            <Grid item xs={12} sm={6} md={4} key={card.id}>
              <Card
                sx={{
                  p: 2,
                  height: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4],
                  },
                }}
                onClick={() => handleStartStudySession('all')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Chip
                    label={card.difficulty}
                    size="small"
                    sx={{
                      backgroundColor: alpha(getDifficultyColor(card.difficulty), 0.1),
                      color: getDifficultyColor(card.difficulty),
                    }}
                  />
                  
                  {card.nextReview && new Date(card.nextReview) <= new Date() && (
                    <Chip
                      label="Due"
                      size="small"
                      color="warning"
                    />
                  )}
                </Box>
                
                <Typography
                  variant="body1"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    fontWeight: 500,
                    mb: 2,
                  }}
                >
                  {card.front}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    {card.reviewCount > 0 
                      ? `${Math.round((card.correctCount / card.reviewCount) * 100)}% accuracy`
                      : 'Not reviewed'
                    }
                  </Typography>
                  
                  {card.lastReviewed && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(card.lastReviewed), { addSuffix: true })}
                    </Typography>
                  )}
                </Box>
                
                {card.tags.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                    {card.tags.slice(0, 2).map((tag: string, tagIndex: number) => (
                      <Chip
                        key={tagIndex}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    ))}
                    {card.tags.length > 2 && (
                      <Chip
                        label={`+${card.tags.length - 2}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    )}
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>

        {filteredFlashcards.length > 6 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => handleStartStudySession('all')}
            >
              View All {filteredFlashcards.length} Cards
            </Button>
          </Box>
        )}
      </Box>

      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Filter Flashcards
            <IconButton onClick={() => setFilterDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={selectedDifficulty}
                label="Difficulty"
                onChange={(e) => setSelectedDifficulty(e.target.value)}
              >
                <MenuItem value="all">All Difficulties</MenuItem>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </Select>
            </FormControl>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {allTags.map((tag: string) => (
                  <Chip
                    key={tag}
                    label={tag}
                    clickable
                    color={selectedTags.includes(tag) ? 'primary' : 'default'}
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes(tag)
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button
            onClick={() => {
              setSelectedDifficulty('all');
              setSelectedTags([]);
              setShowDueOnly(false);
            }}
          >
            Clear Filters
          </Button>
          <Button
            variant="contained"
            onClick={() => setFilterDialogOpen(false)}
          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
    </CardContent>
  );
};