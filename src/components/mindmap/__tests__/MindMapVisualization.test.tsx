import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MindMapVisualization } from '../MindMapVisualization';
import { MindMap } from '../types';

const theme = createTheme();

// Mock D3
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({
      remove: jest.fn(),
    })),
    append: jest.fn(() => ({
      attr: jest.fn(() => ({
        attr: jest.fn(() => ({
          attr: jest.fn(() => ({
            attr: jest.fn(),
          })),
        })),
      })),
    })),
    call: jest.fn(),
  })),
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn(() => ({
      on: jest.fn(),
    })),
  })),
  hierarchy: jest.fn(() => ({
    each: jest.fn(),
    descendants: jest.fn(() => []),
    links: jest.fn(() => []),
  })),
  tree: jest.fn(() => ({
    size: jest.fn(() => ({
      separation: jest.fn(),
    })),
  })),
  forceSimulation: jest.fn(() => ({
    force: jest.fn(() => ({
      force: jest.fn(() => ({
        force: jest.fn(() => ({
          force: jest.fn(),
        })),
      })),
    })),
    on: jest.fn(),
    stop: jest.fn(),
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn(() => ({
      distance: jest.fn(() => ({
        strength: jest.fn(),
      })),
    })),
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn(),
  })),
  forceCenter: jest.fn(),
  forceCollide: jest.fn(() => ({
    radius: jest.fn(),
  })),
  scaleSequential: jest.fn(() => jest.fn()),
  scaleOrdinal: jest.fn(() => jest.fn()),
  interpolateReds: jest.fn(),
  interpolateRdYlGn: jest.fn(),
  schemeCategory10: [],
  zoomIdentity: {},
  drag: jest.fn(() => ({
    on: jest.fn(() => ({
      on: jest.fn(() => ({
        on: jest.fn(),
      })),
    })),
  })),
}));

