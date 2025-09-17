import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../types/user';
import { AuthError } from '../../types/errors';
import {
  AuthService,
  type SignUpData,
  type SignInData,
  type ResetPasswordData,
  type ConfirmResetPasswordData,
  type UpdatePasswordData,
  type UpdateProfileData,
  type AuthSession,
} from '../../services/auth/authService';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tokens: {
    accessToken: string | null;
    idToken: string | null;
    refreshToken: string | null;
  };
  // UI state
  showMfaChallenge: boolean;
  pendingVerification: {
    email: string | null;
    type: 'signup' | 'password-reset' | 'attribute-update' | null;
  };
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  tokens: {
    accessToken: null,
    idToken: null,
    refreshToken: null,
  },
  showMfaChallenge: false,
  pendingVerification: {
    email: null,
    type: null,
  },
};

// Async thunks for authentication actions

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (data: SignUpData, { rejectWithValue }) => {
    try {
      const result = await AuthService.signUp(data);
      return { ...result, email: data.email };
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Sign up failed');
    }
  }
);

export const confirmSignUp = createAsyncThunk(
  'auth/confirmSignUp',
  async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
    try {
      await AuthService.confirmSignUp(email, code);
      return { email };
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Confirmation failed');
    }
  }
);

export const resendConfirmationCode = createAsyncThunk(
  'auth/resendConfirmationCode',
  async (email: string, { rejectWithValue }) => {
    try {
      await AuthService.resendConfirmationCode(email);
      return { email };
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Resend failed');
    }
  }
);

export const signIn = createAsyncThunk(
  'auth/signIn',
  async (data: SignInData, { rejectWithValue }) => {
    try {
      const session = await AuthService.signIn(data);
      return session;
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Sign in failed');
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.signOut();
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Sign out failed');
    }
  }
);

