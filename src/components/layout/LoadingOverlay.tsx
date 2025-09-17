import React from 'react';
import {
  Backdrop,
  CircularProgress,
  Box,
  Typography,
  Fade,
  LinearProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  progress?: number; // 0-100 for progress bar
  variant?: 'circular' | 'linear' | 'dots';
  backdrop?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message,
  progress,
  variant = 'circular',
  backdrop = true,
  size = 'medium',
}) => {
  const theme = useTheme();

  const getSizeValue = () => {
    switch (size) {
      case 'small':
        return 32;
      case 'large':
        return 64;
      default:
        return 48;
    }
  };

  const renderLoadingIndicator = () => {
    switch (variant) {
      case 'linear':
        return (
          <Box sx={{ width: '100%', maxWidth: 300 }}>
            <LinearProgress
              variant={progress !== undefined ? 'determinate' : 'indeterminate'}
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.palette.action.hover,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                },
              }}
            />
            {progress !== undefined && (
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ mt: 1 }}
              >
                {Math.round(progress)}%
              </Typography>
            )}
          </Box>
        );

      case 'dots':
        return (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            {[0, 1, 2].map((index) => (
              <Box
                key={index}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.primary.main,
                  animation: 'pulse 1.4s ease-in-out infinite both',
                  animationDelay: `${index * 0.16}s`,
                  '@keyframes pulse': {
                    '0%, 80%, 100%': {
                      transform: 'scale(0)',
                      opacity: 0.5,
                    },
                    '40%': {
                      transform: 'scale(1)',
                      opacity: 1,
                    },
                  },
                }}
              />
            ))}
          </Box>
        );

      default:
        return (
          <CircularProgress
            size={getSizeValue()}
            thickness={4}
            variant={progress !== undefined ? 'determinate' : 'indeterminate'}
            value={progress}
            sx={{
              color: theme.palette.primary.main,
            }}
          />
        );
    }
  };

  const content = (
    <Fade in={open} timeout={300}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 3,
          borderRadius: 2,
          backgroundColor: backdrop ? 'transparent' : theme.palette.background.paper,
          boxShadow: backdrop ? 'none' : theme.shadows[4],
        }}
      >
        {renderLoadingIndicator()}
        
        {message && (
          <Typography
            variant="body2"
            color={backdrop ? 'common.white' : 'text.secondary'}
            align="center"
            sx={{
              maxWidth: 300,
              fontWeight: 500,
            }}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Fade>
  );

  if (backdrop) {
    return (
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
        open={open}
      >
        {content}
      </Backdrop>
    );
  }

  return open ? content : null;
};

// Inline loading component for smaller areas
interface InlineLoadingProps {
  loading: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'circular' | 'linear' | 'dots';
  minHeight?: number;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  loading,
  message,
  size = 'medium',
  variant = 'circular',
  minHeight = 100,
}) => {
  if (!loading) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        gap: 2,
        p: 2,
      }}
    >
      <LoadingOverlay
        open={true}
        message={message}
        variant={variant}
        backdrop={false}
        size={size}
      />
    </Box>
  );
};

// Loading skeleton component
interface LoadingSkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  animation?: 'pulse' | 'wave' | false;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  width = '100%',
  height = variant === 'text' ? 20 : 40,
  animation = 'pulse',
  count = 1,
}) => {
  const theme = useTheme();

  const skeletonStyle = {
    backgroundColor: theme.palette.action.hover,
    borderRadius: variant === 'circular' ? '50%' : 1,
    width,
    height,
    animation: animation ? `${animation} 2s ease-in-out infinite` : 'none',
    '@keyframes pulse': {
      '0%': {
        opacity: 1,
      },
      '50%': {
        opacity: 0.4,
      },
      '100%': {
        opacity: 1,
      },
    },
    '@keyframes wave': {
      '0%': {
        transform: 'translateX(-100%)',
      },
      '50%': {
        transform: 'translateX(100%)',
      },
      '100%': {
        transform: 'translateX(100%)',
      },
    },
  };

  if (count === 1) {
    return <Box sx={skeletonStyle} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            ...skeletonStyle,
            animationDelay: `${index * 0.1}s`,
          }}
        />
      ))}
    </Box>
  );
};