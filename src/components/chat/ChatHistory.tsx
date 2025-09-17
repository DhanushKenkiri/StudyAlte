import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Chat as ChatIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import { ChatSession } from './ChatInterface';

interface ChatHistoryProps {
  sessions: ChatSession[];
  currentSessionId?: string;
  onSessionSelect: (session: ChatSession) => void;
  onSessionDelete?: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  onSessionStar?: (sessionId: string, starred: boolean) => void;
  showSearch?: boolean;
  showFilters?: boolean;
  maxHeight?: number;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onSessionStar,
  showSearch = true,
  showFilters = true,
  maxHeight = 400,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'starred' | 'today' | 'week'>('all');

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const getSessionPreview = (session: ChatSession) => {
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage) return 'No messages';
    
    const preview = lastMessage.content.substring(0, 50);
    return preview.length < lastMessage.content.length ? `${preview}...` : preview;
  };

  const filteredSessions = sessions.filter(session => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = session.title.toLowerCase().includes(query);
      const matchesContent = session.messages.some(msg => 
        msg.content.toLowerCase().includes(query)
      );
      const matchesContext = session.context?.videoTitle?.toLowerCase().includes(query);
      
      if (!matchesTitle && !matchesContent && !matchesContext) {
        return false;
      }
    }

    // Date filter
    const now = new Date();
    const sessionDate = new Date(session.updatedAt);
    
    switch (filterBy) {
      case 'today':
        return sessionDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return sessionDate >= weekAgo;
      case 'starred':
        // Assuming starred sessions have a starred property
        return (session as any).starred === true;
      default:
        return true;
    }
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, session: ChatSession) => {
    event.stopPropagation();
    setSelectedSession(session);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedSession(null);
  };

  const handleRename = () => {
    if (selectedSession) {
      setNewTitle(selectedSession.title);
      setShowRenameDialog(true);
    }
    handleMenuClose();
  };

  const handleRenameConfirm = () => {
    if (selectedSession && newTitle.trim()) {
      onSessionRename?.(selectedSession.id, newTitle.trim());
    }
    setShowRenameDialog(false);
    setNewTitle('');
  };

  const handleDelete = () => {
    if (selectedSession) {
      onSessionDelete?.(selectedSession.id);
    }
    handleMenuClose();
  };

  const handleStar = () => {
    if (selectedSession) {
      const isStarred = (selectedSession as any).starred || false;
      onSessionStar?.(selectedSession.id, !isStarred);
    }
    handleMenuClose();
  };

  return (
    <Box sx={{ height: maxHeight, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" gutterBottom>
          Chat History
        </Typography>

        {/* Search */}
        {showSearch && (
          <TextField
            fullWidth
            size="small"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ mb: 1 }}
          />
        )}

        {/* Filters */}
        {showFilters && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label="All"
              size="small"
              clickable
              color={filterBy === 'all' ? 'primary' : 'default'}
              onClick={() => setFilterBy('all')}
            />
            <Chip
              label="Today"
              size="small"
              clickable
              color={filterBy === 'today' ? 'primary' : 'default'}
              onClick={() => setFilterBy('today')}
              icon={<TodayIcon />}
            />
            <Chip
              label="This Week"
              size="small"
              clickable
              color={filterBy === 'week' ? 'primary' : 'default'}
              onClick={() => setFilterBy('week')}
              icon={<DateRangeIcon />}
            />
            <Chip
              label="Starred"
              size="small"
              clickable
              color={filterBy === 'starred' ? 'primary' : 'default'}
              onClick={() => setFilterBy('starred')}
              icon={<StarIcon />}
            />
          </Box>
        )}
      </Box>

      {/* Sessions List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredSessions.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1" gutterBottom>
              {searchQuery ? 'No conversations found' : 'No chat history'}
            </Typography>
            <Typography variant="body2">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Start a conversation to see it here'
              }
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredSessions.map((session) => (
              <ListItem
                key={session.id}
                disablePadding
                sx={{
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                }}
              >
                <ListItemButton
                  selected={session.id === currentSessionId}
                  onClick={() => onSessionSelect(session)}
                  sx={{
                    py: 1.5,
                    '&.Mui-selected': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      borderRight: `3px solid ${theme.palette.primary.main}`,
                    },
                  }}
                >
                  <ListItemIcon>
                    <ChatIcon />
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {session.title}
                        </Typography>
                        {(session as any).starred && (
                          <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5,
                          }}
                        >
                          {getSessionPreview(session)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(new Date(session.updatedAt))}
                          </Typography>
                          {session.context?.videoTitle && (
                            <Chip
                              label={session.context.videoTitle}
                              size="small"
                              variant="outlined"
                              sx={{ 
                                fontSize: '0.6rem', 
                                height: 16,
                                maxWidth: 100,
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                },
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />

                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, session)}
                    sx={{ ml: 1 }}
                  >
                    <MoreIcon />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRename}>
          <EditIcon sx={{ mr: 1 }} />
          Rename
        </MenuItem>
        <MenuItem onClick={handleStar}>
          {(selectedSession as any)?.starred ? (
            <>
              <StarBorderIcon sx={{ mr: 1 }} />
              Unstar
            </>
          ) : (
            <>
              <StarIcon sx={{ mr: 1 }} />
              Star
            </>
          )}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onClose={() => setShowRenameDialog(false)}>
        <DialogTitle>Rename Conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Conversation Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRenameDialog(false)}>Cancel</Button>
          <Button onClick={handleRenameConfirm} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};