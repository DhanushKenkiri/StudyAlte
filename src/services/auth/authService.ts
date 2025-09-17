import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  updatePassword,
  updateUserAttributes,
  confirmUserAttribute,
  deleteUser,
  type SignUpInput,
  type ConfirmSignUpInput,
  type SignInInput,
  type ResetPasswordInput,
  type ConfirmResetPasswordInput,
} from '@aws-amplify/auth';
import { User } from '../../types/user';
import { AuthError, ValidationError } from '../../types/errors';

export interface SignUpData {
  email: string;
  password: string;
  givenName: string;
  familyName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface ConfirmResetPasswordData {
  email: string;
  confirmationCode: string;
  newPassword: string;
}

export interface UpdatePasswordData {
  oldPassword: string;
  newPassword: string;
}

export interface UpdateProfileData {
  givenName?: string;
  familyName?: string;
  email?: string;
}

export interface AuthSession {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  user: User;
}

/**
 * Authentication Service
 * Provides a clean interface for AWS Cognito authentication operations
 */
export class AuthService {
  /**
   * Sign up a new user
   */
  static async signUp(data: SignUpData): Promise<{ userId: string; isConfirmed: boolean }> {
    try {
      const { email, password, givenName, familyName } = data;

      // Validate input
      this.validateEmail(email);
      this.validatePassword(password);
      this.validateName(givenName);

      const signUpInput: SignUpInput = {
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            given_name: givenName,
            ...(familyName && { family_name: familyName }),
          },
        },
      };

      const result = await signUp(signUpInput);
      
