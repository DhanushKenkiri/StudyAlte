import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Rating,
  LinearProgress,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Star as ImportanceIcon,
  Psychology as ComplexityIcon,
  Category as CategoryIcon,
  Label as TagIcon,
  Link as ConnectionIcon,
  Description as DescriptionIcon,
  Lightbulb as ExampleIcon,
  MenuBook as DefinitionIcon,
  KeyboardArrowRight as ArrowIcon,
} from '@mui/icons-material';
import { MindMapNode, MindMap } from './types';

interface MindMapNodeDetailsProps {
  node: MindMapNode | null;
  open: boolean;
  onClose: () => void;
  mindMap: MindMap;
  onNavigateToNode?: (nodeId: string) => void;
}

export const MindMapNodeDetails: React.FC<MindMapNodeDetailsProps> = ({
  node,
  open,
  onClose,
  mindMap,
  onNavigateToNode,
}) => {
  const theme = useTheme();

  if (!node) return null;

  const getRelatedNodes = () => {
    const connections = mindMap.connections.filter(
      conn => conn.sourceId === node.id || conn.targetId === node.id
    );

    return connections.map(conn => {
      const relatedNodeId = conn.sourceId === node.id ? conn.targetId : conn.sourceId;
      const relatedNode = mindMap.nodes.find(n => n.id === relatedNodeId);
      return {
        node: relatedNode,
        connection: conn,
        relationship: conn.sourceId === node.id ? 'outgoing' : 'incoming',
      };
    }).filter(item => item.node);
  };

  const getChildNodes = () => {
    return mindMap.nodes.filter(n => n.parentId === node.id);
  };

  const getParentNode = () => {
    return node.parentId ? mindMap.nodes.find(n => n.id === node.parentId) : null;
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

  const getConnectionTypeLabel = (type: string) => {
    switch (type) {
      case 'parent-child':
        return 'Hierarchical';
      case 'related':
        return 'Related';
      case 'example':
        return 'Example';
      case 'prerequisite':
        return 'Prerequisite';
      case 'application':
        return 'Application';
      default:
        return type;
    }
  };

  const relatedNodes = getRelatedNodes();
  const childNodes = getChildNodes();
  const parentNode = getParentNode();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '80vh' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="span">
            {getNodeTypeIcon(node.type)} {node.label}
          </Typography>
          <Chip
            label={node.type}
            size="small"
            variant="outlined"
            sx={{ textTransform: 'capitalize' }}
          />
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Basic Information */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Information
              </Typography>
              
              {node.content.description && (
                <Typography variant="body1" paragraph>
                  {node.content.description}
                </Typography>
              )}

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Importance
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Rating
                      value={node.metadata.importance / 2}
                      max={5}
                      readOnly
                      size="small"
                    />
                    <Typography variant="body2">
                      {node.metadata.importance}/10
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Complexity
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={node.metadata.complexity * 10}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                      color={
                        node.metadata.complexity <= 3 ? 'success' :
                        node.metadata.complexity <= 7 ? 'warning' : 'error'
                      }
                    />
                    <Typography variant="body2">
                      {node.metadata.complexity}/10
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CategoryIcon fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Category:
                </Typography>
                <Chip label={node.metadata.category} size="small" />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <TagIcon fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Tags:
                </Typography>
                {node.metadata.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Definition */}
          {node.content.definition && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <DefinitionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Definition
                </Typography>
                <Typography variant="body1">
                  {node.content.definition}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Key Points */}
          {node.content.keyPoints && node.content.keyPoints.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Key Points
                </Typography>
                <List dense>
                  {node.content.keyPoints.map((point, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ArrowIcon />
                      </ListItemIcon>
                      <ListItemText primary={point} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Examples */}
          {node.content.examples && node.content.examples.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <ExampleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Examples
                </Typography>
                <List dense>
                  {node.content.examples.map((example, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ArrowIcon />
                      </ListItemIcon>
                      <ListItemText primary={example} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Related Concepts */}
          {node.content.relatedConcepts && node.content.relatedConcepts.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Related Concepts
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {node.content.relatedConcepts.map(concept => (
                    <Chip
                      key={concept}
                      label={concept}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Hierarchy */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hierarchy
              </Typography>
              
              {/* Parent */}
              {parentNode && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Parent:
                  </Typography>
                  <Chip
                    label={parentNode.label}
                    onClick={() => onNavigateToNode?.(parentNode.id)}
                    clickable
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              )}

              {/* Current Level */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Level: {node.level}
                </Typography>
              </Box>

              {/* Children */}
              {childNodes.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Children ({childNodes.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {childNodes.map(child => (
                      <Chip
                        key={child.id}
                        label={child.label}
                        onClick={() => onNavigateToNode?.(child.id)}
                        clickable
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Connections */}
          {relatedNodes.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <ConnectionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Connections ({relatedNodes.length})
                </Typography>
                <List dense>
                  {relatedNodes.map(({ node: relatedNode, connection, relationship }, index) => (
                    <ListItem
                      key={index}
                      button
                      onClick={() => onNavigateToNode?.(relatedNode!.id)}
                    >
                      <ListItemIcon>
                        <Typography variant="body2">
                          {getNodeTypeIcon(relatedNode!.type)}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText
                        primary={relatedNode!.label}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={getConnectionTypeLabel(connection.type)}
                              size="small"
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {relationship === 'outgoing' ? '→' : '←'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Strength: {Math.round(connection.strength * 100)}%
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {onNavigateToNode && (
          <Button
            variant="contained"
            onClick={() => {
              onNavigateToNode(node.id);
              onClose();
            }}
          >
            Focus on Node
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};