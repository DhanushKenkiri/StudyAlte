import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Chip,
  Paper,
  Popper,
  ClickAwayListener,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Star as ImportanceIcon,
  Psychology as ComplexityIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { MindMapNode, MindMapSearchResult, MindMapFilter } from './types';

interface MindMapSearchProps {
  nodes: MindMapNode[];
  onSearchResults: (results: MindMapSearchResult[]) => void;
  onNodeSelect: (node: MindMapNode) => void;
  placeholder?: string;
  maxResults?: number;
}

export const MindMapSearch: React.FC<MindMapSearchProps> = ({
  nodes,
  onSearchResults,
  onNodeSelect,
  placeholder = "Search nodes...",
  maxResults = 10,
}) => {
  const [query, setQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<MindMapFilter>({});

  // Search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const results: MindMapSearchResult[] = [];
    const queryLower = query.toLowerCase();

    nodes.forEach(node => {
      let score = 0;
      let matchType: MindMapSearchResult['matchType'] = 'label';
      let matchText = '';

      // Search in label (highest priority)
      if (node.label.toLowerCase().includes(queryLower)) {
        score += 10;
        matchType = 'label';
        matchText = node.label;
      }

      // Search in description
      if (node.content.description?.toLowerCase().includes(queryLower)) {
        score += 8;
        if (matchType === 'label' && score === 8) {
          matchType = 'description';
          matchText = node.content.description;
        }
      }

      // Search in tags
      const matchingTags = node.metadata.tags.filter(tag =>
        tag.toLowerCase().includes(queryLower)
      );
      if (matchingTags.length > 0) {
        score += 6 * matchingTags.length;
        if (matchType === 'label' && score <= 6) {
          matchType = 'tag';
          matchText = matchingTags.join(', ');
        }
      }

      // Search in key points
      const matchingKeyPoints = node.content.keyPoints?.filter(point =>
        point.toLowerCase().includes(queryLower)
      ) || [];
      if (matchingKeyPoints.length > 0) {
        score += 4 * matchingKeyPoints.length;
        if (matchType === 'label' && score <= 4) {
          matchType = 'content';
          matchText = matchingKeyPoints[0];
        }
      }

      // Search in examples
      const matchingExamples = node.content.examples?.filter(example =>
        example.toLowerCase().includes(queryLower)
      ) || [];
      if (matchingExamples.length > 0) {
        score += 3 * matchingExamples.length;
        if (matchType === 'label' && score <= 3) {
          matchType = 'content';
          matchText = matchingExamples[0];
        }
      }

      // Search in definition
      if (node.content.definition?.toLowerCase().includes(queryLower)) {
        score += 5;
        if (matchType === 'label' && score === 5) {
          matchType = 'content';
          matchText = node.content.definition;
        }
      }

      // Search in related concepts
      const matchingConcepts = node.content.relatedConcepts?.filter(concept =>
        concept.toLowerCase().includes(queryLower)
      ) || [];
      if (matchingConcepts.length > 0) {
        score += 2 * matchingConcepts.length;
        if (matchType === 'label' && score <= 2) {
          matchType = 'content';
          matchText = matchingConcepts[0];
        }
      }

      // Apply filters
      if (score > 0 && passesFilters(node, filters)) {
        results.push({
          node,
          score,
          matchType,
          matchText: matchText || node.label,
        });
      }
    });

    // Sort by score (descending) and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }, [query, nodes, filters, maxResults]);

  // Update search results when they change
  useEffect(() => {
    onSearchResults(searchResults);
  }, [searchResults, onSearchResults]);

  const passesFilters = (node: MindMapNode, filters: MindMapFilter): boolean => {
    // Node type filter
    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      if (!filters.nodeTypes.includes(node.type)) return false;
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(node.metadata.category)) return false;
    }

    // Importance range filter
    if (filters.importanceRange) {
      const [min, max] = filters.importanceRange;
      if (node.metadata.importance < min || node.metadata.importance > max) return false;
    }

    // Complexity range filter
    if (filters.complexityRange) {
      const [min, max] = filters.complexityRange;
      if (node.metadata.complexity < min || node.metadata.complexity > max) return false;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some(tag => node.metadata.tags.includes(tag))) return false;
    }

    // Level filter
    if (filters.levels && filters.levels.length > 0) {
      if (!filters.levels.includes(node.level)) return false;
    }

    return true;
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    setQuery(newQuery);
    setAnchorEl(event.currentTarget);
    setShowResults(newQuery.trim().length > 0);
  };

  const handleClearSearch = () => {
    setQuery('');
    setShowResults(false);
    onSearchResults([]);
  };

  const handleNodeSelect = (node: MindMapNode) => {
    onNodeSelect(node);
    setShowResults(false);
    setQuery(node.label);
  };

  const handleClickAway = () => {
    setShowResults(false);
  };

  const getMatchTypeIcon = (matchType: MindMapSearchResult['matchType']) => {
    switch (matchType) {
      case 'label':
        return '🏷️';
      case 'description':
        return '📝';
      case 'tag':
        return '🏷️';
      case 'content':
        return '📄';
      default:
        return '🔍';
    }
  };

  const getMatchTypeLabel = (matchType: MindMapSearchResult['matchType']) => {
    switch (matchType) {
      case 'label':
        return 'Label';
      case 'description':
        return 'Description';
      case 'tag':
        return 'Tag';
      case 'content':
        return 'Content';
      default:
        return 'Match';
    }
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'root':
        return '🌳';
      case 'main-topic':
        return '📚';
      case 'subtopic':
        return '📖';
      case 'concept':
        return '💡';
      case 'example':
        return '🔍';
      case 'definition':
        return '📝';
      default:
        return '⭕';
    }
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={query}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Popper
          open={showResults && searchResults.length > 0}
          anchorEl={anchorEl}
          placement="bottom-start"
          style={{ width: anchorEl?.clientWidth, zIndex: 1300 }}
        >
          <Paper
            elevation={8}
            sx={{
              maxHeight: 400,
              overflow: 'auto',
              mt: 1,
            }}
          >
            <List dense>
              {searchResults.map((result, index) => (
                <React.Fragment key={result.node.id}>
                  <ListItem
                    button
                    onClick={() => handleNodeSelect(result.node)}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="body2">
                        {getNodeTypeIcon(result.node.type)}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {result.node.label}
                          </Typography>
                          <Chip
                            label={result.node.type}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {getMatchTypeIcon(result.matchType)} {getMatchTypeLabel(result.matchType)}:
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 200,
                            }}
                          >
                            {result.matchText}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                            <Tooltip title="Importance">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <ImportanceIcon sx={{ fontSize: 12 }} />
                                <Typography variant="caption">
                                  {result.node.metadata.importance}
                                </Typography>
                              </Box>
                            </Tooltip>
                            <Tooltip title="Complexity">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <ComplexityIcon sx={{ fontSize: 12 }} />
                                <Typography variant="caption">
                                  {result.node.metadata.complexity}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < searchResults.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>

            {query.trim() && searchResults.length === 0 && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No nodes found matching "{query}"
                </Typography>
              </Box>
            )}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};