      return {
        userId: result.userId || email,
        isConfirmed: result.isSignUpComplete,
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Confirm user sign up with verification code
   */
  static async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    try {
      this.validateEmail(email);
      this.validateConfirmationCode(confirmationCode);

      const confirmSignUpInput: ConfirmSignUpInput = {
        username: email,
        confirmationCode,
      };

      await confirmSignUp(confirmSignUpInput);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Resend confirmation code
   */
  static async resendConfirmationCode(email: string): Promise<void> {
    try {
      this.validateEmail(email);
      await resendSignUpCode({ username: email });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in user
   */
  static async signIn(data: SignInData): Promise<AuthSession> {
    try {
      const { email, password } = data;

      this.validateEmail(email);
      this.validatePassword(password);

      const signInInput: SignInInput = {
        username: email,
        password,
      };

      const result = await signIn(signInInput);
      
      if (result.isSignedIn) {
        return await this.getCurrentSession();
      } else {
        throw new AuthError('Sign in incomplete', 'SIGN_IN_INCOMPLETE');
      }
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current authenticated user session
   */
  static async getCurrentSession(): Promise<AuthSession> {
    try {
      const [user, session] = await Promise.all([
        getCurrentUser(),
        fetchAuthSession(),
      ]);

      if (!session.tokens) {
        throw new AuthError('No valid session found', 'NO_SESSION');
      }

      const userProfile: User = {
        id: user.userId,
        email: user.signInDetails?.loginId || '',
        name: `${user.signInDetails?.loginId?.split('@')[0] || 'User'}`,
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            push: false,
            studyReminders: true,
          },
          privacy: {
            profileVisibility: 'private',
            shareProgress: false,
          },
          learning: {
            difficultyLevel: 'beginner',
            preferredContentTypes: ['video', 'text'],
            studyGoals: {
              dailyMinutes: 30,
              weeklyGoal: 5,
            },
          },
        },
        subscription: {
          tier: 'free',
          status: 'active',
          startDate: new Date().toISOString(),
          features: ['basic_video_processing', 'limited_ai_tutor', 'basic_analytics'],
        },
        profile: {
          avatar: null,
          bio: null,
          location: null,
          website: null,
          socialLinks: {},
        },
        stats: {
          totalCapsules: 0,
          totalStudyTime: 0,
          currentStreak: 0,
          longestStreak: 0,
          completedQuizzes: 0,
          averageQuizScore: 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        isActive: true,
        emailVerified: true,
        onboardingCompleted: false,
      };

      return {
        accessToken: session.tokens.accessToken.toString(),
        idToken: session.tokens.idToken?.toString() || '',
        refreshToken: session.tokens.refreshToken?.toString() || '',
        user: userProfile,
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset password - send reset code
   */
  static async resetPassword(data: ResetPasswordData): Promise<void> {
    try {
      this.validateEmail(data.email);

      const resetPasswordInput: ResetPasswordInput = {
        username: data.email,
      };

      await resetPassword(resetPasswordInput);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Confirm password reset with code
   */
  static async confirmResetPassword(data: ConfirmResetPasswordData): Promise<void> {
    try {
      const { email, confirmationCode, newPassword } = data;

      this.validateEmail(email);
      this.validateConfirmationCode(confirmationCode);
      this.validatePassword(newPassword);

      const confirmResetPasswordInput: ConfirmResetPasswordInput = {
        username: email,
        confirmationCode,
        newPassword,
      };

      await confirmResetPassword(confirmResetPasswordInput);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(data: UpdatePasswordData): Promise<void> {
    try {
      const { oldPassword, newPassword } = data;

      this.validatePassword(oldPassword);
      this.validatePassword(newPassword);

      await updatePassword({
        oldPassword,
        newPassword,
      });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Update user profile attributes
   */
  static async updateProfile(data: UpdateProfileData): Promise<void> {
    try {
      const attributes: Record<string, string> = {};

      if (data.givenName) {
        this.validateName(data.givenName);
        attributes.given_name = data.givenName;
      }

      if (data.familyName) {
        this.validateName(data.familyName);
        attributes.family_name = data.familyName;
      }

      if (data.email) {
        this.validateEmail(data.email);
        attributes.email = data.email;
      }

      if (Object.keys(attributes).length > 0) {
        await updateUserAttributes({
          userAttributes: attributes,
        });
      }
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Confirm user attribute update
   */
  static async confirmAttributeUpdate(attributeKey: string, confirmationCode: string): Promise<void> {
    try {
      this.validateConfirmationCode(confirmationCode);

      await confirmUserAttribute({
        userAttributeKey: attributeKey,
        confirmationCode,
      });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(): Promise<void> {
    try {
      await deleteUser();
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Validate email format
   */
  private static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', 'INVALID_EMAIL');
    }
  }

  /**
   * Validate password strength
   */
  private static validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long', 'WEAK_PASSWORD');
    }

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasLowercase || !hasUppercase || !hasNumbers || !hasSpecialChar) {
      throw new ValidationError(
        'Password must contain lowercase, uppercase, numbers, and special characters',
        'WEAK_PASSWORD'
      );
    }
  }

  /**
   * Validate name
   */
  private static validateName(name: string): void {
    if (!name || name.trim().length < 1) {
      throw new ValidationError('Name is required', 'INVALID_NAME');
    }

    if (name.length > 50) {
      throw new ValidationError('Name must be less than 50 characters', 'INVALID_NAME');
    }
  }

  /**
   * Validate confirmation code
   */
  private static validateConfirmationCode(code: string): void {
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new ValidationError('Confirmation code must be 6 digits', 'INVALID_CODE');
    }
  }

  /**
   * Handle and transform authentication errors
   */
  private static handleAuthError(error: any): AuthError {
    if (error instanceof ValidationError || error instanceof AuthError) {
      return error;
    }

    const errorMessage = error?.message || 'An authentication error occurred';
    let errorCode = 'UNKNOWN_ERROR';

    // Map common Cognito error codes
    if (error?.name) {
      switch (error.name) {
        case 'UserAlreadyExistsException':
          errorCode = 'USER_EXISTS';
          break;
        case 'UsernameExistsException':
          errorCode = 'USER_EXISTS';
          break;
        case 'InvalidParameterException':
          errorCode = 'INVALID_PARAMETER';
          break;
        case 'InvalidPasswordException':
          errorCode = 'INVALID_PASSWORD';
          break;
        case 'NotAuthorizedException':
          errorCode = 'INVALID_CREDENTIALS';
          break;
        case 'UserNotConfirmedException':
          errorCode = 'USER_NOT_CONFIRMED';
          break;
        case 'UserNotFoundException':
          errorCode = 'USER_NOT_FOUND';
          break;
        case 'CodeMismatchException':
          errorCode = 'INVALID_CODE';
          break;
        case 'ExpiredCodeException':
          errorCode = 'EXPIRED_CODE';
          break;
        case 'LimitExceededException':
          errorCode = 'RATE_LIMIT_EXCEEDED';
          break;
        case 'TooManyRequestsException':
          errorCode = 'RATE_LIMIT_EXCEEDED';
          break;
        case 'NetworkError':
          errorCode = 'NETWORK_ERROR';
          break;
        default:
          errorCode = error.name;
      }
    }

    return new AuthError(errorMessage, errorCode);
  }
}