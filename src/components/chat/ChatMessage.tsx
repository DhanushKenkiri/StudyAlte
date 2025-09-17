import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Person as UserIcon,
  SmartToy as BotIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from './ChatInterface';

interface ChatMessageProps {
  message: Message;
  onReaction?: (messageId: string, reaction: 'up' | 'down') => void;
  onCopy?: (content: string) => void;
  showReactions?: boolean;
  showTimestamp?: boolean;
  showSources?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onReaction,
  onCopy,
  showReactions = true,
  showTimestamp = true,
  showSources = true,
}) => {
  const theme = useTheme();
  const [showFullContent, setShowFullContent] = useState(false);
  
  const isUser = message.sender === 'user';
  const isLongMessage = message.content.length > 500;

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const handleReaction = (reaction: 'up' | 'down') => {
    onReaction?.(message.id, reaction);
  };

  const handleCopy = () => {
    onCopy?.(message.content);
  };

  const detectCodeBlocks = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const renderContent = () => {
    if (message.type === 'code') {
      return (
        <Box sx={{ mt: 1 }}>
          <SyntaxHighlighter
            language={message.metadata?.language || 'text'}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: theme.shape.borderRadius,
              fontSize: '0.875rem',
            }}
          >
            {message.content}
          </SyntaxHighlighter>
        </Box>
      );
    }

    const parts = detectCodeBlocks(message.content);
    const displayContent = isLongMessage && !showFullContent 
      ? message.content.substring(0, 500) + '...'
      : message.content;

    return (
      <Box>
        {parts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <Box key={index} sx={{ my: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <CodeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    {part.language}
                  </Typography>
                </Box>
                <SyntaxHighlighter
                  language={part.language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: theme.shape.borderRadius,
                    fontSize: '0.875rem',
                  }}
                >
                  {part.content}
                </SyntaxHighlighter>
              </Box>
            );
          }

          return (
            <Typography
              key={index}
              variant="body1"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {showFullContent ? part.content : 
                (isLongMessage && index === 0 ? displayContent : part.content)}
            </Typography>
          );
        })}

        {isLongMessage && (
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="body2"
              color="primary"
              sx={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setShowFullContent(!showFullContent)}
            >
              {showFullContent ? 'Show less' : 'Show more'}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 1,
        mb: 2,
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isUser ? theme.palette.primary.main : theme.palette.secondary.main,
        }}
      >
        {isUser ? <UserIcon fontSize="small" /> : <BotIcon fontSize="small" />}
      </Avatar>

      {/* Message Content */}
      <Box
        sx={{
          flex: 1,
          maxWidth: '80%',
        }}
      >
        {/* Message Bubble */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            backgroundColor: isUser
              ? theme.palette.primary.main
              : theme.palette.background.paper,
            color: isUser
              ? theme.palette.primary.contrastText
              : theme.palette.text.primary,
            borderRadius: 2,
            borderTopLeftRadius: isUser ? 2 : 0.5,
            borderTopRightRadius: isUser ? 0.5 : 2,
            position: 'relative',
          }}
        >
          {renderContent()}

          {/* Metadata */}
          {message.metadata && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {message.metadata.confidence && (
                <Chip
                  label={`Confidence: ${Math.round(message.metadata.confidence * 100)}%`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              )}
              {message.metadata.relatedConcepts?.map(concept => (
                <Chip
                  key={concept}
                  label={concept}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              ))}
            </Box>
          )}

          {/* Sources */}
          {showSources && message.metadata?.sources && message.metadata.sources.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Sources:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {message.metadata.sources.map((source, index) => (
                  <Chip
                    key={index}
                    label={source}
                    size="small"
                    clickable
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Message Actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            gap: 0.5,
            mt: 0.5,
            opacity: 0.7,
            '&:hover': { opacity: 1 },
          }}
        >
          {/* Timestamp */}
          {showTimestamp && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <TimeIcon sx={{ fontSize: 12 }} />
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(message.timestamp)}
              </Typography>
              {message.isEdited && (
                <Typography variant="caption" color="text.secondary">
                  (edited)
                </Typography>
              )}
            </Box>
          )}

          {/* Copy Button */}
          <Tooltip title="Copy message">
            <IconButton size="small" onClick={handleCopy}>
              <CopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>

          {/* Reactions (only for assistant messages) */}
          {showReactions && !isUser && (
            <>
              <Tooltip title="Helpful">
                <IconButton
                  size="small"
                  onClick={() => handleReaction('up')}
                  color={message.reactions?.userReaction === 'up' ? 'primary' : 'default'}
                >
                  <ThumbUpIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Not helpful">
                <IconButton
                  size="small"
                  onClick={() => handleReaction('down')}
                  color={message.reactions?.userReaction === 'down' ? 'error' : 'default'}
                >
                  <ThumbDownIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>

              {/* Reaction Counts */}
              {(message.reactions?.thumbsUp || 0) > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {message.reactions?.thumbsUp}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};