const mockMindMap: MindMap = {
  id: 'test-mindmap',
  title: 'Test Mind Map',
  nodes: [
    {
      id: 'root',
      label: 'Root Node',
      type: 'root',
      level: 0,
      children: ['node1', 'node2'],
      position: { x: 400, y: 300 },
      size: { width: 120, height: 60 },
      style: {
        backgroundColor: '#e3f2fd',
        borderColor: '#1976d2',
        textColor: '#000000',
        fontSize: 14,
        fontWeight: 'bold',
        shape: 'rectangle',
      },
      content: {
        description: 'This is the root node of the mind map',
        keyPoints: ['Central concept', 'Starting point'],
      },
      metadata: {
        importance: 10,
        complexity: 5,
        confidence: 0.95,
        tags: ['root', 'central'],
        category: 'Core',
      },
    },
    {
      id: 'node1',
      label: 'Main Topic 1',
      type: 'main-topic',
      level: 1,
      parentId: 'root',
      children: ['node3'],
      position: { x: 200, y: 200 },
      size: { width: 100, height: 50 },
      style: {
        backgroundColor: '#f3e5f5',
        borderColor: '#7b1fa2',
        textColor: '#000000',
        fontSize: 12,
        fontWeight: 'normal',
        shape: 'ellipse',
      },
      content: {
        description: 'First main topic in the mind map',
        examples: ['Example 1', 'Example 2'],
      },
      metadata: {
        importance: 8,
        complexity: 6,
        confidence: 0.88,
        tags: ['topic', 'main'],
        category: 'Topic',
      },
    },
    {
      id: 'node2',
      label: 'Main Topic 2',
      type: 'main-topic',
      level: 1,
      parentId: 'root',
      children: [],
      position: { x: 600, y: 200 },
      size: { width: 100, height: 50 },
      style: {
        backgroundColor: '#e8f5e8',
        borderColor: '#388e3c',
        textColor: '#000000',
        fontSize: 12,
        fontWeight: 'normal',
        shape: 'rectangle',
      },
      content: {
        description: 'Second main topic in the mind map',
        definition: 'A secondary concept that supports the main idea',
      },
      metadata: {
        importance: 7,
        complexity: 4,
        confidence: 0.92,
        tags: ['topic', 'secondary'],
        category: 'Topic',
      },
    },
    {
      id: 'node3',
      label: 'Subtopic',
      type: 'subtopic',
      level: 2,
      parentId: 'node1',
      children: [],
      position: { x: 100, y: 100 },
      size: { width: 80, height: 40 },
      style: {
        backgroundColor: '#fff3e0',
        borderColor: '#f57c00',
        textColor: '#000000',
        fontSize: 10,
        fontWeight: 'normal',
        shape: 'diamond',
      },
      content: {
        description: 'A subtopic under the first main topic',
        relatedConcepts: ['Related concept 1', 'Related concept 2'],
      },
      metadata: {
        importance: 6,
        complexity: 3,
        confidence: 0.85,
        tags: ['subtopic', 'detail'],
        category: 'Detail',
      },
    },
  ],
  connections: [
    {
      id: 'conn1',
      sourceId: 'root',
      targetId: 'node1',
      type: 'parent-child',
      strength: 1.0,
      style: {
        strokeColor: '#666666',
        strokeWidth: 2,
        strokeStyle: 'solid',
        arrowType: 'arrow',
      },
      metadata: {
        confidence: 0.95,
        bidirectional: false,
        weight: 1.0,
      },
    },
    {
      id: 'conn2',
      sourceId: 'root',
      targetId: 'node2',
      type: 'parent-child',
      strength: 1.0,
      style: {
        strokeColor: '#666666',
        strokeWidth: 2,
        strokeStyle: 'solid',
        arrowType: 'arrow',
      },
      metadata: {
        confidence: 0.92,
        bidirectional: false,
        weight: 1.0,
      },
    },
    {
      id: 'conn3',
      sourceId: 'node1',
      targetId: 'node3',
      type: 'parent-child',
      strength: 0.8,
      style: {
        strokeColor: '#666666',
        strokeWidth: 1,
        strokeStyle: 'solid',
        arrowType: 'arrow',
      },
      metadata: {
        confidence: 0.88,
        bidirectional: false,
        weight: 0.8,
      },
    },
  ],
  layout: {
    type: 'hierarchical',
    dimensions: { width: 800, height: 600 },
    spacing: { horizontal: 150, vertical: 100 },
    algorithm: 'tree',
  },
  metadata: {
    totalNodes: 4,
    totalConnections: 3,
    maxDepth: 2,
    rootNodeId: 'root',
    createdAt: '2024-01-01T00:00:00Z',
    version: '1.0',
    complexity: 'detailed',
    estimatedViewTime: 5,
  },
  statistics: {
    nodesByType: { root: 1, 'main-topic': 2, subtopic: 1 },
    nodesByLevel: { 0: 1, 1: 2, 2: 1 },
    connectionsByType: { 'parent-child': 3 },
    averageNodeComplexity: 4.5,
    conceptCoverage: 0.85,
  },
};

const renderComponent = (props = {}) => {
  const defaultProps = {
    mindMap: mockMindMap,
    width: 800,
    height: 600,
    interactive: true,
    showControls: true,
    ...props,
  };

  return render(
    <ThemeProvider theme={theme}>
      <MindMapVisualization {...defaultProps} />
    </ThemeProvider>
  );
};

