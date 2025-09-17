import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  IconButton,
  Typography,
  Avatar,
  List,
  ListItem,
  Divider,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  Download as ExportIcon,
  Clear as ClearIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Code as CodeIcon,
  ContentCopy as CopyIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from './ChatMessage';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { ChatMessageInput } from './ChatMessageInput';
import { ChatHistory } from './ChatHistory';
import { ChatExport } from './ChatExport';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  type: 'text' | 'code' | 'image' | 'file';
  metadata?: {
    language?: string;
    fileName?: string;
    fileSize?: number;
    confidence?: number;
    sources?: string[];
    relatedConcepts?: string[];
  };
  reactions?: {
    thumbsUp: number;
    thumbsDown: number;
    userReaction?: 'up' | 'down' | null;
  };
  isEdited?: boolean;
  editedAt?: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  context?: {
    videoId?: string;
    videoTitle?: string;
    capsuleId?: string;
    topic?: string;
  };
}

interface ChatInterfaceProps {
  session?: ChatSession;
  onSendMessage: (content: string, type?: Message['type']) => Promise<void>;
  onMessageReaction?: (messageId: string, reaction: 'up' | 'down') => void;
  onExportChat?: () => void;
  onClearChat?: () => void;
  onSearchMessages?: (query: string) => Message[];
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showHistory?: boolean;
  showExport?: boolean;
  maxHeight?: number;
  className?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  session,
  onSendMessage,
  onMessageReaction,
  onExportChat,
  onClearChat,
  onSearchMessages,
  isTyping = false,
  disabled = false,
  placeholder = "Ask me anything about the video content...",
  showHistory = true,
  showExport = true,
  maxHeight = 600,
  className,
}) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [messages, setMessages] = useState<Message[]>(session?.messages || []);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Update messages when session changes
  useEffect(() => {
    if (session?.messages) {
      setMessages(session.messages);
    }
  }, [session?.messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Handle search
  useEffect(() => {
    if (searchQuery.trim() && onSearchMessages) {
      const results = onSearchMessages(searchQuery);
      setFilteredMessages(results);
    } else {
      setFilteredMessages([]);
    }
  }, [searchQuery, onSearchMessages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || disabled || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      await onSendMessage(messageContent);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Could show error toast here
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleMessageReaction = (messageId: string, reaction: 'up' | 'down') => {
    onMessageReaction?.(messageId, reaction);
    
    // Update local state optimistically
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const currentReaction = msg.reactions?.userReaction;
        const newReaction = currentReaction === reaction ? null : reaction;
        
        return {
          ...msg,
          reactions: {
            thumbsUp: msg.reactions?.thumbsUp || 0,
            thumbsDown: msg.reactions?.thumbsDown || 0,
            userReaction: newReaction,
          },
        };
      }
      return msg;
    }));
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    // Could show success toast here
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
      setFilteredMessages([]);
    }
  };

  const handleExportToggle = () => {
    setShowExportDialog(!showExportDialog);
  };

  const handleClearChat = () => {
    onClearChat?.();
    setMessages([]);
    handleMenuClose();
  };

  const displayMessages = filteredMessages.length > 0 ? filteredMessages : messages;

  return (
    <Card className={className} sx={{ height: maxHeight, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
            <BotIcon />
          </Avatar>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">AI Tutor</Typography>
            {session?.context?.videoTitle && (
              <Chip
                label={session.context.videoTitle}
                size="small"
                variant="outlined"
                sx={{ maxWidth: 200 }}
              />
            )}
          </Box>
        }
        subheader={
          isTyping ? (
            <Typography variant="body2" color="primary">
              AI is typing...
            </Typography>
          ) : (
            `${messages.length} messages`
          )
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {showHistory && (
              <Tooltip title="Search messages">
                <IconButton onClick={handleSearchToggle}>
                  <SearchIcon />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="More options">
              <IconButton onClick={handleMenuOpen}>
                <MoreIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
        sx={{ pb: 1 }}
      />

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={{ px: 2, pb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: searchQuery && (
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon />
                    </IconButton>
                  ),
                }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Container */}
      <CardContent
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 1,
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            background: alpha(theme.palette.grey[300], 0.3),
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.grey[500], 0.5),
            borderRadius: 3,
          },
        }}
      >
        {displayMessages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <BotIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" gutterBottom>
              Start a conversation
            </Typography>
            <Typography variant="body2">
              Ask me anything about the video content, concepts, or learning materials.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            <AnimatePresence>
              {displayMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <ChatMessage
                    message={message}
                    onReaction={handleMessageReaction}
                    onCopy={handleCopyMessage}
                    showReactions={true}
                    showTimestamp={true}
                  />
                  {index < displayMessages.length - 1 && (
                    <Divider sx={{ my: 1, opacity: 0.3 }} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ChatTypingIndicator />
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </List>
        )}
      </CardContent>

      {/* Message Input */}
      <Box sx={{ p: 2, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
        <ChatMessageInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          onKeyPress={handleKeyPress}
          disabled={disabled || isLoading}
          placeholder={placeholder}
          showAttachment={false}
          isLoading={isLoading}
        />
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {showExport && (
          <MenuItem onClick={handleExportToggle}>
            <ExportIcon sx={{ mr: 1 }} />
            Export Chat
          </MenuItem>
        )}
        <MenuItem onClick={handleClearChat}>
          <ClearIcon sx={{ mr: 1 }} />
          Clear Chat
        </MenuItem>
      </Menu>

      {/* Export Dialog */}
      {showExportDialog && (
        <ChatExport
          session={session}
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          onExport={onExportChat}
        />
      )}
    </Card>
  );
};