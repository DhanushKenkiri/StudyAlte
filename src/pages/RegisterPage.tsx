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
  IconButton,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
  PersonAdd,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { type RootState, type AppDispatch } from '../store';
import { signUp, confirmSignUp, resendConfirmationCode, clearError } from '../store/slices/authSlice';
import { validateEmail, validatePassword } from '../utils/validation';

const steps = ['Create Account', 'Verify Email'];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  const { isLoading, error, isAuthenticated, pendingVerification } = useSelector(
    (state: RootState) => state.auth
  );
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    givenName: '',
    familyName: '',
    agreeToTerms: false,
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle pending verification state
  useEffect(() => {
    if (pendingVerification.type === 'signup' && pendingVerification.email) {
      setActiveStep(1);
    }
  }, [pendingVerification]);

  // Clear errors when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
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

  const validateRegistrationForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
      try {
        validatePassword(formData.password);
      } catch (validationError: any) {
        errors.password = validationError.message;
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Name validation
    if (!formData.givenName.trim()) {
      errors.givenName = 'First name is required';
    } else if (formData.givenName.length > 50) {
      errors.givenName = 'First name must be less than 50 characters';
    }

    if (formData.familyName && formData.familyName.length > 50) {
      errors.familyName = 'Last name must be less than 50 characters';
    }

    // Terms agreement validation
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegistrationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateRegistrationForm()) {
      return;
    }

    try {
      await dispatch(signUp({
        email: formData.email,
        password: formData.password,
        givenName: formData.givenName,
        familyName: formData.familyName || undefined,
      })).unwrap();
      
      // Step will be updated by useEffect when pendingVerification changes
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const handleVerificationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      setFieldErrors({ verificationCode: 'Please enter a valid 6-digit code' });
      return;
    }

    try {
      await dispatch(confirmSignUp({
        email: pendingVerification.email || formData.email,
        code: verificationCode,
      })).unwrap();
      
      // Redirect to login page with success message
      navigate('/auth/login', {
        state: {
          message: 'Account verified successfully! Please sign in.',
        },
      });
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  const handleResendCode = async () => {
    try {
      await dispatch(resendConfirmationCode(pendingVerification.email || formData.email)).unwrap();
    } catch (error) {
      console.error('Resend failed:', error);
    }
  };

  const handleTogglePasswordVisibility = (field: 'password' | 'confirmPassword') => () => {
    if (field === 'password') {
      setShowPassword(prev => !prev);
    } else {
      setShowConfirmPassword(prev => !prev);
    }
  };

  const renderRegistrationForm = () => (
    <Box component="form" onSubmit={handleRegistrationSubmit} noValidate>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="First Name"
          value={formData.givenName}
          onChange={handleInputChange('givenName')}
          error={!!fieldErrors.givenName}
          helperText={fieldErrors.givenName}
          autoComplete="given-name"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Person color="action" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label="Last Name (Optional)"
          value={formData.familyName}
          onChange={handleInputChange('familyName')}
          error={!!fieldErrors.familyName}
          helperText={fieldErrors.familyName}
          autoComplete="family-name"
        />
      </Box>

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
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Email color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={formData.password}
        onChange={handleInputChange('password')}
        error={!!fieldErrors.password}
        helperText={fieldErrors.password || 'Must contain uppercase, lowercase, numbers, and special characters'}
        margin="normal"
        autoComplete="new-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleTogglePasswordVisibility('password')}
                edge="end"
                aria-label="toggle password visibility"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Confirm Password"
        type={showConfirmPassword ? 'text' : 'password'}
        value={formData.confirmPassword}
        onChange={handleInputChange('confirmPassword')}
        error={!!fieldErrors.confirmPassword}
        helperText={fieldErrors.confirmPassword}
        margin="normal"
        autoComplete="new-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleTogglePasswordVisibility('confirmPassword')}
                edge="end"
                aria-label="toggle confirm password visibility"
              >
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={formData.agreeToTerms}
            onChange={handleInputChange('agreeToTerms')}
            color="primary"
          />
        }
        label={
          <Typography variant="body2">
            I agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" rel="noopener">
              Privacy Policy
            </Link>
          </Typography>
        }
        sx={{ mb: 2 }}
      />
      {fieldErrors.agreeToTerms && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 2 }}>
          {fieldErrors.agreeToTerms}
        </Typography>
      )}

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
          'Create Account'
        )}
      </Button>
    </Box>
  );

  const renderVerificationForm = () => (
    <Box component="form" onSubmit={handleVerificationSubmit} noValidate>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        We've sent a verification code to{' '}
        <Typography component="span" fontWeight="bold">
          {pendingVerification.email || formData.email}
        </Typography>
        . Please enter the 6-digit code below.
      </Typography>

      <TextField
        fullWidth
        label="Verification Code"
        value={verificationCode}
        onChange={(e) => {
          setVerificationCode(e.target.value);
          if (fieldErrors.verificationCode) {
            setFieldErrors(prev => ({ ...prev, verificationCode: '' }));
          }
          if (error) {
            dispatch(clearError());
          }
        }}
        error={!!fieldErrors.verificationCode}
        helperText={fieldErrors.verificationCode}
        margin="normal"
        autoComplete="one-time-code"
        inputProps={{
          maxLength: 6,
          pattern: '[0-9]*',
          inputMode: 'numeric',
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
          'Verify Account'
        )}
      </Button>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Didn't receive the code?{' '}
          <Button
            variant="text"
            size="small"
            onClick={handleResendCode}
            disabled={isLoading}
            sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
          >
            Resend Code
          </Button>
        </Typography>
      </Box>
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
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <PersonAdd sx={{ fontSize: 32, color: 'white' }} />
                </Box>
              </motion.div>
              <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                {activeStep === 0 ? 'Create Account' : 'Verify Email'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {activeStep === 0
                  ? 'Join YouTube Learning Platform and start your learning journey'
                  : 'Complete your registration by verifying your email address'
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
            {activeStep === 0 ? renderRegistrationForm() : renderVerificationForm()}

            {/* Footer */}
            {activeStep === 0 && (
              <>
                <Divider sx={{ my: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    OR
                  </Typography>
                </Divider>

                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Already have an account?{' '}
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
              </>
            )}
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
};