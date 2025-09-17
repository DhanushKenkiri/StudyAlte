import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2, Eye, RotateCcw, User as UserIcon, Calendar, Brain, Zap, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { databaseService, PromptHistory, SavedPrompt } from '../services/databaseService';
import { AnalysisResult } from '../services/geminiService';
import './HistoryComponent.css';

interface HistoryComponentProps {
  onRegenerateFromPrompt: (analysisResult: AnalysisResult, title: string) => void;
  onLoadSession: (historyItem: PromptHistory) => void; // New prop for loading complete session
  onClose: () => void;
}

export const HistoryComponent: React.FC<HistoryComponentProps> = ({
  onRegenerateFromPrompt,
  onLoadSession,
  onClose
}) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<SavedPrompt | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const historyData = await databaseService.getPromptHistory(user);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (promptId: string) => {
    if (!user) return;

    try {
      const prompt = await databaseService.getPromptById(user, promptId);
      if (prompt) {
        setSelectedPrompt(prompt);
        setShowDetails(true);
      }
    } catch (error) {
      console.error('Error loading prompt details:', error);
    }
  };

  const handleLoadSession = async (historyItem: PromptHistory) => {
    onLoadSession(historyItem);
    onClose();
  };

  const handleRegenerate = async (promptId: string) => {
    if (!user) return;

    try {
      const prompt = await databaseService.getPromptById(user, promptId);
      if (prompt) {
        // Update last used timestamp
        await databaseService.updateLastUsed(user, promptId);
        
        // Trigger regeneration (creates new question paper)
        onRegenerateFromPrompt(prompt.analysisResult, prompt.title);
        onClose();
      }
    } catch (error) {
      console.error('Error regenerating from prompt:', error);
    }
  };

  const handleDelete = async (promptId: string) => {
    if (!user) return;

    const confirmed = window.confirm('Are you sure you want to delete this prompt? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await databaseService.deletePrompt(user, promptId);
      setHistory(prev => prev.filter(item => item.id !== promptId));
      
      if (selectedPrompt?.id === promptId) {
        setShowDetails(false);
        setSelectedPrompt(null);
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!user) {
    return (
      <div className="history-component">
        <div className="history-header">
          <h3>History</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="auth-required">
          <UserIcon size={48} />
          <h4>Sign in to view history</h4>
          <p>Your saved prompts and question papers will appear here after you sign in.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="history-component">
        <div className="history-header">
          <h3>History</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-component">
      <div className="history-header">
        <h3>
          <Clock size={20} />
          History ({history.length})
        </h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      {history.length === 0 ? (
        <div className="empty-history">
          <FileText size={48} />
          <h4>No saved prompts yet</h4>
          <p>Your generated prompts will appear here after you create question papers.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className="history-item">
              <div className="history-item-header">
                <div className="history-item-title">
                  <FileText size={16} />
                  <span>{item.title}</span>
                </div>
                <div className="history-item-actions">
                  <button
                    onClick={() => handleLoadSession(item)}
                    className="action-btn load-session-btn"
                    title="Load complete session"
                  >
                    <Brain size={14} />
                  </button>
                  <button
                    onClick={() => handleViewDetails(item.id)}
                    className="action-btn view-btn"
                    title="View details"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleRegenerate(item.id)}
                    className="action-btn regenerate-btn"
                    title="Regenerate question paper"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="action-btn delete-btn"
                    title="Delete prompt"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="history-item-meta">
                <span className="subject-tag">{item.subject}</span>
                <span className="file-count">{item.fileCount} files</span>
                <span className="date">
                  <Calendar size={12} />
                  {formatDate(item.createdAt)}
                </span>
                {item.lastUsed && (
                  <span className="last-used">
                    Last used: {formatDate(item.lastUsed)}
                  </span>
                )}
              </div>
              
              {/* Available content indicators */}
              <div className="available-content">
                {item.hasQuestionPaper && (
                  <span className="content-indicator has-content" title="Question Paper Available">
                    <FileText size={12} />
                    Paper
                  </span>
                )}
                {item.hasSummary && (
                  <span className="content-indicator has-content" title="Summary Available">
                    <Brain size={12} />
                    Summary
                  </span>
                )}
                {(item.hasFlashCards || item.hasBedrockFlashCards) && (
                  <span className="content-indicator has-content" title="Flash Cards Available">
                    <Zap size={12} />
                    Cards
                  </span>
                )}
                {!item.hasQuestionPaper && !item.hasSummary && !item.hasFlashCards && !item.hasBedrockFlashCards && (
                  <span className="content-indicator no-content" title="Only prompt data available">
                    <CheckCircle size={12} />
                    Prompt Only
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDetails && selectedPrompt && (
        <div className="prompt-details-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Prompt Details</h4>
              <button onClick={() => setShowDetails(false)} className="close-btn">×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h5>Title</h5>
                <p>{selectedPrompt.title}</p>
              </div>
              
              <div className="detail-section">
                <h5>User Requirements</h5>
                <p>{selectedPrompt.userRequirements}</p>
              </div>
              
              <div className="detail-section">
                <h5>Analysis Summary</h5>
                <div className="analysis-summary">
                  <p><strong>Subject:</strong> {selectedPrompt.analysisResult.analysis.subject}</p>
                  <p><strong>Topics:</strong> {selectedPrompt.analysisResult.analysis.topics?.join(', ')}</p>
                  <p><strong>Difficulty:</strong> {selectedPrompt.analysisResult.analysis.difficulty}</p>
                </div>
              </div>
              
              <div className="detail-section">
                <h5>Uploaded Files ({selectedPrompt.uploadedFiles.length})</h5>
                <ul className="file-list">
                  {selectedPrompt.uploadedFiles.map((file, index) => (
                    <li key={index}>
                      <FileText size={14} />
                      <span>{file.name}</span>
                      <small>({(file.size / 1024).toFixed(1)} KB)</small>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                onClick={() => handleRegenerate(selectedPrompt.id)}
                className="regenerate-btn primary"
              >
                <RotateCcw size={16} />
                Regenerate Question Paper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};