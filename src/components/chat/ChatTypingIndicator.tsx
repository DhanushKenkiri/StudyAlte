import React from 'react';
import {
  Box,
  Avatar,
  Paper,
  useTheme,
  keyframes,
} from '@mui/material';
import { SmartToy as BotIcon } from '@mui/icons-material';

const bounce = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
`;

const pulse = keyframes`
  0% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.4;
  }
`;

export const ChatTypingIndicator: React.FC = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        mb: 2,
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: theme.palette.secondary.main,
          animation: `${pulse} 2s infinite`,
        }}
      >
        <BotIcon fontSize="small" />
      </Avatar>

      {/* Typing Bubble */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
          borderTopLeftRadius: 0.5,
          minWidth: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}
      >
        {/* Animated Dots */}
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: theme.palette.text.secondary,
              animation: `${bounce} 1.4s infinite`,
              animationDelay: `${index * 0.2}s`,
            }}
          />
        ))}
      </Paper>
    </Box>
  );
};