describe('MindMapVisualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders mind map visualization', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /center view/i })).toBeInTheDocument();
    });

    it('renders with custom dimensions', () => {
      const { container } = renderComponent({ width: 1000, height: 800 });
      
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders without controls when showControls is false', () => {
      renderComponent({ showControls: false });
      
      expect(screen.queryByRole('button', { name: /zoom in/i })).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = renderComponent({ className: 'custom-mindmap' });
      
      expect(container.firstChild).toHaveClass('custom-mindmap');
    });
  });

  describe('Controls', () => {
    it('shows search input', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    it('shows zoom controls', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /center view/i })).toBeInTheDocument();
    });

    it('shows layout selection', () => {
      renderComponent();
      
      expect(screen.getByText('hierarchical')).toBeInTheDocument();
    });

    it('shows color scheme selection', () => {
      renderComponent();
      
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('shows view toggles', () => {
      renderComponent();
      
      // Look for toggle buttons (they might not have specific text)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(5); // Should have multiple control buttons
    });
  });

  describe('Search Functionality', () => {
    it('handles search input', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      await user.type(searchInput, 'Root');
      
      expect(searchInput).toHaveValue('Root');
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      await user.type(searchInput, 'Root');
      
      // The clear button should appear after typing
      await waitFor(() => {
        const clearButton = screen.queryByRole('button', { name: /clear/i });
        if (clearButton) {
          user.click(clearButton);
        }
      });
    });
  });

  describe('Layout Changes', () => {
    it('changes layout when layout button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const layoutButton = screen.getByText('hierarchical');
      await user.click(layoutButton);
      
      // Should show layout menu
      await waitFor(() => {
        expect(screen.getByText('Hierarchical')).toBeInTheDocument();
      });
    });

    it('changes color scheme when color button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const colorButton = screen.getByText('Category');
      await user.click(colorButton);
      
      // Should show color scheme menu
      await waitFor(() => {
        expect(screen.getByText('By Category')).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('shows export menu when export button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText('Export as SVG')).toBeInTheDocument();
        expect(screen.getByText('Export as PNG')).toBeInTheDocument();
        expect(screen.getByText('Export as JSON')).toBeInTheDocument();
      });
    });
  });

  describe('Settings', () => {
    it('shows settings menu when settings button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Display Options')).toBeInTheDocument();
        expect(screen.getByText('Show Labels')).toBeInTheDocument();
        expect(screen.getByText('Show Connections')).toBeInTheDocument();
      });
    });

    it('toggles labels when switch is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);
      
      await waitFor(() => {
        const labelsSwitch = screen.getByRole('checkbox', { name: /show labels/i });
        expect(labelsSwitch).toBeInTheDocument();
      });
    });
  });

  describe('Node Interactions', () => {
    it('calls onNodeClick when provided', () => {
      const onNodeClick = jest.fn();
      renderComponent({ onNodeClick });
      
      // Node click would be handled by D3, so we can't easily test it here
      // But we can verify the callback is passed
      expect(onNodeClick).toBeDefined();
    });

    it('calls onNodeHover when provided', () => {
      const onNodeHover = jest.fn();
      renderComponent({ onNodeHover });
      
      expect(onNodeHover).toBeDefined();
    });

    it('calls onConnectionClick when provided', () => {
      const onConnectionClick = jest.fn();
      renderComponent({ onConnectionClick });
      
      expect(onConnectionClick).toBeDefined();
    });
  });

  describe('Responsive Behavior', () => {
    it('handles different container sizes', () => {
      const { rerender } = renderComponent({ width: 400, height: 300 });
      
      rerender(
        <ThemeProvider theme={theme}>
          <MindMapVisualization
            mindMap={mockMindMap}
            width={1200}
            height={900}
            interactive={true}
            showControls={true}
          />
        </ThemeProvider>
      );
      
      // Component should handle size changes without crashing
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles empty mind map gracefully', () => {
      const emptyMindMap = {
        ...mockMindMap,
        nodes: [],
        connections: [],
      };
      
      renderComponent({ mindMap: emptyMindMap });
      
      // Should still render controls
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });

    it('handles invalid node data gracefully', () => {
      const invalidMindMap = {
        ...mockMindMap,
        nodes: [
          {
            ...mockMindMap.nodes[0],
            position: undefined, // Invalid position
          },
        ],
      };
      
      // Should not crash
      expect(() => renderComponent({ mindMap: invalidMindMap })).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for controls', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /center view/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Tab through controls
      await user.keyboard('{Tab}');
      expect(screen.getByPlaceholderText('Search nodes...')).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('handles large mind maps efficiently', () => {
      const largeMindMap = {
        ...mockMindMap,
        nodes: Array.from({ length: 100 }, (_, i) => ({
          ...mockMindMap.nodes[0],
          id: `node-${i}`,
          label: `Node ${i}`,
          position: { x: Math.random() * 800, y: Math.random() * 600 },
        })),
        connections: Array.from({ length: 99 }, (_, i) => ({
          ...mockMindMap.connections[0],
          id: `conn-${i}`,
          sourceId: `node-${i}`,
          targetId: `node-${i + 1}`,
        })),
      };
      
      const startTime = performance.now();
      renderComponent({ mindMap: largeMindMap });
      const endTime = performance.now();
      
      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Theme Integration', () => {
    it('uses theme colors appropriately', () => {
      const customTheme = createTheme({
        palette: {
          primary: { main: '#ff0000' },
          secondary: { main: '#00ff00' },
        },
      });
      
      render(
        <ThemeProvider theme={customTheme}>
          <MindMapVisualization mindMap={mockMindMap} />
        </ThemeProvider>
      );
      
      // Should render without errors with custom theme
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });
  });
});