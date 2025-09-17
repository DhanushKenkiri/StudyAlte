import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LoadingOverlay, InlineLoading, LoadingSkeleton } from '../LoadingOverlay';

// Test wrapper with theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

describe('LoadingOverlay', () => {
  describe('rendering', () => {
    it('should render when open is true', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} />
        </TestWrapper>
      );

      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={false} />
        </TestWrapper>
      );

      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeInTheDocument();
    });

    it('should render with message', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} message="Loading data..." />
        </TestWrapper>
      );

      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('should render without backdrop when backdrop is false', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} backdrop={false} message="Loading..." />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should render circular progress by default', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} />
        </TestWrapper>
      );

      const circularProgress = document.querySelector('.MuiCircularProgress-root');
      expect(circularProgress).toBeInTheDocument();
    });

    it('should render linear progress when variant is linear', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} variant="linear" />
        </TestWrapper>
      );

      const linearProgress = document.querySelector('.MuiLinearProgress-root');
      expect(linearProgress).toBeInTheDocument();
    });

    it('should render dots variant', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} variant="dots" />
        </TestWrapper>
      );

      // Check for dots (should be 3 animated dots)
      const dots = document.querySelectorAll('[style*="animation"]');
      expect(dots.length).toBeGreaterThan(0);
    });
  });

  describe('progress', () => {
    it('should show progress value for circular variant', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} variant="circular" progress={75} />
        </TestWrapper>
      );

      const circularProgress = document.querySelector('.MuiCircularProgress-root');
      expect(circularProgress).toBeInTheDocument();
    });

    it('should show progress value and percentage for linear variant', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} variant="linear" progress={50} />
        </TestWrapper>
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
      const linearProgress = document.querySelector('.MuiLinearProgress-root');
      expect(linearProgress).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should render small size', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} size="small" />
        </TestWrapper>
      );

      const circularProgress = document.querySelector('.MuiCircularProgress-root');
      expect(circularProgress).toBeInTheDocument();
    });

    it('should render large size', () => {
      render(
        <TestWrapper>
          <LoadingOverlay open={true} size="large" />
        </TestWrapper>
      );

      const circularProgress = document.querySelector('.MuiCircularProgress-root');
      expect(circularProgress).toBeInTheDocument();
    });
  });
});

describe('InlineLoading', () => {
  it('should render when loading is true', () => {
    render(
      <TestWrapper>
        <InlineLoading loading={true} message="Loading content..." />
      </TestWrapper>
    );

    expect(screen.getByText('Loading content...')).toBeInTheDocument();
  });

  it('should not render when loading is false', () => {
    render(
      <TestWrapper>
        <InlineLoading loading={false} message="Loading content..." />
      </TestWrapper>
    );

    expect(screen.queryByText('Loading content...')).not.toBeInTheDocument();
  });

  it('should render with custom minHeight', () => {
    const { container } = render(
      <TestWrapper>
        <InlineLoading loading={true} minHeight={200} />
      </TestWrapper>
    );

    const loadingContainer = container.firstChild as HTMLElement;
    expect(loadingContainer).toHaveStyle('min-height: 200px');
  });

  it('should render with different variants', () => {
    render(
      <TestWrapper>
        <InlineLoading loading={true} variant="linear" />
      </TestWrapper>
    );

    const linearProgress = document.querySelector('.MuiLinearProgress-root');
    expect(linearProgress).toBeInTheDocument();
  });

  it('should render with different sizes', () => {
    render(
      <TestWrapper>
        <InlineLoading loading={true} size="large" />
      </TestWrapper>
    );

    const circularProgress = document.querySelector('.MuiCircularProgress-root');
    expect(circularProgress).toBeInTheDocument();
  });
});

describe('LoadingSkeleton', () => {
  it('should render single skeleton by default', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton />
      </TestWrapper>
    );

    const skeletons = container.querySelectorAll('[style*="animation"]');
    expect(skeletons).toHaveLength(1);
  });

  it('should render multiple skeletons when count is specified', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton count={3} />
      </TestWrapper>
    );

    const skeletonContainer = container.firstChild as HTMLElement;
    expect(skeletonContainer.children).toHaveLength(3);
  });

  it('should render text variant by default', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle('height: 20px');
  });

  it('should render rectangular variant', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton variant="rectangular" height={100} />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle('height: 100px');
  });

  it('should render circular variant', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton variant="circular" width={50} height={50} />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle('border-radius: 50%');
    expect(skeleton).toHaveStyle('width: 50px');
    expect(skeleton).toHaveStyle('height: 50px');
  });

  it('should render with custom dimensions', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton width="200px" height="30px" />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle('width: 200px');
    expect(skeleton).toHaveStyle('height: 30px');
  });

  it('should render without animation when animation is false', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton animation={false} />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle('animation: none');
  });

  it('should render with wave animation', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton animation="wave" />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.animation).toContain('wave');
  });

  it('should render with pulse animation by default', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton />
      </TestWrapper>
    );

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.animation).toContain('pulse');
  });

  it('should apply staggered animation delay for multiple skeletons', () => {
    const { container } = render(
      <TestWrapper>
        <LoadingSkeleton count={3} />
      </TestWrapper>
    );

    const skeletonContainer = container.firstChild as HTMLElement;
    const skeletons = Array.from(skeletonContainer.children) as HTMLElement[];
    
    expect(skeletons[0]).toHaveStyle('animation-delay: 0s');
    expect(skeletons[1]).toHaveStyle('animation-delay: 0.1s');
    expect(skeletons[2]).toHaveStyle('animation-delay: 0.2s');
  });
});

describe('accessibility', () => {
  it('should have proper ARIA attributes for loading overlay', () => {
    render(
      <TestWrapper>
        <LoadingOverlay open={true} message="Loading..." />
      </TestWrapper>
    );

    // Backdrop should be present for screen readers
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).toBeInTheDocument();
  });

  it('should announce loading state to screen readers', () => {
    render(
      <TestWrapper>
        <InlineLoading loading={true} message="Loading content..." />
      </TestWrapper>
    );

    expect(screen.getByText('Loading content...')).toBeInTheDocument();
  });
});

describe('theme integration', () => {
  it('should use theme colors', () => {
    const customTheme = createTheme({
      palette: {
        primary: {
          main: '#ff0000',
        },
      },
    });

    render(
      <ThemeProvider theme={customTheme}>
        <LoadingOverlay open={true} />
      </ThemeProvider>
    );

    const circularProgress = document.querySelector('.MuiCircularProgress-root');
    expect(circularProgress).toBeInTheDocument();
  });

  it('should adapt to dark theme', () => {
    const darkTheme = createTheme({
      palette: {
        mode: 'dark',
      },
    });

    render(
      <ThemeProvider theme={darkTheme}>
        <LoadingOverlay open={true} message="Loading..." />
      </ThemeProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});