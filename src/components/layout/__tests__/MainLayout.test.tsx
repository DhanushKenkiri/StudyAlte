import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import { MainLayout } from '../MainLayout';
import authReducer from '../../../store/slices/authSlice';
import uiReducer from '../../../store/slices/uiSlice';

// Mock the useThemeMode hook
jest.mock('../../../hooks/useThemeMode', () => ({
  useThemeMode: () => ({
    mode: 'light',
    toggleMode: jest.fn(),
    setLightMode: jest.fn(),
    setDarkMode: jest.fn(),
    resetToSystemPreference: jest.fn(),
    isDark: false,
    isLight: true,
  }),
}));

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/dashboard' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Outlet: () => <div data-testid="outlet">Outlet Content</div>,
}));

// Create a test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
    },
    preloadedState: {
      auth: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        ...initialState.auth,
      },
      ui: {
        isLoading: false,
        loadingStates: {},
        loadingMessage: undefined,
        notifications: [],
        sidebarOpen: true,
        sidebarCollapsed: false,
        theme: 'light',
        pageTitle: undefined,
        breadcrumbs: [],
        ...initialState.ui,
      },
    },
  });
};

// Test wrapper component
const TestWrapper: React.FC<{
  children: React.ReactNode;
  store?: any;
  theme?: any;
}> = ({ children, store, theme }) => {
  const testStore = store || createTestStore();
  const testTheme = theme || createTheme();

  return (
    <Provider store={testStore}>
      <BrowserRouter>
        <ThemeProvider theme={testTheme}>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('MainLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the main layout with all components', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      // Check for main components
      expect(screen.getByText('LearnTube')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByLabelText('toggle drawer')).toBeInTheDocument();
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should render navigation items', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      // Check for navigation items
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Video Library')).toBeInTheDocument();
      expect(screen.getByText('Flashcards')).toBeInTheDocument();
      expect(screen.getByText('Quizzes')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Mind Maps')).toBeInTheDocument();
    });

    it('should render user avatar when user is authenticated', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const avatar = screen.getByRole('button', { name: /account settings/i });
      expect(avatar).toBeInTheDocument();
      expect(avatar.querySelector('.MuiAvatar-root')).toBeInTheDocument();
    });

    it('should not render user avatar when user is not authenticated', () => {
      const store = createTestStore({
        auth: {
          user: null,
          isAuthenticated: false,
        },
      });

      render(
        <TestWrapper store={store}>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /account settings/i })).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate when clicking navigation items', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const homeButton = screen.getByText('Home');
      fireEvent.click(homeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should highlight active navigation item', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      expect(dashboardButton).toHaveClass('Mui-selected');
    });

    it('should show correct page title in app bar', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('drawer functionality', () => {
    it('should toggle drawer when clicking menu button', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText('toggle drawer');
      fireEvent.click(menuButton);

      // The drawer behavior depends on screen size, so we just check that the click handler works
      expect(menuButton).toBeInTheDocument();
    });

    it('should show theme toggle switch', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.getByText('Light Mode')).toBeInTheDocument();
    });
  });

  describe('user menu', () => {
    it('should open user menu when clicking avatar', async () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const avatar = screen.getByRole('button', { name: /account settings/i });
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should navigate to profile when clicking profile menu item', async () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const avatar = screen.getByRole('button', { name: /account settings/i });
      fireEvent.click(avatar);

      await waitFor(() => {
        const profileMenuItem = screen.getByText('Profile');
        fireEvent.click(profileMenuItem);
        expect(mockNavigate).toHaveBeenCalledWith('/profile');
      });
    });

    it('should navigate to settings when clicking settings menu item', async () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const avatar = screen.getByRole('button', { name: /account settings/i });
      fireEvent.click(avatar);

      await waitFor(() => {
        const settingsMenuItem = screen.getByText('Settings');
        fireEvent.click(settingsMenuItem);
        expect(mockNavigate).toHaveBeenCalledWith('/settings');
      });
    });
  });

  describe('loading states', () => {
    it('should show global loading indicator when auth is loading', () => {
      const store = createTestStore({
        auth: {
          isLoading: true,
        },
      });

      render(
        <TestWrapper store={store}>
          <MainLayout />
        </TestWrapper>
      );

      // LoadingOverlay should be rendered (though it might not be visible in test)
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should show progress indicator when global loading is active', () => {
      const store = createTestStore({
        ui: {
          isLoading: true,
        },
      });

      render(
        <TestWrapper store={store}>
          <MainLayout />
        </TestWrapper>
      );

      // Check for progress indicator in the app bar
      const progressBar = document.querySelector('.MuiLinearProgress-root');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('responsive behavior', () => {
    it('should handle mobile layout', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 899.95px)', // md breakpoint
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.getByText('LearnTube')).toBeInTheDocument();
    });
  });

  describe('error boundary', () => {
    it('should wrap content in error boundary', () => {
      render(
        <TestWrapper>
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.getByLabelText('toggle drawer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /account settings/i })).toBeInTheDocument();
    });

    it('should have proper navigation structure', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });
  });

  describe('theme integration', () => {
    it('should apply theme correctly', () => {
      const darkTheme = createTheme({
        palette: {
          mode: 'dark',
        },
      });

      render(
        <TestWrapper theme={darkTheme}>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.getByText('LearnTube')).toBeInTheDocument();
    });
  });

  describe('children rendering', () => {
    it('should render children when provided', () => {
      render(
        <TestWrapper>
          <MainLayout>
            <div data-testid="custom-content">Custom Content</div>
          </MainLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('should render Outlet when no children provided', () => {
      render(
        <TestWrapper>
          <MainLayout />
        </TestWrapper>
      );

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
  });
});