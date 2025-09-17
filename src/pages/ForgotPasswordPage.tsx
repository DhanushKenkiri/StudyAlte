import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Email,
  Lock,
  VpnKey,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { type RootState, type AppDispatch } from '../store';
import { resetPassword, confirmResetPassword, clearError } from '../store/slices/authSlice';
import { validateEmail, validatePassword } from '../utils/validation';

const steps = ['Enter Email', 'Reset Password'];

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  const { isLoading, error, pendingVerification } = useSelector((state: RootState) => state.auth);
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    confirmationCode: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Handle pending verification state
  useEffect(() => {
    if (pendingVerification.type === 'password-reset' && pendingVerification.email) {
      setActiveStep(1);
    }
  }, [pendingVerification]);

  // Clear errors when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Clear global error
    if (error) {
      dispatch(clearError());
    }
  };

  const validateEmailForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateResetForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Confirmation code validation
    if (!formData.confirmationCode) {
      errors.confirmationCode = 'Confirmation code is required';
    } else if (formData.confirmationCode.length !== 6 || !/^\d{6}$/.test(formData.confirmationCode)) {
      errors.confirmationCode = 'Please enter a valid 6-digit code';
    }

    // New password validation
    if (!formData.newPassword) {
      errors.newPassword = 'New password is required';
    } else {
      try {
        validatePassword(formData.newPassword);
      } catch (validationError: any) {
        errors.newPassword = validationError.message;
      }
    }

    // Confirm new password validation
    if (!formData.confirmNewPassword) {
      errors.confirmNewPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmNewPassword) {
      errors.confirmNewPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateEmailForm()) {
      return;
    }

    try {
      await dispatch(resetPassword({ email: formData.email })).unwrap();
      // Step will be updated by useEffect when pendingVerification changes
    } catch (error) {
      console.error('Password reset request failed:', error);
    }
  };

  const handleResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateResetForm()) {
      return;
    }

    try {
      await dispatch(confirmResetPassword({
        email: pendingVerification.email || formData.email,
        confirmationCode: formData.confirmationCode,
        newPassword: formData.newPassword,
      })).unwrap();
      
      // Redirect to login page with success message
      navigate('/auth/login', {
        state: {
          message: 'Password reset successfully! Please sign in with your new password.',
        },
      });
    } catch (error) {
      console.error('Password reset failed:', error);
    }
  };

  const renderEmailForm = () => (
    <Box component="form" onSubmit={handleEmailSubmit} noValidate>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        Enter your email address and we'll send you a code to reset your password.
      </Typography>

      <TextField
        fullWidth
        label="Email Address"
        type="email"
        value={formData.email}
        onChange={handleInputChange('email')}
        error={!!fieldErrors.email}
        helperText={fieldErrors.email}
        margin="normal"
        autoComplete="email"
        autoFocus
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Email color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={isLoading}
        sx={{
          py: 1.5,
          mb: 2,
          borderRadius: 2,
          textTransform: 'none',
          fontSize: '1.1rem',
          fontWeight: 600,
        }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Send Reset Code'
        )}
      </Button>
    </Box>
  );

  const renderResetForm = () => (
    <Box component="form" onSubmit={handleResetSubmit} noValidate>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        We've sent a reset code to{' '}
        <Typography component="span" fontWeight="bold">
          {pendingVerification.email || formData.email}
        </Typography>
        . Enter the code and your new password below.
      </Typography>

      <TextField
        fullWidth
        label="Reset Code"
        value={formData.confirmationCode}
        onChange={handleInputChange('confirmationCode')}
        error={!!fieldErrors.confirmationCode}
        helperText={fieldErrors.confirmationCode}
        margin="normal"
        autoComplete="one-time-code"
        inputProps={{
          maxLength: 6,
          pattern: '[0-9]*',
          inputMode: 'numeric',
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <VpnKey color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="New Password"
        type="password"
        value={formData.newPassword}
        onChange={handleInputChange('newPassword')}
        error={!!fieldErrors.newPassword}
        helperText={fieldErrors.newPassword || 'Must contain uppercase, lowercase, numbers, and special characters'}
        margin="normal"
        autoComplete="new-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Confirm New Password"
        type="password"
        value={formData.confirmNewPassword}
        onChange={handleInputChange('confirmNewPassword')}
        error={!!fieldErrors.confirmNewPassword}
        helperText={fieldErrors.confirmNewPassword}
        margin="normal"
        autoComplete="new-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={isLoading}
        sx={{
          py: 1.5,
          mb: 2,
          borderRadius: 2,
          textTransform: 'none',
          fontSize: '1.1rem',
          fontWeight: 600,
        }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Reset Password'
        )}
      </Button>
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper
            elevation={8}
            sx={{
              p: 4,
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <VpnKey sx={{ fontSize: 32, color: 'white' }} />
                </Box>
              </motion.div>
              <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                Reset Password
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {activeStep === 0
                  ? 'Enter your email to receive a password reset code'
                  : 'Create a new password for your account'
                }
              </Typography>
            </Box>

            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Error message */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Form content */}
            {activeStep === 0 ? renderEmailForm() : renderResetForm()}

            {/* Footer */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Remember your password?{' '}
                <Link
                  component={RouterLink}
                  to="/auth/login"
                  variant="body2"
                  sx={{ 
                    textDecoration: 'none',
                    fontWeight: 600,
                    color: 'primary.main',
                  }}
                >
                  Sign in here
                </Link>
              </Typography>
            </Box>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
};