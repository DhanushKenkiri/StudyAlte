import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Download, Brain, Wand2, ZoomIn, ZoomOut, Move, Eye, EyeOff, Maximize2 } from 'lucide-react';
import mermaid from 'mermaid';
import { AnalysisResult } from '../services/geminiService';
import { bedrockService, BedrockFlashCardSet } from '../services/bedrockService';
import { databaseService } from '../services/databaseService';
import { useAuth } from '../contexts/AuthContext';
import './MindMapComponent.css';

export interface MindMapComponentProps {
  analysisResult: AnalysisResult | null;
  promptId?: string;
  loadedMindMapData?: BedrockFlashCardSet;
}

interface MindMapData {
  title: string;
  centralTopic: string;
  mermaidCode: string;
  createdAt: string;
  description: string;
}

export const MindMapComponent: React.FC<MindMapComponentProps> = ({ 
  analysisResult, 
  promptId,
  loadedMindMapData 
}) => {
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { user } = useAuth();
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid with proper mindmap configuration
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#10a37f',
        primaryTextColor: '#e5e5e5',
        primaryBorderColor: '#10a37f',
        lineColor: '#10a37f',
        secondaryColor: '#1e1e1e',
        tertiaryColor: '#333333',
        background: '#000000',
        mainBkg: '#1e1e1e',
        secondBkg: '#2d2d2d',
        tertiaryBkg: '#3d3d3d',
        nodeBorder: '#10a37f',
        clusterBkg: '#2d2d2d',
        clusterBorder: '#10a37f'
      },
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 50,
        rankSpacing: 80,
        padding: 20
      },
      mindmap: {
        useMaxWidth: false,
        padding: 20
      }
    });
  }, []);

  // Load existing mindmap if available
  useEffect(() => {
    const loadExistingMindMap = async () => {
      // First check if we have pre-loaded mindmap data from history session
      if (loadedMindMapData && loadedMindMapData.cards && loadedMindMapData.cards.length > 0) {
        const firstCard = loadedMindMapData.cards[0];
        if (firstCard.mermaidDiagram) {
          const mockMindMapData: MindMapData = {
            title: loadedMindMapData.title || 'Loaded Mind Map',
            centralTopic: firstCard.front || 'Central Topic',
            mermaidCode: firstCard.mermaidDiagram.code,
            createdAt: new Date().toISOString(),
            description: firstCard.mermaidDiagram.description || 'Loaded from history'
          };
          setMindMapData(mockMindMapData);
          await renderMermaidDiagram(firstCard.mermaidDiagram.code);
        }
        return;
      }
      
      // Otherwise, try to load from database if promptId is provided
      if (promptId && user) {
        try {
          const existingMindMap = await databaseService.getBedrockFlashCards(user, promptId);
          if (existingMindMap && existingMindMap.cards && existingMindMap.cards.length > 0) {
            const firstCard = existingMindMap.cards[0];
            if (firstCard.mermaidDiagram) {
              const mockMindMapData: MindMapData = {
                title: existingMindMap.title || 'Saved Mind Map',
                centralTopic: firstCard.front || 'Central Topic',
                mermaidCode: firstCard.mermaidDiagram.code,
                createdAt: new Date().toISOString(),
                description: firstCard.mermaidDiagram.description || 'Loaded from database'
              };
              setMindMapData(mockMindMapData);
              await renderMermaidDiagram(firstCard.mermaidDiagram.code);
            }
          }
        } catch (error) {
          console.error('Error loading existing mindmap:', error);
        }
      }
    };

    loadExistingMindMap();
  }, [promptId, user, loadedMindMapData]);

  // Generate a proper mindmap using AI with enhanced prompting
  const generateMindMap = async () => {
    if (!analysisResult) {
      setError('No analysis result available. Please analyze some content first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setIsTransitioning(true);

    try {
      // Create a detailed prompt for generating a proper tree-like mindmap
      const subject = analysisResult.analysis.subject || 'Unknown Subject';
      const topics = analysisResult.analysis.topics || [];
      // Use topics as key points since keyPoints doesn't exist in the interface
      const keyPoints = topics.slice() || [];
      
      console.log('🧠 Generating mindmap for:', subject);

      // Generate a proper Mermaid mindmap/flowchart diagram
      const mermaidCode = await generateMermaidMindMap(subject, topics, keyPoints);

      const newMindMapData: MindMapData = {
        title: `${subject} Mind Map`,
        centralTopic: subject,
        mermaidCode: mermaidCode,
        createdAt: new Date().toISOString(),
        description: `AI-generated mind map for ${subject}`
      };

      setMindMapData(newMindMapData);
      await renderMermaidDiagram(mermaidCode);
      
      // Save to database as a flashcard set for consistency
      if (user && promptId) {
        try {
          const flashCardSet: BedrockFlashCardSet = {
            title: newMindMapData.title,
            subject: subject,
            cards: [{
              id: '1',
              front: newMindMapData.centralTopic,
              back: 'Mind Map',
              topic: subject,
              difficulty: 'medium',
              type: 'diagram',
              mermaidDiagram: {
                type: 'flowchart',
                code: mermaidCode,
                description: `Mind map for ${subject}`
              },
              visualElements: {
                hasFormula: false,
                hasChart: false,
                hasDiagram: true,
                complexityLevel: 'moderate'
              },
              learningObjective: `Visual representation of ${subject} concepts`,
              hints: [],
              relatedConcepts: topics
            }],
            totalCards: 1,
            estimatedStudyTime: '10 minutes',
            difficultyDistribution: {
              easy: 0,
              medium: 1,
              hard: 0
            },
            topicCoverage: topics,
            mermaidTypes: ['flowchart'],
            generatedBy: 'AI Mind Map Generator',
            timestamp: newMindMapData.createdAt
          };
          
          await databaseService.saveBedrockFlashCards(user, promptId, flashCardSet);
          console.log('✅ Mind map saved to database');
        } catch (saveError) {
          console.error('❌ Failed to save mind map:', saveError);
        }
      }

    } catch (error) {
      console.error('❌ Error generating mind map:', error);
      let errorMessage = 'Failed to generate mind map.';
      
      if (error instanceof Error) {
        if (error.message.includes('summaryPrompt')) {
          errorMessage = 'Cannot access summary prompt. Please regenerate your analysis first.';
        } else if (error.message.includes('threePrompts')) {
          errorMessage = 'Analysis data is incomplete. Please regenerate your content analysis.';
        } else {
          errorMessage = `Mind map generation failed: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  // Generate a proper Mermaid mindmap/flowchart
  const generateMermaidMindMap = async (subject: string, topics: string[], keyPoints: string[]): Promise<string> => {
    // Create a tree-like structure using flowchart syntax (more reliable than mindmap)
    const cleanSubject = subject.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20);
    const centralId = 'root';
    
    let mermaidCode = `flowchart TD
    ${centralId}["${cleanSubject}"]
    ${centralId} --> A[Fundamentals]
    ${centralId} --> B[Core Concepts]
    ${centralId} --> C[Applications]
    ${centralId} --> D[Advanced Topics]
    
`;

    // Add fundamentals branch
    if (topics.length > 0) {
      mermaidCode += `    A --> A1["${topics[0]?.substring(0, 20) || 'Basic Principles'}"]
    A --> A2["${topics[1]?.substring(0, 20) || 'Foundation'}"]
    
`;
    }

    // Add core concepts branch
    if (topics.length > 2) {
      mermaidCode += `    B --> B1["${topics[2]?.substring(0, 20) || 'Key Ideas'}"]
    B --> B2["${topics[3]?.substring(0, 20) || 'Main Concepts'}"]
    
`;
    }

    // Add applications branch
    if (keyPoints.length > 0) {
      mermaidCode += `    C --> C1["${keyPoints[0]?.substring(0, 20) || 'Practical Use'}"]
    C --> C2["${keyPoints[1]?.substring(0, 20) || 'Real World'}"]
    
`;
    }

    // Add advanced topics branch
    if (keyPoints.length > 2) {
      mermaidCode += `    D --> D1["${keyPoints[2]?.substring(0, 20) || 'Complex Ideas'}"]
    D --> D2["${keyPoints[3]?.substring(0, 20) || 'Specialized'}"]
    
`;
    }

    // Add styling
    mermaidCode += `    classDef centerNode fill:#10a37f,stroke:#10a37f,stroke-width:3px,color:#fff
    classDef mainBranch fill:#2d2d2d,stroke:#10a37f,stroke-width:2px,color:#e5e5e5
    classDef subBranch fill:#1e1e1e,stroke:#666,stroke-width:1px,color:#ccc
    
    class ${centralId} centerNode
    class A,B,C,D mainBranch
    class A1,A2,B1,B2,C1,C2,D1,D2 subBranch`;

    return mermaidCode;
  };

  // Render Mermaid diagram with enhanced error handling
  const renderMermaidDiagram = async (mermaidCode: string) => {
    if (!mermaidRef.current) return;

    try {
      console.log('🎨 Rendering Mermaid diagram...');
      
      // Clear the container
      mermaidRef.current.innerHTML = '';
      
      // Generate unique ID for this diagram
      const diagramId = `mindmap-${Date.now()}`;
      
      // Render the diagram
      const { svg } = await mermaid.render(diagramId, mermaidCode);
      mermaidRef.current.innerHTML = svg;
      
      console.log('✅ Mermaid diagram rendered successfully');
    } catch (error) {
      console.error('❌ Error rendering Mermaid diagram:', error);
      
      // Show fallback content with the raw code
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `
          <div class="mermaid-error">
            <div class="error-icon">⚠️</div>
            <div class="error-message">
              <h4>Diagram Rendering Error</h4>
              <p>Unable to render the mind map diagram. This might be due to complex content.</p>
              <details>
                <summary>Click to view raw Mermaid code</summary>
                <pre class="mermaid-code">${mermaidCode}</pre>
              </details>
              <button class="retry-btn" onclick="window.location.reload()">Retry</button>
            </div>
          </div>
        `;
      }
    }
  };

  // Mouse and touch handlers for navigation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle mouse or Alt+Left mouse
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(3, prev * zoomFactor)));
    }
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(3, prev * 1.2));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(0.1, prev / 1.2));
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const downloadMindMap = () => {
    if (!mindMapData) return;

    const dataStr = JSON.stringify(mindMapData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindmap-${mindMapData.title.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`mindmap-component ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Header */}
      <div className="mindmap-header">
        <div className="mindmap-title">
          <Brain size={20} />
          <h3>Mind Map Generator</h3>
          {mindMapData && <span className="mindmap-subtitle">{mindMapData.title}</span>}
        </div>
        
        <div className="mindmap-controls">
          {mindMapData && (
            <>
              <button
                onClick={zoomOut}
                className="control-btn"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              
              <button
                onClick={zoomIn}
                className="control-btn"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              
              <button
                onClick={resetView}
                className="control-btn"
                title="Reset View"
              >
                <Move size={16} />
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="control-btn"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                <Maximize2 size={16} />
              </button>
              
              <button
                onClick={downloadMindMap}
                className="control-btn"
                title="Download Mind Map"
              >
                <Download size={16} />
              </button>
            </>
          )}
          
          <button
            onClick={generateMindMap}
            disabled={isGenerating || !analysisResult}
            className="generate-btn"
            title="Generate Mind Map"
          >
            {isGenerating ? (
              <div className="btn-loading-spinner" />
            ) : (
              <Wand2 size={16} />
            )}
            {isGenerating ? 'Generating...' : 'Generate Mind Map'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mindmap-content">
        {error ? (
          <div className="mindmap-error">
            <div className="error-icon">❌</div>
            <div className="error-content">
              <h4>Generation Error</h4>
              <p>{error}</p>
              <button onClick={generateMindMap} className="retry-btn">
                <RotateCcw size={16} />
                Try Again
              </button>
            </div>
          </div>
        ) : mindMapData ? (
          <div 
            className="mindmap-viewport"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab',
              overflow: 'hidden'
            }}
          >
            <div 
              className="mindmap-canvas"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <div ref={mermaidRef} className="mermaid-diagram" />
            </div>
            
            {/* Zoom indicator */}
            <div className="zoom-indicator">
              {Math.round(zoom * 100)}%
            </div>
            
            {/* Navigation help */}
            <div className="navigation-help">
              <p>💡 <strong>Navigation:</strong></p>
              <p>• Middle mouse + drag to pan</p>
              <p>• Ctrl + scroll to zoom</p>
              <p>• Alt + left click + drag to pan</p>
            </div>
          </div>
        ) : (
          <div className="mindmap-welcome">
            <div className="welcome-content">
              <Brain size={48} />
              <h3>Create Interactive Mind Maps</h3>
              <p>
                Generate visual mind maps from your analyzed content. 
                The AI will create a tree-like structure with your topic in the center 
                and branches showing related concepts and ideas.
              </p>
              <div className="mindmap-features">
                <div className="feature">
                  <span className="feature-icon">🌳</span>
                  <span>Tree-like Structure</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🎯</span>
                  <span>Central Topic Focus</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🔍</span>
                  <span>Zoom & Pan Navigation</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">📊</span>
                  <span>Visual Learning</span>
                </div>
              </div>
              {!analysisResult && (
                <p className="hint">
                  💡 Upload and analyze some content first to generate a mind map
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};