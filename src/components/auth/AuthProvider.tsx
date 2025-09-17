import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { configureAmplify } from '../../services/auth/config';
import { getCurrentSession } from '../../store/slices/authSlice';
import { type AppDispatch } from '../../store';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component that initializes AWS Amplify and checks for existing sessions
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Configure AWS Amplify
        configureAmplify();

        // Check for existing session
        try {
          await dispatch(getCurrentSession()).unwrap();
        } catch (sessionError) {
          // It's okay if there's no existing session
          console.debug('No existing session found');
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
        setInitError(
          error instanceof Error 
            ? error.message 
            : 'Failed to initialize authentication system'
        );
        setIsInitialized(true); // Still allow the app to load
      }
    };

    initializeAuth();
  }, [dispatch]);

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="h6" color="text.secondary">
          Initializing YouTube Learning Platform
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Setting up authentication...
        </Typography>
      </Box>
    );
  }

  // Show error if initialization failed
  if (initError) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Authentication Initialization Failed
          </Typography>
          <Typography variant="body2">
            {initError}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Please check your configuration and try refreshing the page.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
};