import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  User, 
  Bot, 
  X, 
  Download, 
  FileText,
  Brain,
  BookOpen,
  Target,
  Star,
  Zap,
  Flame,
  Upload,
  History,
  Settings,
  MessageSquare,
  Sparkles,
  Clock,
  Plus,
  UserCircle,
  Home,
  Globe,
  Square,
  Bell,
  ArrowUpRight,
  DownloadCloud,
  Network,
  Search,
  Eye,
  ArrowLeft,
  Microscope,
  Lightbulb,
  TrendingUp,
  Wand2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  LogIn,
  LogOut,
  BarChart3
} from 'lucide-react';
import { geminiService, AnalysisResult, UploadedFile } from './services/geminiService';
import { bedrockService, BedrockAgent, QuestionPaper } from './services/bedrockService';
import { databaseService, PromptHistory } from './services/databaseService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QuestionPaperDisplay } from './components/QuestionPaperDisplay';
import { HistoryComponent } from './components/HistoryComponent';
import { SummaryComponent } from './components/SummaryComponent';
import { MindMapComponent } from './components/MindMapComponent';
import LoginPage from './components/LoginPage';
import './App.css';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  analysisResult?: AnalysisResult;
  questionPaper?: QuestionPaper;
  selectedAgent?: BedrockAgent;
  isGenerating?: boolean;
}

