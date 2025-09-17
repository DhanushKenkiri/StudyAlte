import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Timer as TimerIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface QuizTimerProps {
  timeRemaining: number; // in seconds
  totalTime: number; // in seconds
  onTimeUp?: () => void;
  showProgress?: boolean;
  compact?: boolean;
}

export const QuizTimer: React.FC<QuizTimerProps> = ({
  timeRemaining,
  totalTime,
  onTimeUp,
  showProgress = true,
  compact = false,
}) => {
  const theme = useTheme();
  const [isBlinking, setIsBlinking] = useState(false);

  const percentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Determine timer state and colors
  const getTimerState = () => {
    if (percentage <= 5) return 'critical';
    if (percentage <= 15) return 'warning';
    if (percentage <= 30) return 'caution';
    return 'normal';
  };

  const getTimerColor = () => {
    const state = getTimerState();
    switch (state) {
      case 'critical':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'caution':
        return theme.palette.info.main;
      default:
        return theme.palette.text.primary;
    }
  };

  const getProgressColor = () => {
    const state = getTimerState();
    switch (state) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'caution':
        return 'info';
      default:
        return 'primary';
    }
  };

  const getTimerIcon = () => {
    const state = getTimerState();
    switch (state) {
      case 'critical':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      default:
        return <TimerIcon />;
    }
  };

  // Handle blinking animation for critical time
  useEffect(() => {
    if (getTimerState() === 'critical') {
      const interval = setInterval(() => {
        setIsBlinking(prev => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setIsBlinking(false);
    }
  }, [percentage]);

  // Handle time up
  useEffect(() => {
    if (timeRemaining <= 0 && onTimeUp) {
      onTimeUp();
    }
  }, [timeRemaining, onTimeUp]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <Chip
        icon={getTimerIcon()}
        label={formatTime(timeRemaining)}
        color={getProgressColor() as any}
        variant={getTimerState() === 'critical' ? 'filled' : 'outlined'}
        sx={{
          fontFamily: 'monospace',
          fontWeight: 600,
          animation: isBlinking ? 'blink 1s infinite' : 'none',
          '@keyframes blink': {
            '0%, 50%': { opacity: 1 },
            '51%, 100%': { opacity: 0.3 },
          },
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1,
        borderRadius: 2,
        backgroundColor: alpha(getTimerColor(), 0.1),
        border: `1px solid ${alpha(getTimerColor(), 0.3)}`,
        animation: isBlinking ? 'blink 1s infinite' : 'none',
        '@keyframes blink': {
          '0%, 50%': { opacity: 1 },
          '51%, 100%': { opacity: 0.3 },
        },
      }}
    >
      {getTimerIcon()}
      
      <Box sx={{ minWidth: 80 }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: getTimerColor(),
            lineHeight: 1,
          }}
        >
          {formatTime(timeRemaining)}
        </Typography>
        
        {showProgress && (
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={getProgressColor() as any}
            sx={{
              height: 4,
              borderRadius: 2,
              mt: 0.5,
              backgroundColor: alpha(getTimerColor(), 0.2),
            }}
          />
        )}
      </Box>

      {/* Time warnings */}
      {getTimerState() === 'critical' && (
        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
          TIME RUNNING OUT!
        </Typography>
      )}
      
      {getTimerState() === 'warning' && (
        <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
          {Math.ceil(percentage)}% remaining
        </Typography>
      )}
    </Box>
  );
};