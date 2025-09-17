import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ChatInterface, Message, ChatSession } from '../ChatInterface';

const theme = createTheme();

const mockMessages: Message[] = [
  {
    id: '1',
    content: 'Hello, can you help me understand machine learning?',
    sender: 'user',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    type: 'text',
  },
  {
    id: '2',
    content: 'Of course! Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.',
    sender: 'assistant',
    timestamp: new Date('2024-01-01T10:01:00Z'),
    type: 'text',
    metadata: {
      confidence: 0.95,
      relatedConcepts: ['AI', 'Data Science', 'Algorithms'],
      sources: ['Introduction to ML', 'AI Fundamentals'],
    },
    reactions: {
      thumbsUp: 1,
      thumbsDown: 0,
      userReaction: 'up',
    },
  },
  {
    id: '3',
    content: '```python\nfrom sklearn import datasets\nfrom sklearn.model_selection import train_test_split\n\n# Load dataset\niris = datasets.load_iris()\nX_train, X_test, y_train, y_test = train_test_split(iris.data, iris.target)\n```',
    sender: 'assistant',
    timestamp: new Date('2024-01-01T10:02:00Z'),
    type: 'code',
    metadata: {
      language: 'python',
    },
  },
];

const mockSession: ChatSession = {
  id: 'session-1',
  title: 'Machine Learning Discussion',
  messages: mockMessages,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:02:00Z'),
  context: {
    videoId: 'video-123',
    videoTitle: 'Introduction to Machine Learning',
    topic: 'Machine Learning',
  },
};

