import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  TextField,
  Button,
  Chip,
  Alert,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Flag as FlagIcon,
  FlagOutlined as FlagOutlinedIcon,
  AccessTime as TimeIcon,
  Help as HelpIcon,
  CheckCircle as CorrectIcon,
  Cancel as IncorrectIcon,
} from '@mui/icons-material';

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

interface QuestionComponentProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  answer?: any;
  onAnswer: (answer: any) => void;
  isFlagged?: boolean;
  onToggleFlag?: () => void;
  showExplanation?: boolean;
  showCorrectAnswer?: boolean;
  isReviewMode?: boolean;
}

export const QuestionComponent: React.FC<QuestionComponentProps> = ({
  question,
  questionNumber,
  totalQuestions,
  answer,
  onAnswer,
  isFlagged = false,
  onToggleFlag,
  showExplanation = false,
  showCorrectAnswer = false,
  isReviewMode = false,
}) => {
  const theme = useTheme();
  const [showHint, setShowHint] = useState(false);

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

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isAnswerCorrect = () => {
    if (!showCorrectAnswer || answer === undefined) return null;
    
    if (question.type === 'multiple-choice' || question.type === 'true-false') {
      return answer === question.correctAnswer;
    } else if (question.type === 'short-answer') {
      const correct = String(question.correctAnswer).toLowerCase().trim();
      const user = String(answer).toLowerCase().trim();
      return correct === user;
    }
    
    return null;
  };

  const renderMultipleChoice = () => (
    <FormControl component="fieldset" fullWidth>
      <RadioGroup
        value={answer || ''}
        onChange={(e) => onAnswer(parseInt(e.target.value))}
      >
        {question.options?.map((option, index) => {
          const isSelected = answer === index;
          const isCorrect = showCorrectAnswer && index === question.correctAnswer;
          const isIncorrect = showCorrectAnswer && isSelected && index !== question.correctAnswer;
          
          return (
            <FormControlLabel
              key={index}
              value={index}
              control={<Radio disabled={isReviewMode} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body1" sx={{ flex: 1 }}>
                    {String.fromCharCode(65 + index)}. {option}
                  </Typography>
                  
                  {isCorrect && (
                    <CorrectIcon sx={{ color: 'success.main', fontSize: 20 }} />
                  )}
                  
                  {isIncorrect && (
                    <IncorrectIcon sx={{ color: 'error.main', fontSize: 20 }} />
                  )}
                </Box>
              }
              sx={{
                m: 0,
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                mb: 1,
                backgroundColor: isCorrect 
                  ? alpha(theme.palette.success.main, 0.1)
                  : isIncorrect 
                  ? alpha(theme.palette.error.main, 0.1)
                  : isSelected 
                  ? alpha(theme.palette.primary.main, 0.05)
                  : 'transparent',
                '&:hover': !isReviewMode ? {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                } : {},
              }}
            />
          );
        })}
      </RadioGroup>
    </FormControl>
  );

  const renderTrueFalse = () => (
    <FormControl component="fieldset" fullWidth>
      <RadioGroup
        value={answer !== undefined ? String(answer) : ''}
        onChange={(e) => onAnswer(e.target.value === 'true')}
        row
        sx={{ justifyContent: 'center', gap: 4 }}
      >
        {[
          { value: 'true', label: 'True' },
          { value: 'false', label: 'False' },
        ].map((option) => {
          const boolValue = option.value === 'true';
          const isSelected = answer === boolValue;
          const isCorrect = showCorrectAnswer && boolValue === question.correctAnswer;
          const isIncorrect = showCorrectAnswer && isSelected && boolValue !== question.correctAnswer;
          
          return (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio disabled={isReviewMode} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {option.label}
                  </Typography>
                  
                  {isCorrect && (
                    <CorrectIcon sx={{ color: 'success.main', fontSize: 24 }} />
                  )}
                  
                  {isIncorrect && (
                    <IncorrectIcon sx={{ color: 'error.main', fontSize: 24 }} />
                  )}
                </Box>
              }
              sx={{
                m: 0,
                p: 2,
                borderRadius: 2,
                border: `2px solid ${theme.palette.divider}`,
                backgroundColor: isCorrect 
                  ? alpha(theme.palette.success.main, 0.1)
                  : isIncorrect 
                  ? alpha(theme.palette.error.main, 0.1)
                  : isSelected 
                  ? alpha(theme.palette.primary.main, 0.1)
                  : 'transparent',
                '&:hover': !isReviewMode ? {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  borderColor: theme.palette.primary.main,
                } : {},
              }}
            />
          );
        })}
      </RadioGroup>
    </FormControl>
  );

  const renderShortAnswer = () => (
    <TextField
      fullWidth
      multiline
      rows={3}
      placeholder="Type your answer here..."
      value={answer || ''}
      onChange={(e) => onAnswer(e.target.value)}
      disabled={isReviewMode}
      sx={{
        '& .MuiOutlinedInput-root': {
          backgroundColor: showCorrectAnswer 
            ? isAnswerCorrect() 
              ? alpha(theme.palette.success.main, 0.1)
              : alpha(theme.palette.error.main, 0.1)
            : 'background.paper',
        },
      }}
    />
  );

  const renderQuestionContent = () => {
    switch (question.type) {
      case 'multiple-choice':
        return renderMultipleChoice();
      case 'true-false':
        return renderTrueFalse();
      case 'short-answer':
        return renderShortAnswer();
      default:
        return null;
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        {/* Question Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ flex: 1, mr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Question {questionNumber} of {totalQuestions}
              </Typography>
              
              <Chip
                label={question.difficulty}
                size="small"
                sx={{
                  backgroundColor: alpha(getDifficultyColor(question.difficulty), 0.1),
                  color: getDifficultyColor(question.difficulty),
                  textTransform: 'capitalize',
                }}
              />
              
              <Chip
                label={`${question.points} ${question.points === 1 ? 'point' : 'points'}`}
                size="small"
                variant="outlined"
              />
              
              {question.timestamp && (
                <Chip
                  icon={<TimeIcon />}
                  label={formatTimestamp(question.timestamp)}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
            
            <Typography variant="h5" component="h2" sx={{ lineHeight: 1.4, mb: 2 }}>
              {question.question}
            </Typography>
          </Box>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {onToggleFlag && (
              <Button
                size="small"
                startIcon={isFlagged ? <FlagIcon /> : <FlagOutlinedIcon />}
                onClick={onToggleFlag}
                color={isFlagged ? 'warning' : 'inherit'}
                sx={{ minWidth: 'auto' }}
              >
                {isFlagged ? 'Flagged' : 'Flag'}
              </Button>
            )}
            
            <Button
              size="small"
              startIcon={<HelpIcon />}
              onClick={() => setShowHint(!showHint)}
              sx={{ minWidth: 'auto' }}
            >
              Hint
            </Button>
          </Box>
        </Box>

        {/* Question Content */}
        <Box sx={{ mb: 3 }}>
          {renderQuestionContent()}
        </Box>

        {/* Answer Status */}
        {showCorrectAnswer && answer !== undefined && (
          <Alert
            severity={isAnswerCorrect() ? 'success' : 'error'}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2">
              {isAnswerCorrect() ? 'Correct!' : 'Incorrect'}
            </Typography>
            {question.type === 'short-answer' && !isAnswerCorrect() && (
              <Typography variant="body2">
                Correct answer: {question.correctAnswer}
              </Typography>
            )}
          </Alert>
        )}

        {/* Hint */}
        <Collapse in={showHint}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Hint:
            </Typography>
            <Typography variant="body2">
              {question.type === 'multiple-choice' && 'Consider each option carefully and eliminate obviously wrong answers.'}
              {question.type === 'true-false' && 'Look for absolute words like "always" or "never" which often indicate false statements.'}
              {question.type === 'short-answer' && 'Be specific and concise in your answer. Key terms are important.'}
            </Typography>
          </Alert>
        </Collapse>

        {/* Explanation */}
        <Collapse in={showExplanation}>
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              Explanation:
            </Typography>
            <Typography variant="body2">
              {question.explanation}
            </Typography>
            
            {question.timestamp && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  startIcon={<TimeIcon />}
                  onClick={() => {
                    // Navigate to video timestamp
                    window.open(`#t=${question.timestamp}`, '_blank');
                  }}
                >
                  Watch this section
                </Button>
              </Box>
            )}
          </Alert>
        </Collapse>

        {/* Answer Progress */}
        {!isReviewMode && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {answer !== undefined ? (
                <Chip
                  label="Answered"
                  size="small"
                  color="success"
                  icon={<CorrectIcon />}
                />
              ) : (
                <Chip
                  label="Not answered"
                  size="small"
                  variant="outlined"
                />
              )}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};