export const getCurrentSession = createAsyncThunk(
  'auth/getCurrentSession',
  async (_, { rejectWithValue }) => {
    try {
      const session = await AuthService.getCurrentSession();
      return session;
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Session retrieval failed');
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (data: ResetPasswordData, { rejectWithValue }) => {
    try {
      await AuthService.resetPassword(data);
      return { email: data.email };
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Password reset failed');
    }
  }
);

export const confirmResetPassword = createAsyncThunk(
  'auth/confirmResetPassword',
  async (data: ConfirmResetPasswordData, { rejectWithValue }) => {
    try {
      await AuthService.confirmResetPassword(data);
      return { email: data.email };
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Password reset confirmation failed');
    }
  }
);

export const updatePassword = createAsyncThunk(
  'auth/updatePassword',
  async (data: UpdatePasswordData, { rejectWithValue }) => {
    try {
      await AuthService.updatePassword(data);
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Password update failed');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: UpdateProfileData, { rejectWithValue }) => {
    try {
      await AuthService.updateProfile(data);
      // Refresh session to get updated user data
      const session = await AuthService.getCurrentSession();
      return session;
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Profile update failed');
    }
  }
);

export const confirmAttributeUpdate = createAsyncThunk(
  'auth/confirmAttributeUpdate',
  async ({ attributeKey, code }: { attributeKey: string; code: string }, { rejectWithValue }) => {
    try {
      await AuthService.confirmAttributeUpdate(attributeKey, code);
      // Refresh session to get updated user data
      const session = await AuthService.getCurrentSession();
      return session;
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Attribute confirmation failed');
    }
  }
);

export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.deleteAccount();
    } catch (error) {
      return rejectWithValue(error instanceof AuthError ? error.message : 'Account deletion failed');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearPendingVerification: (state) => {
      state.pendingVerification = {
        email: null,
        type: null,
      };
    },
    setMfaChallenge: (state, action: PayloadAction<boolean>) => {
      state.showMfaChallenge = action.payload;
    },
    updateUserPreferences: (state, action: PayloadAction<Partial<User['preferences']>>) => {
      if (state.user) {
        state.user.preferences = {
          ...state.user.preferences,
          ...action.payload,
        };
        state.user.updatedAt = new Date().toISOString();
      }
    },
    updateUserProfile: (state, action: PayloadAction<Partial<User['profile']>>) => {
      if (state.user) {
        state.user.profile = {
          ...state.user.profile,
          ...action.payload,
        };
        state.user.updatedAt = new Date().toISOString();
      }
    },
    updateUserStats: (state, action: PayloadAction<Partial<User['stats']>>) => {
      if (state.user) {
        state.user.stats = {
          ...state.user.stats,
          ...action.payload,
        };
        state.user.updatedAt = new Date().toISOString();
      }
    },
  },
  extraReducers: (builder) => {
    // Sign Up
    builder
      .addCase(signUp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        if (!action.payload.isConfirmed) {
          state.pendingVerification = {
            email: action.payload.email,
            type: 'signup',
          };
        }
      })
      .addCase(signUp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Confirm Sign Up
    builder
      .addCase(confirmSignUp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(confirmSignUp.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        state.pendingVerification = {
          email: null,
          type: null,
        };
      })
      .addCase(confirmSignUp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Resend Confirmation Code
    builder
      .addCase(resendConfirmationCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resendConfirmationCode.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(resendConfirmationCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Sign In
    builder
      .addCase(signIn.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tokens = {
          accessToken: action.payload.accessToken,
          idToken: action.payload.idToken,
          refreshToken: action.payload.refreshToken,
        };
        state.user.lastLoginAt = new Date().toISOString();
      })
      .addCase(signIn.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = {
          accessToken: null,
          idToken: null,
          refreshToken: null,
        };
      });

    // Sign Out
    builder
      .addCase(signOut.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = {
          accessToken: null,
          idToken: null,
          refreshToken: null,
        };
        state.showMfaChallenge = false;
        state.pendingVerification = {
          email: null,
          type: null,
        };
      })
      .addCase(signOut.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // Still clear auth state even if sign out fails
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = {
          accessToken: null,
          idToken: null,
          refreshToken: null,
        };
      });

    // Get Current Session
    builder
      .addCase(getCurrentSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCurrentSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tokens = {
          accessToken: action.payload.accessToken,
          idToken: action.payload.idToken,
          refreshToken: action.payload.refreshToken,
        };
      })
      .addCase(getCurrentSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = {
          accessToken: null,
          idToken: null,
          refreshToken: null,
        };
      });

    // Reset Password
    builder
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.pendingVerification = {
          email: action.payload.email,
          type: 'password-reset',
        };
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Confirm Reset Password
    builder
      .addCase(confirmResetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(confirmResetPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        state.pendingVerification = {
          email: null,
          type: null,
        };
      })
      .addCase(confirmResetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update Password
    builder
      .addCase(updatePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(updatePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update Profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.user = action.payload.user;
        state.tokens = {
          accessToken: action.payload.accessToken,
          idToken: action.payload.idToken,
          refreshToken: action.payload.refreshToken,
        };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Confirm Attribute Update
    builder
      .addCase(confirmAttributeUpdate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(confirmAttributeUpdate.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.user = action.payload.user;
        state.tokens = {
          accessToken: action.payload.accessToken,
          idToken: action.payload.idToken,
          refreshToken: action.payload.refreshToken,
        };
        state.pendingVerification = {
          email: null,
          type: null,
        };
      })
      .addCase(confirmAttributeUpdate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Delete Account
    builder
      .addCase(deleteAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = {
          accessToken: null,
          idToken: null,
          refreshToken: null,
        };
        state.showMfaChallenge = false;
        state.pendingVerification = {
          email: null,
          type: null,
        };
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  clearPendingVerification,
  setMfaChallenge,
  updateUserPreferences,
  updateUserProfile,
  updateUserStats,
} = authSlice.actions;

export default authSlice.reducer;