import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import { type RootState, type AppDispatch } from '../../store';
import { getCurrentSession } from '../../store/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallbackMessage?: string;
}

/**
 * ProtectedRoute component that handles authentication checks
 * and redirects unauthenticated users to the login page
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  redirectTo = '/auth/login',
  fallbackMessage = 'Please sign in to access this page.',
}) => {
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth);

  // Check for existing session on mount
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      dispatch(getCurrentSession());
    }
  }, [dispatch, isAuthenticated, isLoading]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        state={{
          from: location,
          message: fallbackMessage,
        }}
        replace
      />
    );
  }

  // Redirect authenticated users away from auth pages
  if (!requireAuth && isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};

/**
 * Hook to check if user has specific permissions or roles
 */
export const useAuthGuard = () => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const hasPermission = (permission: string): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Check if user has the required permission
    // This would be expanded based on your permission system
    return user.subscription.features.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Check if user has the required role
    // This would be expanded based on your role system
    return user.subscription.tier === role || user.subscription.tier === 'admin';
  };

  const isSubscriptionActive = (): boolean => {
    if (!isAuthenticated || !user) return false;
    return user.subscription.status === 'active';
  };

  const canAccessFeature = (feature: string): boolean => {
    if (!isAuthenticated || !user) return false;
    return user.subscription.features.includes(feature) && isSubscriptionActive();
  };

  return {
    hasPermission,
    hasRole,
    isSubscriptionActive,
    canAccessFeature,
    user,
    isAuthenticated,
  };
};

/**
 * Component that conditionally renders content based on authentication status
 */
interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
  requirePermission?: string;
  requireRole?: string;
  requireFeature?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback = null,
  requireAuth = true,
  requirePermission,
  requireRole,
  requireFeature,
}) => {
  const {
    isAuthenticated,
    hasPermission,
    hasRole,
    canAccessFeature,
  } = useAuthGuard();

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  // Check permission requirement
  if (requirePermission && !hasPermission(requirePermission)) {
    return <>{fallback}</>;
  }

  // Check role requirement
  if (requireRole && !hasRole(requireRole)) {
    return <>{fallback}</>;
  }

  // Check feature requirement
  if (requireFeature && !canAccessFeature(requireFeature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Higher-order component for protecting routes
 */
export const withAuthGuard = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requireAuth?: boolean;
    requirePermission?: string;
    requireRole?: string;
    requireFeature?: string;
    redirectTo?: string;
    fallbackMessage?: string;
  } = {}
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    const {
      requireAuth = true,
      requirePermission,
      requireRole,
      requireFeature,
      redirectTo = '/auth/login',
      fallbackMessage = 'You do not have permission to access this page.',
    } = options;

    const {
      isAuthenticated,
      hasPermission,
      hasRole,
      canAccessFeature,
    } = useAuthGuard();

    const location = useLocation();

    // Check authentication requirement
    if (requireAuth && !isAuthenticated) {
      return (
        <Navigate
          to={redirectTo}
          state={{
            from: location,
            message: 'Please sign in to access this page.',
          }}
          replace
        />
      );
    }

    // Check permission requirement
    if (requirePermission && !hasPermission(requirePermission)) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            from: location,
            message: fallbackMessage,
          }}
          replace
        />
      );
    }

    // Check role requirement
    if (requireRole && !hasRole(requireRole)) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            from: location,
            message: fallbackMessage,
          }}
          replace
        />
      );
    }

    // Check feature requirement
    if (requireFeature && !canAccessFeature(requireFeature)) {
      return (
        <Navigate
          to="/upgrade"
          state={{
            from: location,
            message: 'This feature requires a subscription upgrade.',
            requiredFeature: requireFeature,
          }}
          replace
        />
      );
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAuthGuard(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};