const renderComponent = (props = {}) => {
  const defaultProps = {
    session: mockSession,
    onSendMessage: jest.fn().mockResolvedValue(undefined),
    onMessageReaction: jest.fn(),
    onExportChat: jest.fn(),
    onClearChat: jest.fn(),
    onSearchMessages: jest.fn().mockReturnValue([]),
    ...props,
  };

  return render(
    <ThemeProvider theme={theme}>
      <ChatInterface {...defaultProps} />
    </ThemeProvider>
  );
};

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders chat interface with messages', () => {
      renderComponent();
      
      expect(screen.getByText('AI Tutor')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning Discussion')).toBeInTheDocument();
      expect(screen.getByText('3 messages')).toBeInTheDocument();
      expect(screen.getByText('Hello, can you help me understand machine learning?')).toBeInTheDocument();
    });

    it('shows video context when available', () => {
      renderComponent();
      
      expect(screen.getByText('Introduction to Machine Learning')).toBeInTheDocument();
    });

    it('renders empty state when no messages', () => {
      const emptySession = { ...mockSession, messages: [] };
      renderComponent({ session: emptySession });
      
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.getByText('Ask me anything about the video content, concepts, or learning materials.')).toBeInTheDocument();
    });

    it('shows typing indicator when isTyping is true', () => {
      renderComponent({ isTyping: true });
      
      expect(screen.getByText('AI is typing...')).toBeInTheDocument();
    });
  });

  describe('Message Display', () => {
    it('displays user and assistant messages correctly', () => {
      renderComponent();
      
      // User message
      expect(screen.getByText('Hello, can you help me understand machine learning?')).toBeInTheDocument();
      
      // Assistant message
      expect(screen.getByText(/Machine learning is a subset of artificial intelligence/)).toBeInTheDocument();
    });

    it('displays code blocks with syntax highlighting', () => {
      renderComponent();
      
      expect(screen.getByText(/from sklearn import datasets/)).toBeInTheDocument();
    });

    it('shows message metadata', () => {
      renderComponent();
      
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Data Science')).toBeInTheDocument();
      expect(screen.getByText('Algorithms')).toBeInTheDocument();
    });

    it('displays message reactions', () => {
      renderComponent();
      
      // Should show thumbs up/down buttons for assistant messages
      const thumbsUpButtons = screen.getAllByRole('button', { name: /helpful/i });
      expect(thumbsUpButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Message Input', () => {
    it('allows typing and sending messages', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn().mockResolvedValue(undefined);
      renderComponent({ onSendMessage });
      
      const input = screen.getByPlaceholderText('Ask me anything about the video content...');
      await user.type(input, 'What is supervised learning?');
      
      expect(input).toHaveValue('What is supervised learning?');
      
      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);
      
      expect(onSendMessage).toHaveBeenCalledWith('What is supervised learning?');
      expect(input).toHaveValue(''); // Input should be cleared
    });

    it('sends message on Enter key press', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn().mockResolvedValue(undefined);
      renderComponent({ onSendMessage });
      
      const input = screen.getByPlaceholderText('Ask me anything about the video content...');
      await user.type(input, 'Test message{enter}');
      
      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('does not send empty messages', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();
      renderComponent({ onSendMessage });
      
      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);
      
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('disables input when disabled prop is true', () => {
      renderComponent({ disabled: true });
      
      const input = screen.getByPlaceholderText('Ask me anything about the video content...');
      expect(input).toBeDisabled();
    });
  });

  describe('Search Functionality', () => {
    it('shows search bar when search button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search messages/i });
      await user.click(searchButton);
      
      expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument();
    });

    it('calls onSearchMessages when searching', async () => {
      const user = userEvent.setup();
      const onSearchMessages = jest.fn().mockReturnValue([mockMessages[0]]);
      renderComponent({ onSearchMessages });
      
      const searchButton = screen.getByRole('button', { name: /search messages/i });
      await user.click(searchButton);
      
      const searchInput = screen.getByPlaceholderText('Search messages...');
      await user.type(searchInput, 'machine learning');
      
      expect(onSearchMessages).toHaveBeenCalledWith('machine learning');
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onSearchMessages = jest.fn().mockReturnValue([]);
      renderComponent({ onSearchMessages });
      
      const searchButton = screen.getByRole('button', { name: /search messages/i });
      await user.click(searchButton);
      
      const searchInput = screen.getByPlaceholderText('Search messages...');
      await user.type(searchInput, 'test');
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);
      
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Message Reactions', () => {
    it('handles thumbs up reaction', async () => {
      const user = userEvent.setup();
      const onMessageReaction = jest.fn();
      renderComponent({ onMessageReaction });
      
      const thumbsUpButton = screen.getAllByRole('button', { name: /helpful/i })[0];
      await user.click(thumbsUpButton);
      
      expect(onMessageReaction).toHaveBeenCalledWith('2', 'up');
    });

    it('handles thumbs down reaction', async () => {
      const user = userEvent.setup();
      const onMessageReaction = jest.fn();
      renderComponent({ onMessageReaction });
      
      const thumbsDownButton = screen.getAllByRole('button', { name: /not helpful/i })[0];
      await user.click(thumbsDownButton);
      
      expect(onMessageReaction).toHaveBeenCalledWith('2', 'down');
    });
  });

  describe('Menu Actions', () => {
    it('opens menu when more options button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const moreButton = screen.getByRole('button', { name: /more options/i });
      await user.click(moreButton);
      
      expect(screen.getByText('Export Chat')).toBeInTheDocument();
      expect(screen.getByText('Clear Chat')).toBeInTheDocument();
    });

    it('calls onClearChat when clear chat is clicked', async () => {
      const user = userEvent.setup();
      const onClearChat = jest.fn();
      renderComponent({ onClearChat });
      
      const moreButton = screen.getByRole('button', { name: /more options/i });
      await user.click(moreButton);
      
      const clearButton = screen.getByText('Clear Chat');
      await user.click(clearButton);
      
      expect(onClearChat).toHaveBeenCalled();
    });

    it('opens export dialog when export chat is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const moreButton = screen.getByRole('button', { name: /more options/i });
      await user.click(moreButton);
      
      const exportButton = screen.getByText('Export Chat');
      await user.click(exportButton);
      
      expect(screen.getByText('Export Chat')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state when sending message', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const onSendMessage = jest.fn(() => new Promise<void>(resolve => {
        resolvePromise = resolve;
      }));
      
      renderComponent({ onSendMessage });
      
      const input = screen.getByPlaceholderText('Ask me anything about the video content...');
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);
      
      // Should show loading spinner
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      // Resolve the promise
      resolvePromise!();
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search messages/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Tab to input field
      await user.keyboard('{Tab}');
      expect(screen.getByPlaceholderText('Ask me anything about the video content...')).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('handles send message errors gracefully', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn().mockRejectedValue(new Error('Network error'));
      renderComponent({ onSendMessage });
      
      const input = screen.getByPlaceholderText('Ask me anything about the video content...');
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);
      
      // Should not crash and should clear loading state
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('uses custom placeholder', () => {
      renderComponent({ placeholder: 'Custom placeholder text' });
      
      expect(screen.getByPlaceholderText('Custom placeholder text')).toBeInTheDocument();
    });

    it('hides controls when showHistory is false', () => {
      renderComponent({ showHistory: false });
      
      expect(screen.queryByRole('button', { name: /search messages/i })).not.toBeInTheDocument();
    });

    it('hides export when showExport is false', async () => {
      const user = userEvent.setup();
      renderComponent({ showExport: false });
      
      const moreButton = screen.getByRole('button', { name: /more options/i });
      await user.click(moreButton);
      
      expect(screen.queryByText('Export Chat')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = renderComponent({ className: 'custom-chat' });
      
      expect(container.querySelector('.custom-chat')).toBeInTheDocument();
    });
  });
});