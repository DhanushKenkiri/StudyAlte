import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Slider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import * as d3 from 'd3';
import { MindMapNode, MindMapConnection, MindMap } from './types';
import { MindMapControls } from './MindMapControls';
import { MindMapNodeDetails } from './MindMapNodeDetails';
import { MindMapSearch } from './MindMapSearch';

interface MindMapVisualizationProps {
  mindMap: MindMap;
  width?: number;
  height?: number;
  interactive?: boolean;
  showControls?: boolean;
  onNodeClick?: (node: MindMapNode) => void;
  onNodeHover?: (node: MindMapNode | null) => void;
  onConnectionClick?: (connection: MindMapConnection) => void;
  className?: string;
}

export const MindMapVisualization: React.FC<MindMapVisualizationProps> = ({
  mindMap,
  width = 800,
  height = 600,
  interactive = true,
  showControls = true,
  onNodeClick,
  onNodeHover,
  onConnectionClick,
  className,
}) => {
  const theme = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MindMapNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNodes, setFilteredNodes] = useState<Set<string>>(new Set());
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [layoutType, setLayoutType] = useState<'hierarchical' | 'radial' | 'network'>(
    mindMap.layout.type as any
  );
  const [colorScheme, setColorScheme] = useState<'default' | 'categorical' | 'importance' | 'difficulty'>('categorical');
  const [showLabels, setShowLabels] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [nodeSize, setNodeSize] = useState(1);
  const [animationSpeed, setAnimationSpeed] = useState(500);

  // D3 references
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const simulation = useRef<d3.Simulation<MindMapNode, MindMapConnection>>();

  // Initialize D3 visualization
  useEffect(() => {
    if (!svgRef.current || !mindMap.nodes.length) return;

    initializeVisualization();
    
    return () => {
      if (simulation.current) {
        simulation.current.stop();
      }
    };
  }, [mindMap, layoutType, colorScheme]);

  // Update visualization when settings change
  useEffect(() => {
    updateVisualization();
  }, [showLabels, showConnections, nodeSize, filteredNodes]);

  const initializeVisualization = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g').attr('class', 'main-group');

    // Setup zoom behavior
    zoomBehavior.current = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        const { transform } = event;
        g.attr('transform', transform);
        setZoom(transform.k);
        setPan({ x: transform.x, y: transform.y });
      });

    if (interactive) {
      svg.call(zoomBehavior.current);
    }

    // Create layout based on type
    const nodes = [...mindMap.nodes];
    const connections = [...mindMap.connections];

    switch (layoutType) {
      case 'hierarchical':
        createHierarchicalLayout(g, nodes, connections);
        break;
      case 'radial':
        createRadialLayout(g, nodes, connections);
        break;
      case 'network':
        createNetworkLayout(g, nodes, connections);
        break;
      default:
        createHierarchicalLayout(g, nodes, connections);
    }
  }, [mindMap, layoutType, interactive]);

  const createHierarchicalLayout = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: MindMapNode[],
    connections: MindMapConnection[]
  ) => {
    // Create hierarchical tree layout
    const root = d3.hierarchy(
      buildHierarchy(nodes),
      (d: any) => d.children
    );

    const treeLayout = d3.tree<any>()
      .size([width - 100, height - 100])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    treeLayout(root);

    // Draw connections first (so they appear behind nodes)
    if (showConnections) {
      drawConnections(g, root.links(), connections);
    }

    // Draw nodes
    drawNodes(g, root.descendants(), nodes);
  };

  const createRadialLayout = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: MindMapNode[],
    connections: MindMapConnection[]
  ) => {
    const root = d3.hierarchy(buildHierarchy(nodes));
    
    const radialLayout = d3.tree<any>()
      .size([2 * Math.PI, Math.min(width, height) / 2 - 50])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    radialLayout(root);

    // Convert to radial coordinates
    root.each((d: any) => {
      d.x = d.x;
      d.y = d.y;
      const angle = d.x;
      const radius = d.y;
      d.x = radius * Math.cos(angle - Math.PI / 2);
      d.y = radius * Math.sin(angle - Math.PI / 2);
    });

    // Center the layout
    g.attr('transform', `translate(${width / 2}, ${height / 2})`);

    if (showConnections) {
      drawRadialConnections(g, root.links(), connections);
    }

    drawNodes(g, root.descendants(), nodes);
  };

  const createNetworkLayout = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: MindMapNode[],
    connections: MindMapConnection[]
  ) => {
    // Create force simulation
    simulation.current = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(connections as any)
        .id((d: any) => d.id)
        .distance(100)
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    if (showConnections) {
      drawForceConnections(g, connections);
    }

    drawForceNodes(g, nodes);

    simulation.current.on('tick', () => {
      updateForceLayout();
    });
  };

  const buildHierarchy = (nodes: MindMapNode[]) => {
    const nodeMap = new Map(nodes.map(node => [node.id, { ...node, children: [] }]));
    let root: any = null;

    nodes.forEach(node => {
      const nodeData = nodeMap.get(node.id);
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId);
        parent.children.push(nodeData);
      } else {
        root = nodeData;
      }
    });

    return root || nodeMap.values().next().value;
  };

  const drawNodes = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    hierarchyNodes: any[],
    originalNodes: MindMapNode[]
  ) => {
    const nodeGroup = g.selectAll('.node-group')
      .data(hierarchyNodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

    // Draw node shapes
    nodeGroup.each(function(d: any) {
      const node = d.data;
      const selection = d3.select(this);
      
      if (filteredNodes.size > 0 && !filteredNodes.has(node.id)) {
        selection.style('opacity', 0.3);
      }

      drawNodeShape(selection, node);
      
      if (showLabels) {
        drawNodeLabel(selection, node);
      }
    });

    // Add interactivity
    if (interactive) {
      nodeGroup
        .style('cursor', 'pointer')
        .on('click', (event, d: any) => {
          event.stopPropagation();
          handleNodeClick(d.data);
        })
        .on('mouseenter', (event, d: any) => {
          handleNodeHover(d.data);
        })
        .on('mouseleave', () => {
          handleNodeHover(null);
        });
    }
  };

  const drawNodeShape = (
    selection: d3.Selection<SVGGElement, any, null, undefined>,
    node: MindMapNode
  ) => {
    const size = node.size.width * nodeSize;
    const color = getNodeColor(node);
    
    switch (node.style.shape) {
      case 'ellipse':
        selection.append('ellipse')
          .attr('rx', size / 2)
          .attr('ry', size / 3)
          .attr('fill', color.background)
          .attr('stroke', color.border)
          .attr('stroke-width', 2);
        break;
      case 'diamond':
        selection.append('polygon')
          .attr('points', `0,-${size/2} ${size/2},0 0,${size/2} -${size/2},0`)
          .attr('fill', color.background)
          .attr('stroke', color.border)
          .attr('stroke-width', 2);
        break;
      case 'hexagon':
        const hexPoints = Array.from({ length: 6 }, (_, i) => {
          const angle = (i * Math.PI) / 3;
          const x = (size / 2) * Math.cos(angle);
          const y = (size / 2) * Math.sin(angle);
          return `${x},${y}`;
        }).join(' ');
        selection.append('polygon')
          .attr('points', hexPoints)
          .attr('fill', color.background)
          .attr('stroke', color.border)
          .attr('stroke-width', 2);
        break;
      default: // rectangle
        selection.append('rect')
          .attr('x', -size / 2)
          .attr('y', -size / 3)
          .attr('width', size)
          .attr('height', size * 2 / 3)
          .attr('rx', 5)
          .attr('fill', color.background)
          .attr('stroke', color.border)
          .attr('stroke-width', 2);
    }
  };

  const drawNodeLabel = (
    selection: d3.Selection<SVGGElement, any, null, undefined>,
    node: MindMapNode
  ) => {
    const color = getNodeColor(node);
    
    selection.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', color.text)
      .attr('font-size', `${node.style.fontSize * nodeSize}px`)
      .attr('font-weight', node.style.fontWeight)
      .style('pointer-events', 'none')
      .text(node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label);
  };

  const drawConnections = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    links: any[],
    connections: MindMapConnection[]
  ) => {
    const connectionGroup = g.selectAll('.connection')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'connection');

    connectionGroup.append('path')
      .attr('d', (d: any) => {
        const source = d.source;
        const target = d.target;
        return `M${source.x},${source.y}L${target.x},${target.y}`;
      })
      .attr('stroke', theme.palette.grey[400])
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrowhead marker
    g.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', theme.palette.grey[400]);
  };

  const drawRadialConnections = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    links: any[],
    connections: MindMapConnection[]
  ) => {
    const connectionGroup = g.selectAll('.connection')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'connection');

    connectionGroup.append('path')
      .attr('d', (d: any) => {
        const source = d.source;
        const target = d.target;
        return `M${source.x},${source.y}Q${(source.x + target.x) / 2},${(source.y + target.y) / 2} ${target.x},${target.y}`;
      })
      .attr('stroke', theme.palette.grey[400])
      .attr('stroke-width', 2)
      .attr('fill', 'none');
  };

  const drawForceConnections = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    connections: MindMapConnection[]
  ) => {
    const connectionGroup = g.selectAll('.connection')
      .data(connections)
      .enter()
      .append('line')
      .attr('class', 'connection')
      .attr('stroke', theme.palette.grey[400])
      .attr('stroke-width', 2);
  };

  const drawForceNodes = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: MindMapNode[]
  ) => {
    const nodeGroup = g.selectAll('.node-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group');

    nodeGroup.each(function(node: MindMapNode) {
      const selection = d3.select(this);
      drawNodeShape(selection, node);
      
      if (showLabels) {
        drawNodeLabel(selection, node);
      }
    });

    if (interactive) {
      nodeGroup.call(d3.drag<SVGGElement, MindMapNode>()
        .on('start', (event, d) => {
          if (!event.active && simulation.current) {
            simulation.current.alphaTarget(0.3).restart();
          }
          d.fx = d.position.x;
          d.fy = d.position.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active && simulation.current) {
            simulation.current.alphaTarget(0);
          }
          d.fx = null;
          d.fy = null;
        })
      );
    }
  };

  const updateForceLayout = () => {
    const svg = d3.select(svgRef.current);
    
    svg.selectAll('.connection')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    svg.selectAll('.node-group')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
  };

  const getNodeColor = (node: MindMapNode) => {
    const colors = {
      background: node.style.backgroundColor,
      border: node.style.borderColor,
      text: node.style.textColor,
    };

    // Apply color scheme
    switch (colorScheme) {
      case 'importance':
        const importanceColor = d3.scaleSequential(d3.interpolateReds)
          .domain([1, 10])(node.metadata.importance);
        colors.background = importanceColor;
        break;
      case 'difficulty':
        const difficultyColors = {
          1: theme.palette.success.light,
          5: theme.palette.warning.light,
          10: theme.palette.error.light,
        };
        colors.background = d3.scaleSequential(d3.interpolateRdYlGn)
          .domain([10, 1])(node.metadata.complexity);
        break;
      case 'categorical':
        const categoryColors = d3.scaleOrdinal(d3.schemeCategory10);
        colors.background = categoryColors(node.metadata.category);
        break;
    }

    return colors;
  };

  const handleNodeClick = (node: MindMapNode) => {
    setSelectedNode(node);
    setShowNodeDetails(true);
    onNodeClick?.(node);
  };

  const handleNodeHover = (node: MindMapNode | null) => {
    setHoveredNode(node);
    onNodeHover?.(node);
  };

  const handleZoomIn = () => {
    if (zoomBehavior.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (zoomBehavior.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, 0.67);
    }
  };

  const handleCenter = () => {
    if (zoomBehavior.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomBehavior.current.transform, d3.zoomIdentity);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredNodes(new Set());
      return;
    }

    const matchingNodes = mindMap.nodes.filter(node =>
      node.label.toLowerCase().includes(query.toLowerCase()) ||
      node.content.description?.toLowerCase().includes(query.toLowerCase()) ||
      node.metadata.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );

    setFilteredNodes(new Set(matchingNodes.map(node => node.id)));
  };

  const updateVisualization = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      
      // Update node visibility
      svg.selectAll('.node-group')
        .style('opacity', (d: any) => {
          if (filteredNodes.size === 0) return 1;
          return filteredNodes.has(d.data?.id || d.id) ? 1 : 0.3;
        });

      // Update connection visibility
      svg.selectAll('.connection')
        .style('opacity', showConnections ? 1 : 0);

      // Update label visibility
      svg.selectAll('text')
        .style('opacity', showLabels ? 1 : 0);
    }
  };

  const exportMindMap = (format: 'svg' | 'png' | 'json') => {
    if (!svgRef.current) return;

    switch (format) {
      case 'svg':
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const svgLink = document.createElement('a');
        svgLink.href = svgUrl;
        svgLink.download = `${mindMap.title}-mindmap.svg`;
        svgLink.click();
        URL.revokeObjectURL(svgUrl);
        break;
      
      case 'json':
        const jsonData = JSON.stringify(mindMap, null, 2);
        const jsonBlob = new Blob([jsonData], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = `${mindMap.title}-mindmap.json`;
        jsonLink.click();
        URL.revokeObjectURL(jsonUrl);
        break;
    }
  };

  return (
    <Box className={className} sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {showControls && (
          <MindMapControls
            zoom={zoom}
            layoutType={layoutType}
            colorScheme={colorScheme}
            showLabels={showLabels}
            showConnections={showConnections}
            nodeSize={nodeSize}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onCenter={handleCenter}
            onLayoutChange={setLayoutType}
            onColorSchemeChange={setColorScheme}
            onShowLabelsChange={setShowLabels}
            onShowConnectionsChange={setShowConnections}
            onNodeSizeChange={setNodeSize}
            onExport={exportMindMap}
            onSearch={handleSearch}
          />
        )}

        <CardContent sx={{ flex: 1, p: 0, position: 'relative' }}>
          <Box
            ref={containerRef}
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <svg
              ref={svgRef}
              width={width}
              height={height}
              style={{
                width: '100%',
                height: '100%',
                cursor: interactive ? 'grab' : 'default',
              }}
            />

            {/* Hover tooltip */}
            {hoveredNode && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  p: 1,
                  maxWidth: 300,
                  zIndex: 1000,
                  pointerEvents: 'none',
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  {hoveredNode.label}
                </Typography>
                {hoveredNode.content.description && (
                  <Typography variant="body2" color="text.secondary">
                    {hoveredNode.content.description}
                  </Typography>
                )}
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {hoveredNode.metadata.tags.slice(0, 3).map(tag => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Node Details Dialog */}
      <MindMapNodeDetails
        node={selectedNode}
        open={showNodeDetails}
        onClose={() => setShowNodeDetails(false)}
        mindMap={mindMap}
      />
    </Box>
  );
};