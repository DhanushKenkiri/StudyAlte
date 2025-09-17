import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight, Eye, EyeOff, Brain, Clock, Target, Download, Shuffle, Wand2 } from 'lucide-react';
import mermaid from 'mermaid';
import { AnalysisResult } from '../services/geminiService';
import { bedrockService, BedrockFlashCardSet, BedrockFlashCard } from '../services/bedrockService';
import { databaseService } from '../services/databaseService';
import { useAuth } from '../contexts/AuthContext';
import './FlashCardComponent.css';

interface FlashCardComponentProps {
  analysisResult: AnalysisResult | null;
  promptId?: string;
  bedrockAgentId?: string; // Optional specific agent ID
  loadedFlashCardData?: BedrockFlashCardSet; // Pre-loaded flashcard data from history session
}

export const FlashCardComponent: React.FC<FlashCardComponentProps> = ({ 
  analysisResult, 
  promptId,
  bedrockAgentId,
  loadedFlashCardData 
}) => {
  const [flashCardSet, setFlashCardSet] = useState<BedrockFlashCardSet | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffledCards, setShuffledCards] = useState<BedrockFlashCard[]>([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user } = useAuth();
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#10a37f',
        primaryTextColor: '#e5e5e5',
        primaryBorderColor: '#333',
        lineColor: '#666',
        secondaryColor: '#1a1a1a',
        tertiaryColor: '#2a2a2a',
        background: '#000000',
        mainBkg: '#1a1a1a',
        secondBkg: '#2a2a2a',
        tertiaryBkg: '#333',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
      },
      mindmap: {
        useMaxWidth: true,
      }
    });
  }, []);

  // Load existing flashcards if promptId is provided or loadedFlashCardData is available
  useEffect(() => {
    const loadExistingFlashCards = async () => {
      // First check if we have pre-loaded flashcard data from history session
      if (loadedFlashCardData) {
        setFlashCardSet(loadedFlashCardData);
        setShuffledCards(loadedFlashCardData.cards);
        return;
      }
      
      // Otherwise, try to load from database if promptId is provided
      if (promptId && user) {
        try {
          const existingFlashCards = await databaseService.getBedrockFlashCards(user, promptId);
          if (existingFlashCards) {
            setFlashCardSet(existingFlashCards);
            setShuffledCards(existingFlashCards.cards);
          }
        } catch (error) {
          console.error('Error loading existing flashcards:', error);
        }
      }
    };

    loadExistingFlashCards();
  }, [promptId, user, loadedFlashCardData]);

  // Render Mermaid diagram when card changes
  useEffect(() => {
    if (flashCardSet && mermaidRef.current && flashCardSet.cards[currentCardIndex]?.mermaidDiagram) {
      const currentCard = shuffledCards.length > 0 ? shuffledCards[currentCardIndex] : flashCardSet.cards[currentCardIndex];
      const diagram = currentCard.mermaidDiagram;
      
      if (diagram && diagram.code) {
        const element = mermaidRef.current;
        
        // Show loading state
        element.innerHTML = '<div class="mermaid-loading">📊 Rendering diagram...</div>';
        
        try {
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Clean and validate the diagram code
          const cleanedCode = diagram.code.trim();
          
          // Use the modern Mermaid API with better error handling
          mermaid.render(id, cleanedCode).then((result) => {
            if (element && result.svg) {
              element.innerHTML = result.svg;
              
              // Add dynamic interactions to the SVG
              const svg = element.querySelector('svg');
              if (svg) {
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
                svg.style.transition = 'all 0.3s ease';
                
                // Add zoom on click functionality
                svg.addEventListener('click', () => {
                  svg.style.transform = svg.style.transform === 'scale(1.2)' ? 'scale(1)' : 'scale(1.2)';
                });
              }
            }
          }).catch((error) => {
            console.error('Error rendering Mermaid diagram:', error);
            element.innerHTML = `
              <div class="mermaid-error">
                <div class="error-icon">⚠️</div>
                <div class="error-title">Diagram Render Error</div>
                <div class="error-description">${diagram.description}</div>
                <details class="error-details">
                  <summary>Technical Details</summary>
                  <pre>${error.message}</pre>
                </details>
              </div>
            `;
          });
        } catch (error) {
          console.error('Error initializing Mermaid diagram:', error);
          element.innerHTML = `
            <div class="mermaid-error">
              <div class="error-icon">⚠️</div>
              <div class="error-title">Diagram Initialization Error</div>
              <div class="error-description">${diagram.description}</div>
            </div>
          `;
        }
      }
    } else if (mermaidRef.current) {
      // Clear diagram if no diagram available
      mermaidRef.current.innerHTML = '';
    }
  }, [flashCardSet, currentCardIndex, shuffledCards, isFlipped]);

  const handleGenerateFlashCards = async () => {
    if (!analysisResult) {
      setError('No analysis data available. Please analyze content first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Use dedicated flashcard generator agent if available, otherwise auto-select
      const flashcardAgentId = bedrockAgentId || process.env.REACT_APP_BEDROCK_AGENT_FLASHCARD_GENERATOR;
      
      const flashCards = await bedrockService.generateFlashCards(analysisResult, flashcardAgentId);
      setFlashCardSet(flashCards);
      setShuffledCards(flashCards.cards);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setIsShuffled(false);
      
      // Save to database if user is logged in and promptId is available
      if (user && promptId) {
        try {
          await databaseService.saveBedrockFlashCards(user, promptId, flashCards);
        } catch (saveError) {
          console.error('Error saving flashcards to database:', saveError);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards');
      console.error('FlashCard generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const shuffleCards = () => {
    if (!flashCardSet) return;
    
    const cards = [...flashCardSet.cards];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    
    setShuffledCards(cards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsShuffled(true);
  };

  const resetOrder = () => {
    if (!flashCardSet) return;
    
    setShuffledCards(flashCardSet.cards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsShuffled(false);
  };

  const nextCard = () => {
    if (!flashCardSet || isTransitioning) return;
    
    setIsTransitioning(true);
    const cards = shuffledCards.length > 0 ? shuffledCards : flashCardSet.cards;
    
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % cards.length);
      setIsFlipped(false);
      setIsTransitioning(false);
    }, 150);
  };

  const prevCard = () => {
    if (!flashCardSet || isTransitioning) return;
    
    setIsTransitioning(true);
    const cards = shuffledCards.length > 0 ? shuffledCards : flashCardSet.cards;
    
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
      setIsFlipped(false);
      setIsTransitioning(false);
    }, 150);
  };

  const downloadFlashCards = () => {
    if (!flashCardSet) return;

    const flashCardText = `
${flashCardSet.title}
${'='.repeat(flashCardSet.title.length)}

Subject: ${flashCardSet.subject}
Total Cards: ${flashCardSet.totalCards}
Study Time: ${flashCardSet.estimatedStudyTime}

Difficulty Distribution:
- Easy: ${flashCardSet.difficultyDistribution.easy}
- Medium: ${flashCardSet.difficultyDistribution.medium}  
- Hard: ${flashCardSet.difficultyDistribution.hard}

FLASHCARDS:
${flashCardSet.cards.map((card, index) => 
  `\nCard ${index + 1} - ${card.type.toUpperCase()} (${card.difficulty})
Topic: ${card.topic}

FRONT: ${card.front}

BACK: ${card.back}

Learning Objective: ${card.learningObjective}
${card.hints.length > 0 ? `Hints: ${card.hints.join(', ')}` : ''}
${card.relatedConcepts.length > 0 ? `Related: ${card.relatedConcepts.join(', ')}` : ''}
${card.mermaidDiagram ? `\nDiagram: ${card.mermaidDiagram.description}` : ''}
`).join('\n' + '-'.repeat(50))}

Generated by: ${flashCardSet.generatedBy}
Timestamp: ${new Date(flashCardSet.timestamp).toLocaleString()}
    `.trim();

    const blob = new Blob([flashCardText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards-${flashCardSet.subject.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentCard = flashCardSet && (shuffledCards.length > 0 ? shuffledCards[currentCardIndex] : flashCardSet.cards[currentCardIndex]);

  if (!flashCardSet) {
    return (
      <div className="content-area">
        <div className="flashcard-container">
          <div className="flashcard-prompt">
            <div className="prompt-header">
              <Brain size={48} className="prompt-icon" />
              <h2>Generate Interactive Flashcards</h2>
            </div>
            
            <div className="prompt-description">
              <p>
                Create interactive flashcards with visual diagrams from your analyzed content. 
                Get comprehensive study cards with Mermaid diagrams, hints, and structured learning paths.
              </p>
            </div>
            
            {analysisResult && (
              <div className="flashcard-features">
                <h3>🎴 What you'll get:</h3>
                <div className="features-grid">
                  <div className="feature-item">
                    <span className="feature-icon">🧠</span>
                    <span>Interactive cards for {analysisResult.analysis.subject}</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📊</span>
                    <span>Visual Mermaid diagrams and flowcharts</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🎯</span>
                    <span>Difficulty-based learning progression</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">💡</span>
                    <span>Helpful hints and related concepts</span>
                  </div>
                </div>
              </div>
            )}

            <button 
              className="generate-flashcard-btn"
              onClick={handleGenerateFlashCards}
              disabled={!analysisResult || isGenerating}
            >
              {isGenerating ? (
                <>
                  <RotateCcw size={24} className="spinning" />
                  Generating Flashcards...
                </>
              ) : (
                <>
                  <Wand2 size={24} />
                  Generate Flashcards
                </>
              )}
            </button>

            {bedrockAgentId && (
              <div className="agent-info">
                <span className="agent-badge">Using Agent: {bedrockAgentId}</span>
              </div>
            )}

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!analysisResult && (
              <div className="no-analysis-message">
                <Brain size={32} className="no-analysis-icon" />
                <p>Please analyze some content first using the Paper Generator tab to generate flashcards.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-area">
      <div className="flashcard-container">
        <div className="flashcard-header">
          <div className="flashcard-title-section">
            <h2>{flashCardSet.title}</h2>
            <div className="flashcard-meta">
              <span className="meta-item">
                <Clock size={18} />
                {flashCardSet.estimatedStudyTime}
              </span>
              <span className="meta-item">
                <Target size={18} />
                {flashCardSet.totalCards} cards
              </span>
              {isShuffled && (
                <span className="shuffle-indicator">
                  <Shuffle size={18} />
                  Shuffled
                </span>
              )}
            </div>
          </div>
          <div className="flashcard-actions">
            <button 
              className="action-btn shuffle"
              onClick={shuffleCards}
              title="Shuffle Cards"
            >
              <Shuffle size={18} />
              Shuffle
            </button>
            {isShuffled && (
              <button 
                className="action-btn reset"
                onClick={resetOrder}
                title="Reset Order"
              >
                <RotateCcw size={18} />
                Reset
              </button>
            )}
            <button 
              className="action-btn regenerate"
              onClick={handleGenerateFlashCards}
              disabled={isGenerating}
              title="Regenerate Flashcards"
            >
              <RotateCcw size={18} />
              Regenerate
            </button>
            <button 
              className="action-btn download"
              onClick={downloadFlashCards}
              title="Download Flashcards"
            >
              <Download size={18} />
              Download
            </button>
          </div>
        </div>

        <div className="flashcard-study-area">
          <div className="flashcard-navigation">
            <button 
              className="nav-btn prev"
              onClick={prevCard}
              disabled={flashCardSet.totalCards <= 1}
            >
              <ChevronLeft size={20} />
              Previous
            </button>
            
            <div className="card-progress">
              <span className="card-counter">
                {currentCardIndex + 1} / {flashCardSet.totalCards}
              </span>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${((currentCardIndex + 1) / flashCardSet.totalCards) * 100}%` }}
                />
              </div>
            </div>
            
            <button 
              className="nav-btn next"
              onClick={nextCard}
              disabled={flashCardSet.totalCards <= 1}
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>

          {currentCard && (
            <div className="flashcard-display">
              <div className={`flashcard ${isFlipped ? 'flipped' : ''} ${isTransitioning ? 'transitioning-out' : ''}`}>
                <div className="card-front" onClick={() => setIsFlipped(!isFlipped)}>
                  <div className="card-header">
                    <div className="card-meta">
                      <span className={`difficulty-badge ${currentCard.difficulty}`}>
                        {currentCard.difficulty}
                      </span>
                      <span className={`type-badge ${currentCard.type}`}>
                        {currentCard.type}
                      </span>
                    </div>
                    <button 
                      className="flip-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(!isFlipped);
                      }}
                    >
                      {isFlipped ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  <div className="card-content">
                    <div className="card-topic">
                      <span>📚 {currentCard.topic}</span>
                    </div>
                    <div className="card-question">
                      {currentCard.front}
                    </div>
                    <div className="card-prompt">
                      <span>Click to reveal answer</span>
                    </div>
                  </div>
                </div>

                <div className="card-back" onClick={() => setIsFlipped(!isFlipped)}>
                  <div className="card-header">
                    <div className="card-meta">
                      <span className={`difficulty-badge ${currentCard.difficulty}`}>
                        {currentCard.difficulty}
                      </span>
                      <span className={`type-badge ${currentCard.type}`}>
                        {currentCard.type}
                      </span>
                    </div>
                    <button 
                      className="flip-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(!isFlipped);
                      }}
                    >
                      {isFlipped ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  <div className="card-content">
                    <div className="card-answer">
                      {currentCard.back}
                    </div>
                    
                    {currentCard.mermaidDiagram && (
                      <div className="card-diagram">
                        <div className="diagram-header">
                          <span>📊 {currentCard.mermaidDiagram.description}</span>
                        </div>
                        <div ref={mermaidRef} className="mermaid-container" />
                      </div>
                    )}
                    
                    <div className="card-objective">
                      <strong>🎯 Learning Objective:</strong>
                      <span>{currentCard.learningObjective}</span>
                    </div>
                    
                    {currentCard.hints.length > 0 && (
                      <div className="card-hints">
                        <strong>💡 Hints:</strong>
                        <ul>
                          {currentCard.hints.map((hint, index) => (
                            <li key={index}>{hint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {currentCard.relatedConcepts.length > 0 && (
                      <div className="card-related">
                        <strong>🔗 Related Concepts:</strong>
                        <div className="related-tags">
                          {currentCard.relatedConcepts.map((concept, index) => (
                            <span key={index} className="related-tag">
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flashcard-stats">
          <div className="stats-section">
            <h3>📊 Study Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Cards</span>
                <span className="stat-value">{flashCardSet.totalCards}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Easy</span>
                <span className="stat-value difficulty-easy">{flashCardSet.difficultyDistribution.easy}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Medium</span>
                <span className="stat-value difficulty-medium">{flashCardSet.difficultyDistribution.medium}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Hard</span>
                <span className="stat-value difficulty-hard">{flashCardSet.difficultyDistribution.hard}</span>
              </div>
            </div>
          </div>
          
          <div className="topics-section">
            <h3>🏷️ Topic Coverage</h3>
            <div className="topic-tags">
              {flashCardSet.topicCoverage.map((topic, index) => (
                <span key={index} className="topic-tag">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="generation-footer">
          <div className="generation-info">
            <span>Generated by {flashCardSet.generatedBy}</span>
            <span className="separator">•</span>
            <span>{new Date(flashCardSet.timestamp).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};