function AppContent() {
  const { user, signInWithGoogle, signOut, loading: authLoading, authError } = useAuth();
  
  // All state hooks must be declared first, before any conditional returns
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPaper, setIsGeneratingPaper] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<BedrockAgent[]>([]);
  const [activeTab, setActiveTab] = useState('question-generator');
  const [showHistory, setShowHistory] = useState(false);
  const [activeAIFeatures, setActiveAIFeatures] = useState<string[]>([]);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<QuestionPaper | null>(null);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [currentAnalysisResult, setCurrentAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [sidebarHistory, setSidebarHistory] = useState<PromptHistory[]>([]);
  const [loadingSidebarHistory, setLoadingSidebarHistory] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [retryCount, setRetryCount] = useState(0);
  // Session data states for historical sessions
  const [loadedSessionData, setLoadedSessionData] = useState<{
    summaryData?: any;
    flashCardSet?: any;
    bedrockFlashCardSet?: any;
    questionPaper?: any;
  } | null>(null);

  // All refs must be declared before conditional returns
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiDropdownRef = useRef<HTMLDivElement>(null);

  // Function definitions (must be before useEffect hooks that reference them)
  const checkNetworkConnection = async () => {
    try {
      setConnectionStatus('checking');
      // Try multiple endpoints to check connectivity
      const endpoints = [
        'https://www.google.com/favicon.ico',
        'https://httpbin.org/status/200',
        'https://api.github.com'
      ];
      
      // Try each endpoint
      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const response = await fetch(endpoint, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          setConnectionStatus('online');
          return true;
        } catch (error) {
          // Continue to next endpoint
          continue;
        }
      }
      
      // If all endpoints fail
      setConnectionStatus('offline');
      return false;
    } catch (error) {
      console.warn('Network connectivity check failed:', error);
      setConnectionStatus('offline');
      return false;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load sidebar history from Firebase
  const loadSidebarHistory = async () => {
    if (!user) {
      setSidebarHistory([]);
      setLoadingSidebarHistory(false);
      return;
    }

    try {
      setLoadingSidebarHistory(true);
      const history = await databaseService.getPromptHistory(user);
      // Only show the first 4 items in sidebar for space
      setSidebarHistory(history.slice(0, 4));
    } catch (error) {
      console.error('Error loading sidebar history:', error);
      setSidebarHistory([]);
    } finally {
      // Small delay to prevent flickering
      setTimeout(() => {
        setLoadingSidebarHistory(false);
      }, 100);
    }
  };

  // Function to handle clicking a sidebar history item - now loads complete session
  const handleSidebarHistoryClick = async (historyItem: PromptHistory) => {
    if (!user) return;

    try {
      console.log('🔄 Loading complete session for history item:', historyItem.title);
      
      // Load complete session data
      const sessionData = await databaseService.getSessionData(user, historyItem.id);
      
      if (sessionData && sessionData.prompt) {
        // Set current analysis result and prompt ID
        setCurrentAnalysisResult(sessionData.prompt.analysisResult);
        setCurrentPromptId(historyItem.id);
        
        // Set the loaded session data for components to use
        setLoadedSessionData({
          summaryData: sessionData.summaryData,
          flashCardSet: sessionData.flashCardSet,
          bedrockFlashCardSet: sessionData.bedrockFlashCardSet,
          questionPaper: sessionData.questionPaper
        });

        // If there's a question paper, set it as the generated paper
        if (sessionData.questionPaper) {
          setGeneratedPaper(sessionData.questionPaper);
          setActiveTab('question-generator'); // Switch to question generator tab
        } else {
          // Clear any existing generated paper and let user choose what to generate
          setGeneratedPaper(null);
        }
        
        // Update last used and reload sidebar
        await databaseService.updateLastUsed(user, historyItem.id);
        loadSidebarHistory();
        
        console.log('✅ Session restored successfully');
        console.log('📊 Available content:', {
          summary: !!sessionData.summaryData,
          flashCards: !!sessionData.flashCardSet,
          bedrockFlashCards: !!sessionData.bedrockFlashCardSet,
          questionPaper: !!sessionData.questionPaper
        });
      }
    } catch (error) {
      console.error('Error loading session from sidebar:', error);
    }
  };

  // Clear generated paper when switching away from question-generator tab
  useEffect(() => {
    if (activeTab !== 'question-generator') {
      setGeneratedPaper(null);
    }
  }, [activeTab]);

  // Load history when user changes
  useEffect(() => {
    loadSidebarHistory();
  }, [user]);

  // Monitor network connection
  useEffect(() => {
    checkNetworkConnection();
    
    const handleOnline = () => {
      setConnectionStatus('online');
      console.log('🟢 Network connection restored');
    };
    
    const handleOffline = () => {
      setConnectionStatus('offline');
      console.log('🔴 Network connection lost');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check connection periodically
    const connectionCheck = setInterval(() => {
      if (navigator.onLine) {
        checkNetworkConnection();
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectionCheck);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log('App mounted - Environment variables check:');
    console.log('ELECTRICAL_ENGINEERING:', process.env.REACT_APP_BEDROCK_AGENT_ELECTRICAL_ENGINEERING);
    console.log('MATHEMATICS:', process.env.REACT_APP_BEDROCK_AGENT_MATHEMATICS);
    console.log('GENERAL:', process.env.REACT_APP_BEDROCK_AGENT_GENERAL);
    console.log('AWS_REGION:', process.env.REACT_APP_AWS_REGION);
    console.log('All REACT_APP env vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP')));
  }, []);

  useEffect(() => {
    setAvailableAgents(bedrockService.getAvailableAgents());
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(event.target as Node)) {
        setShowAIDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Now we can have conditional returns after all hooks are declared
  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show error screen if Firebase is not configured properly
  if (authError) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div style={{ textAlign: 'center', maxWidth: '500px' }}>
            <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>🔥 Firebase Setup Required</h2>
            <p style={{ marginBottom: '1rem' }}>{authError}</p>
            <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', textAlign: 'left', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Quick Fix:</p>
              <p style={{ margin: '0 0 0.5rem 0' }}>1. Go to <a href="https://console.firebase.google.com/project/studyalte" target="_blank" rel="noopener noreferrer" style={{ color: '#10a37f' }}>Firebase Console</a></p>
              <p style={{ margin: '0 0 0.5rem 0' }}>2. Enable Authentication with Google sign-in</p>
              <p style={{ margin: '0 0 0.5rem 0' }}>3. Enable Realtime Database</p>
              <p style={{ margin: '0' }}>4. Restart the app: <code style={{ background: '#333', padding: '2px 4px', borderRadius: '3px' }}>npm start</code></p>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#888' }}>See FIREBASE_SETUP.md for detailed instructions</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!user) {
    return (
      <LoginPage 
        onLoginSuccess={() => {
          // Login success is handled by the auth context
          console.log('Login successful');
        }}
        onError={(error: string) => {
          console.error('Login error:', error);
          alert('Login failed: ' + error);
        }}
      />
    );
  }

  // Reset function to start fresh
  const resetToWelcome = () => {
    setGeneratedPaper(null);
    setShowProgressBar(false);
    setProgressValue(0);
    setProgressStage('');
    setUploadedFiles([]);
    setInputText('');
    setCurrentAnalysisResult(null);
    setCurrentPromptId(null);
    setLoadedSessionData(null); // Clear loaded session data
  };

  // AI Features configuration
  const aiFeatures = [
    {
      id: 'deep-research',
      name: 'Deep Research',
      icon: Microscope,
      description: 'Comprehensive analysis with multiple sources'
    },
    {
      id: 'smart-suggestions',
      name: 'Smart Suggestions',
      icon: Lightbulb,
      description: 'AI-powered content recommendations'
    },
    {
      id: 'trend-analysis',
      name: 'Trend Analysis',
      icon: TrendingUp,
      description: 'Latest educational trends and patterns'
    },
    {
      id: 'creative-mode',
      name: 'Creative Mode',
      icon: Wand2,
      description: 'Enhanced creative question generation'
    }
  ];

  // Navigation tabs configuration
  const navigationTabs = [
    {
      id: 'question-generator',
      name: 'Paper Generator',
      icon: Target,
      description: 'Generate AI-powered question papers'
    },
    {
      id: 'summary',
      name: 'Summary',
      icon: BarChart3,
      description: 'View and analyze content summaries'
    },
    {
      id: 'mindmap-generator',
      name: 'Mind Map',
      icon: BookOpen,
      description: 'Create interactive mind maps and flowcharts'
    },
    {
      id: 'followup-learning',
      name: 'Follow-up Learning',
      icon: Sparkles,
      description: 'Personalized learning paths'
    },
    {
      id: 'note-maker',
      name: 'Note Maker',
      icon: FileText,
      description: 'Smart note taking assistant'
    }
  ];

  // Difficulty levels configuration
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const supportedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!supportedTypes.includes(file.type)) {
        alert(`File type ${file.type} is not supported.`);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      let content = '';

      try {
        if (isImage) {
          content = await readFileAsBase64(file);
        } else if (file.type === 'text/plain') {
          content = await readFileAsText(file);
        } else {
          content = `[${file.type}] File uploaded: ${file.name}`;
        }

        const uploadedFile: UploadedFile = {
          name: file.name,
          size: file.size,
          type: file.type,
          content,
          isImage
        };

        setUploadedFiles(prev => [...prev, uploadedFile]);
      } catch (error) {
        console.error('Error reading file:', error);
        alert(`Error reading file: ${file.name}`);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAIFeature = (featureId: string) => {
    setActiveAIFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && uploadedFiles.length === 0) || isLoading) return;

    // Check network connection before starting
    if (connectionStatus === 'offline') {
      alert('No internet connection detected. Please check your connection and try again.');
      return;
    }

    // Reset retry count for new request
    setRetryCount(0);

    // Calculate estimated time based on file sizes and content complexity
    const totalFileSize = uploadedFiles.reduce((total, file) => total + file.size, 0);
    const baseTime = 180; // 3 minutes minimum for Gemini processing
    const maxTime = 480; // 8 minutes maximum for complex content
    const sizeBasedTime = Math.min(totalFileSize / (1024 * 1024) * 45, maxTime - baseTime); // 45 seconds per MB
    const fileCountTime = uploadedFiles.length * 30; // 30 seconds per additional file
    const estimatedSeconds = baseTime + sizeBasedTime + fileCountTime;
    
    setEstimatedTime(estimatedSeconds);
    setShowProgressBar(true);
    setProgressValue(0);
    setProgressStage('Initializing analysis...');
    setIsLoading(true);

    let progressInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Add a maximum timeout to prevent hanging - give more time for Gemini
      timeoutId = setTimeout(() => {
        if (progressInterval) clearInterval(progressInterval);
        setShowProgressBar(false);
        setIsLoading(false);
        setProgressStage('Operation timed out. Please try again.');
        alert('The operation took too long and has been cancelled. This can happen when:\n\n• Files are very large or complex\n• Gemini API is experiencing high load\n• Network connection is slow\n\nPlease try again with smaller files or check your internet connection.');
      }, estimatedSeconds * 1000 * 2); // 2x the estimated time in milliseconds (more generous)

      // Start progress simulation
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 2 + 0.5; // Slower, more realistic progress
        if (progress > 90) progress = 90; // Don't go past 90% until actually done
        setProgressValue(progress);
        
        // Update progress stages
        if (progress < 20) {
          setProgressStage('Analyzing uploaded files...');
        } else if (progress < 40) {
          setProgressStage('Processing content with AI...');
        } else if (progress < 60) {
          setProgressStage('Generating comprehensive prompt...');
        } else if (progress < 80) {
          setProgressStage('Creating question paper...');
        } else {
          setProgressStage('Finalizing results...');
        }
      }, (estimatedSeconds * 1000) / 90); // Spread progress over estimated time, stopping at 90%

      const processedFiles = [...uploadedFiles];
      console.log('🔄 Processing', processedFiles.length, 'files...');
      
      for (let i = 0; i < processedFiles.length; i++) {
        const file = processedFiles[i];
        console.log(`📄 Processing file ${i + 1}/${processedFiles.length}: ${file.name} (${file.type})`);
        
        if (file.isImage) {
          try {
            console.log('🖼️ Analyzing image content...');
            const response = await fetch(file.content);
            const blob = await response.blob();
            const imageFile = new File([blob], file.name, { type: file.type });
            
            const imageAnalysis = await geminiService.analyzeImageContent(imageFile);
            processedFiles[i] = {
              ...file,
              content: imageAnalysis
            };
            console.log('✅ Image analysis completed for', file.name);
          } catch (error) {
            console.error('❌ Error analyzing image:', error);
          }
        }
      }

      console.log('🤖 Starting Gemini content analysis...');
      const analysisResult = await geminiService.analyzeContent(
        inputText.trim() || 'Analyze uploaded files',
        processedFiles
      );
      console.log('✅ Gemini analysis completed successfully');

      setCurrentAnalysisResult(analysisResult);

      // Save prompt to Firebase if user is authenticated (with timeout)
      if (user && activeTab === 'question-generator') {
        try {
          console.log('💾 Saving prompt to Firebase database...');
          
          // Create a race between the save operation and a timeout
          const savePromise = databaseService.savePrompt(
            user,
            analysisResult,
            inputText.trim() || 'Analyze uploaded files',
            uploadedFiles.map(file => ({
              name: file.name,
              type: file.type,
              size: file.size
            }))
          );
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Database save operation timed out'));
            }, 15000); // 15 second timeout for database save
          });
          
          // Try to save with timeout
          const promptId = await Promise.race([savePromise, timeoutPromise]) as string;
          setCurrentPromptId(promptId);
          console.log('✅ Prompt saved successfully with ID:', promptId);
          
          // Reload sidebar history to show the new prompt
          loadSidebarHistory();
        } catch (error) {
          console.error('❌ Error saving prompt to database:', error);
          // Don't throw the error - continue with generation even if save fails
          console.warn('⚠️ Continuing with generation despite database save failure');
        }
      }

      if (activeTab === 'question-generator') {
        console.log('🎯 Starting question paper generation...');
        await generateQuestionPaper(analysisResult, progressInterval, timeoutId);
        console.log('✅ Question paper generation completed');
      }
      
      // Complete progress only after generation is truly done
      if (progressInterval) clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      setProgressValue(100);
      setProgressStage('Complete!');
      
      setTimeout(() => {
        setShowProgressBar(false);
        setIsLoading(false);
        setInputText('');
        setUploadedFiles([]);
      }, 1000);
      
    } catch (error) {
      console.error('Error generating analysis:', error);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Enhanced error handling with specific error types
      let errorMessage = 'An unexpected error occurred during generation.';
      let isRetryable = false;
      let retryDelay = 2000; // Default 2 seconds
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('could not establish connection') || 
            errorMsg.includes('receiving end does not exist') ||
            errorMsg.includes('network error') ||
            errorMsg.includes('failed to fetch')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
          isRetryable = true;
          retryDelay = 3000;
        } else if (errorMsg.includes('503') || 
                   errorMsg.includes('service unavailable') ||
                   errorMsg.includes('overloaded') ||
                   errorMsg.includes('temporarily unavailable')) {
          errorMessage = 'The AI service is temporarily overloaded. This is common during peak usage times.';
          isRetryable = true;
          retryDelay = 10000; // Wait 10 seconds for overloaded services
        } else if (errorMsg.includes('502') || errorMsg.includes('bad gateway')) {
          errorMessage = 'Server gateway error. The service may be temporarily down.';
          isRetryable = true;
          retryDelay = 5000;
        } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          errorMessage = 'Request timed out. The server might be busy. Please try again.';
          isRetryable = true;
          retryDelay = 5000;
        } else if (errorMsg.includes('api key') || errorMsg.includes('unauthorized')) {
          errorMessage = 'API authentication error. Please check your API configuration.';
          isRetryable = false;
        } else if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
          errorMessage = 'API quota exceeded. Please try again later.';
          isRetryable = false;
        } else if (errorMsg.includes('too large') || errorMsg.includes('file size')) {
          errorMessage = 'File size too large. Please use smaller files.';
          isRetryable = false;
        } else {
          errorMessage = `Error: ${error.message}`;
          isRetryable = true;
        }
      }
      
      setShowProgressBar(false);
      setIsLoading(false);
      setProgressStage(errorMessage);
      
      // Show error dialog with retry option
      const maxRetries = 3;
      const canRetry = isRetryable && retryCount < maxRetries;
      
      if (canRetry) {
        const waitTime = Math.ceil(retryDelay / 1000);
        const shouldRetry = window.confirm(
          `${errorMessage}\n\n` +
          `Attempt ${retryCount + 1} of ${maxRetries + 1}.\n` +
          `${errorMessage.includes('overloaded') || errorMessage.includes('503') ? 
            'The AI service is experiencing high demand. ' : ''}` +
          `Would you like to wait ${waitTime} seconds and try again?`
        );
        
        if (shouldRetry) {
          setRetryCount(prev => prev + 1);
          setProgressStage(`Retrying in ${waitTime} seconds... (${retryCount + 1}/${maxRetries + 1})`);
          
          // Check network status before retry
          const isOnline = await checkNetworkConnection();
          if (isOnline || connectionStatus === 'online') {
            setTimeout(() => {
              handleSendMessage();
            }, retryDelay);
          } else {
            alert('Network connection is still unavailable. Please check your internet connection and try again later.');
            setProgressStage('Network connection unavailable');
          }
          return;
        }
      } else {
        const additionalInfo = retryCount >= maxRetries ? 
          'Maximum retry attempts reached. The service may be experiencing extended downtime.' : 
          errorMessage.includes('503') || errorMessage.includes('overloaded') ?
          'The AI service is currently overloaded. Please try again in a few minutes.' :
          'Please check the error and try again.';
          
        alert(`${errorMessage}\n\n${additionalInfo}`);
      }
      
      // Reset retry count if not retrying
      setRetryCount(0);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const generateQuestionPaper = async (analysisResult: AnalysisResult, progressInterval: NodeJS.Timeout | null, timeoutId?: NodeJS.Timeout | null) => {
    setIsGeneratingPaper(true);
    
    try {
      const selectedAgent = bedrockService.selectBestAgent(analysisResult);
      
      console.log('🔄 Starting question paper generation...');
      console.log('🤖 Selected agent:', selectedAgent);
      console.log('📊 Analysis result:', analysisResult);
      console.log('📋 Paper pattern:', analysisResult.paperPattern);
      console.log('📝 Parsed requirements:', analysisResult.analysis.parsedRequirements);
      
      // Generate paper with default difficulty (medium)
      const questionPaper = await bedrockService.generateQuestionPaper({
        ...analysisResult,
        analysis: { ...analysisResult.analysis, difficulty: 'medium' }
      }, selectedAgent);

      console.log('✅ Generated question paper:', questionPaper);
      
      // Validate that generated paper respects user requirements
      questionPaper && console.log('Paper sections:', questionPaper.sections?.length);
      questionPaper?.sections?.forEach((section, index) => {
        console.log(`Section ${index + 1}:`, section.questions?.length, 'questions');
      });

      // Store generated paper
      if (activeTab === 'question-generator') {
        setGeneratedPaper(questionPaper);
        console.log('✅ Paper stored in state successfully');
        
        // Save to database if we have a prompt ID and user
        if (user && currentPromptId && questionPaper) {
          try {
            await databaseService.saveQuestionPaper(user, currentPromptId, questionPaper);
            console.log('✅ Question paper saved to database');
          } catch (saveError) {
            console.error('❌ Failed to save question paper to database:', saveError);
            // Don't throw error here, as the paper generation was successful
          }
        }
      }
      
      // Clear the progress interval and timeout since we're done
      if (progressInterval) clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      
    } catch (error) {
      console.error('❌ Error generating question paper:', error);
      
      // Clear intervals on error too
      if (progressInterval) clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      
      // Enhanced error handling for question paper generation
      let errorMessage = 'Failed to generate question paper.';
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('could not establish connection') || 
            errorMsg.includes('network error') ||
            errorMsg.includes('failed to fetch')) {
          errorMessage = 'Network error while generating question paper. Please check your connection.';
        } else if (errorMsg.includes('timeout')) {
          errorMessage = 'Question paper generation timed out. Please try again.';
        } else if (errorMsg.includes('bedrock') || errorMsg.includes('aws')) {
          errorMessage = 'AWS Bedrock service error. Please try again or check your configuration.';
        } else {
          errorMessage = `Question paper generation failed: ${error.message}`;
        }
      }
      
      // Log the detailed error for debugging
      console.error('Question paper generation error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null
      });
      
      throw new Error(errorMessage);
    } finally {
      setIsGeneratingPaper(false);
    }
  };

  const handleRegenerateFromHistory = async (analysisResult: AnalysisResult, title: string) => {
    console.log('🔄 Regenerating from history:', title);
    
    setCurrentAnalysisResult(analysisResult);
    setShowProgressBar(true);
    setProgressValue(0);
    setProgressStage('Regenerating from saved prompt...');
    setIsLoading(true);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Start progress simulation
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 4 + 2; // Faster progress for regeneration
        if (progress > 95) progress = 95;
        setProgressValue(progress);
        
        if (progress < 30) {
          setProgressStage('Loading saved prompt...');
        } else if (progress < 70) {
          setProgressStage('Generating new question paper...');
        } else {
          setProgressStage('Finalizing results...');
        }
      }, 100); // Faster interval for regeneration

      await generateQuestionPaper(analysisResult, progressInterval, null);
      
      // Complete progress
      if (progressInterval) clearInterval(progressInterval);
      setProgressValue(100);
      setProgressStage('Complete!');
      
      setTimeout(() => {
        setShowProgressBar(false);
        setIsLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Error regenerating question paper:', error);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      let errorMessage = 'Failed to regenerate question paper.';
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('could not establish connection') || errorMsg.includes('network error')) {
          errorMessage = 'Network error during regeneration. Please check your connection and try again.';
        } else {
          errorMessage = `Regeneration failed: ${error.message}`;
        }
      }
      
      setShowProgressBar(false);
      setIsLoading(false);
      setProgressStage(errorMessage);
      
      alert(errorMessage + '\n\nPlease try again.');
    }
  };

  const handleRegenerateAccurate = async () => {
    if (!currentAnalysisResult) return;
    
    console.log('🔄 Regenerating most accurate question paper...');
    
    setShowProgressBar(true);
    setProgressValue(0);
    setProgressStage('Regenerating with enhanced accuracy...');
    setIsLoading(true);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Start progress simulation
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 4 + 2; // Faster progress for regeneration
        if (progress > 95) progress = 95;
        setProgressValue(progress);
        
        if (progress < 30) {
          setProgressStage('Loading saved prompt...');
        } else if (progress < 70) {
          setProgressStage('Generating enhanced question paper...');
        } else {
          setProgressStage('Finalizing results...');
        }
      }, 100); // Faster interval for regeneration

      await generateQuestionPaper(currentAnalysisResult, progressInterval, null);
      
      // Complete progress
      if (progressInterval) clearInterval(progressInterval);
      setProgressValue(100);
      setProgressStage('Complete!');
      
      setTimeout(() => {
        setShowProgressBar(false);
        setIsLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Error regenerating question paper:', error);
      
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      let errorMessage = 'Failed to regenerate question paper.';
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('could not establish connection') || errorMsg.includes('network error')) {
          errorMessage = 'Network error during regeneration. Please check your connection and try again.';
        } else {
          errorMessage = `Regeneration failed: ${error.message}`;
        }
      }
      
      setShowProgressBar(false);
      setIsLoading(false);
      setProgressStage(errorMessage);
      
      alert(errorMessage + '\n\nPlease try again.');
    }
  };

  const downloadQuestionPaper = (questionPaper: QuestionPaper) => {
    const dataStr = JSON.stringify(questionPaper, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `QuestionPaper.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const downloadJSON = (data: any, filename: string) => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo/Brand */}
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Network size={20} />
          </div>
        </div>

        {/* Quick Action */}
        <div className="sidebar-section">
          <button 
            className="sidebar-item quick-action"
            onClick={resetToWelcome}
            title="New generation"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* History Section */}
        <div className="sidebar-section">
          <button 
            className="sidebar-header clickable"
            onClick={() => setShowHistory(!showHistory)}
            title="View history"
          >
            <History size={16} />
            <span className="sidebar-label">History</span>
          </button>
        </div>

        {/* Session History */}
        <div className="sidebar-section history-list">
          {user ? (
            loadingSidebarHistory ? (
              <div className="sidebar-loading">
                <div className="sidebar-spinner"></div>
                <span>Loading...</span>
              </div>
            ) : sidebarHistory.length > 0 ? (
              sidebarHistory.map((item) => (
                <button 
                  key={item.id} 
                  className="sidebar-item history-item"
                  onClick={() => handleSidebarHistoryClick(item)}
                  title={`Click to regenerate: ${item.title}`}
                >
                  <div className="history-icon">
                    <FileText size={14} />
                  </div>
                  <div className="history-content">
                    <span className="history-title">{item.title}</span>
                    <span className="history-date">
                      {new Date(item.createdAt).toLocaleDateString()} • {item.subject}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="sidebar-empty">
                <div className="empty-state">
                  <MessageSquare size={20} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <span className="empty-title">Start a conversation</span>
                  <span className="empty-subtitle">Your history will appear here</span>
                </div>
              </div>
            )
          ) : (
            <div className="sidebar-auth-prompt">
              <span>Sign in to view your saved prompts</span>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="sidebar-bottom">
          {user ? (
            <>
              <div className="sidebar-item user-info">
                <UserCircle size={16} />
                <div className="user-details">
                  <span className="user-name">{user.displayName || user.email}</span>
                  <span className="user-email">{user.email}</span>
                </div>
              </div>
              
              <button 
                className="sidebar-item"
                onClick={signOut}
                title="Sign out"
              >
                <LogOut size={16} />
                <span className="sidebar-label">Sign Out</span>
              </button>
            </>
          ) : (
            <button 
              className="sidebar-item"
              onClick={signInWithGoogle}
              title="Sign in with Google"
            >
              <LogIn size={16} />
              <span className="sidebar-label">Sign In</span>
            </button>
          )}
          
          <button className="sidebar-item">
            <ArrowUpRight size={16} />
            <span className="sidebar-label">Upgrade</span>
          </button>
          
          <button className="sidebar-item">
            <DownloadCloud size={16} />
            <span className="sidebar-label">Install</span>
          </button>
        </div>
      </aside>

      {/* History Component */}
      {showHistory && (
        <HistoryComponent
          onRegenerateFromPrompt={handleRegenerateFromHistory}
          onLoadSession={handleSidebarHistoryClick}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-center">
            <div className="greeting-section">
              <h1 className="greeting-text">Good Afternoon</h1>
              <p className="greeting-subtitle">Ready to create amazing content?</p>
            </div>
          </div>
          
          {/* Network Status Indicator */}
          {connectionStatus === 'offline' && (
            <div className="network-status offline">
              <div className="status-dot"></div>
              <span>Offline - Check your connection</span>
            </div>
          )}
          {connectionStatus === 'checking' && (
            <div className="network-status checking">
              <div className="status-dot"></div>
              <span>Checking connection...</span>
            </div>
          )}
        </header>

        {/* Navigation Tabs */}
        <nav className="navigation-tabs">
          {navigationTabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={18} />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>

        {/* Sub-Navigation for Question Generator */}
        {activeTab === 'question-generator' && generatedPaper && (
          <nav className="sub-navigation">
            <div className="sub-nav-title">Question Paper Generated</div>
            <div className="regenerate-section">
              <button
                className="btn-regenerate"
                onClick={() => handleRegenerateAccurate()}
                disabled={isLoading || !currentAnalysisResult}
                title="Regenerate with enhanced accuracy"
              >
                <RotateCcw size={16} />
                Regenerate Most Accurate Paper
              </button>
            </div>
          </nav>
        )}

        {/* Content Area */}
        <div className="content-area">
          {showProgressBar ? (
            <div className="progress-container">
              <div className="progress-content">
                <h3>Processing</h3>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressValue}%` }}></div>
                </div>
                <p className="progress-stage">{progressStage}</p>
              </div>
            </div>
          ) : generatedPaper ? (
            <div className="results-container">
              <div className="results-header">
                <h3>✅ Generated Successfully</h3>
                <div className="results-actions">
                  <button onClick={resetToWelcome} className="btn-new">
                    <Plus size={16} />
                    New Generation
                  </button>
                  <button onClick={handleRegenerateAccurate} disabled={isLoading} className="btn-regenerate">
                    <RotateCcw size={16} />
                    Regenerate
                  </button>
                  <button onClick={() => downloadQuestionPaper(generatedPaper)} className="btn-download">
                    <Download size={16} />
                    Download
                  </button>
                </div>
              </div>
              <QuestionPaperDisplay questionPaper={generatedPaper} />
            </div>
          ) : (
            <div className="welcome-container">
              <div className="welcome-content">
                {activeTab === 'summary' && currentAnalysisResult ? (
                  <SummaryComponent 
                    analysisResult={currentAnalysisResult} 
                    promptId={currentPromptId || undefined}
                    loadedSummaryData={loadedSessionData?.summaryData || undefined}
                  />
                ) : activeTab === 'mindmap-generator' && currentAnalysisResult ? (
                  <MindMapComponent 
                    analysisResult={currentAnalysisResult} 
                    promptId={currentPromptId || undefined}
                    loadedMindMapData={loadedSessionData?.bedrockFlashCardSet || undefined}
                  />
                ) : (
                  <>
                    <h2>
                      {activeTab === 'question-generator' && 'Generate Question Papers'}
                      {activeTab === 'summary' && 'Create Summaries'}  
                      {activeTab === 'mindmap-generator' && 'Build Mind Maps'}
                      {activeTab === 'followup-learning' && 'Learning Paths'}
                      {activeTab === 'note-maker' && 'Smart Notes'}
                    </h2>
                    <p>Upload files or enter a prompt to get started</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="input-section">
          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="file-chip">
                  <FileText size={14} />
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({formatFileSize(file.size)})</span>
                  <button 
                    className="file-remove"
                    onClick={() => removeFile(index)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="input-container">
            <div className="input-wrapper">
              <div className="input-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                  onChange={handleFileUpload}
                  className="file-input-hidden"
                  id="file-upload"
                />
                <label 
                  htmlFor="file-upload" 
                  className="attach-btn"
                  title="Upload files"
                >
                  <Upload size={16} />
                </label>

                <div className="ai-features-dropdown" ref={aiDropdownRef}>
                  <button
                    className={`ai-features-trigger ${showAIDropdown ? 'active' : ''} ${activeAIFeatures.length > 0 ? 'has-active' : ''}`}
                    onClick={() => setShowAIDropdown(!showAIDropdown)}
                    title="AI Features"
                  >
                    <Brain size={16} />
                    <div className="ai-features-indicator"></div>
                  </button>

                  <div className={`ai-features-menu ${showAIDropdown ? 'open' : ''}`}>
                    {aiFeatures.map((feature) => (
                      <button
                        key={feature.id}
                        className={`ai-feature-item ${activeAIFeatures.includes(feature.id) ? 'active' : ''}`}
                        onClick={() => {
                          toggleAIFeature(feature.id);
                          // Don't close dropdown immediately, let user select multiple
                        }}
                      >
                        <feature.icon size={16} />
                        <div className="ai-feature-item-content">
                          <div className="ai-feature-item-name">{feature.name}</div>
                          <div className="ai-feature-item-desc">{feature.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <textarea
                  ref={textareaRef}
                  className="input-textarea"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything or upload files for analysis..."
                  disabled={isLoading}
                  rows={1}
                />
              </div>
              
              <div className="input-actions">
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={(!inputText.trim() && uploadedFiles.length === 0) || isLoading}
                  title="Send message"
                >
                  {isLoading ? (
                    <div className="btn-loading-spinner"></div>
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Main App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;