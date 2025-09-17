import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { AnalysisResult } from './geminiService';

export interface BedrockAgent {
  id: string;
  alias: string;
  name: string;
  subjects: string[];
  description: string;
}

export interface QuestionPaper {
  title: string;
  subject: string;
  duration: string;
  totalMarks: number;
  sections: QuestionSection[];
  instructions: string[];
  generatedBy: string;
  timestamp: string;
  answerKey?: {
    solutions: {
      questionNumber: number;
      solution: string;
      markingScheme: string;
    }[];
  };
  metadata?: {
    generatedBy: string;
    timestamp: string;
    difficulty: string;
    estimatedTime: string;
  };
}

export interface QuestionSection {
  sectionName: string;
  instructions: string;
  questions: Question[];
  totalMarks: number;
}

export interface Question {
  questionNumber: number;
  question: string;
  marks: number;
  questionType: 'MCQ' | 'Short Answer' | 'Long Answer' | 'Numerical' | 'Essay' | 'Graph' | 'Diagram' | 'Equation';
  options?: string[];
  correctAnswer?: string;
  answerKey?: string;
  bloomLevel?: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  mathContent?: {
    latex?: string;
    equations?: string[];
    integrals?: string[];
    graphs?: GraphDefinition[];
    tables?: TableData[];
  };
  visualContent?: {
    diagrams?: DiagramData[];
    charts?: ChartData[];
    images?: string[];
  };
}

export interface GraphDefinition {
  type: 'function' | 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
  title: string;
  data: any;
  mermaidCode?: string;
  mathFunction?: string;
  domain?: [number, number];
  range?: [number, number];
}

export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface DiagramData {
  type: 'flowchart' | 'circuit' | 'geometry' | 'biological' | 'chemical';
  mermaidCode?: string;
  description: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string;
  }[];
}

// Enhanced FlashCard interfaces for Bedrock agent
export interface MermaidDiagram {
  type: 'flowchart' | 'graph' | 'mindmap' | 'sequence' | 'class' | 'state' | 'pie' | 'gitgraph';
  code: string;
  description: string;
}

export interface VisualElements {
  hasFormula: boolean;
  hasChart: boolean;
  hasDiagram: boolean;
  complexityLevel: 'simple' | 'moderate' | 'complex';
}

export interface BedrockFlashCard {
  id: string;
  front: string;
  back: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'definition' | 'concept' | 'formula' | 'process' | 'diagram' | 'example';
  mermaidDiagram?: MermaidDiagram;
  visualElements: VisualElements;
  learningObjective: string;
  hints: string[];
  relatedConcepts: string[];
}

export interface BedrockFlashCardSet {
  title: string;
  subject: string;
  cards: BedrockFlashCard[];
  totalCards: number;
  estimatedStudyTime: string;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  topicCoverage: string[];
  mermaidTypes: string[];
  generatedBy: string;
  timestamp: string;
}

class BedrockService {
  private client: BedrockAgentRuntimeClient | null = null;
  private agents: BedrockAgent[] = [];
  private isBedrockAvailable: boolean = false;

  constructor() {
    // Read credentials from environment variables only
    const accessKeyId = process.env.REACT_APP_AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;
    const region = process.env.REACT_APP_AWS_REGION || 'eu-north-1';

    console.log('🔧 Using AWS credentials:');
    console.log('Access Key ID:', accessKeyId ? `${accessKeyId.slice(0, 6)}...` : 'NOT SET');
    console.log('Region:', region);

    // Initialize AWS Bedrock client only if credentials are available
    try {
      if (accessKeyId && secretAccessKey) {
        this.client = new BedrockAgentRuntimeClient({
          region: region,
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
          },
        });
        
        this.isBedrockAvailable = true;
        console.log('🔗 AWS Bedrock client initialized with credentials');
        console.log('✅ Bedrock will be used for question paper generation');
      } else {
        console.warn('⚠️ AWS Bedrock credentials not found, will use fallback generation');
        this.isBedrockAvailable = false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize AWS Bedrock client:', error);
      this.isBedrockAvailable = false;
    }

    // Debug: Log environment variables
    console.log('Environment variables check:');
    console.log('ELECTRICAL_ENGINEERING:', process.env.REACT_APP_BEDROCK_AGENT_ELECTRICAL_ENGINEERING);
    console.log('MATHEMATICS:', process.env.REACT_APP_BEDROCK_AGENT_MATHEMATICS);
    console.log('GENERAL:', process.env.REACT_APP_BEDROCK_AGENT_GENERAL);
    console.log('FLASHCARD_GENERATOR:', process.env.REACT_APP_BEDROCK_AGENT_FLASHCARD_GENERATOR);

    // Define available agents with their subject specializations based on your AWS agents
    this.agents = [
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_FLASHCARD_GENERATOR || 'FLASHCARD_AGENT_ID',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Flashcard Generator Specialist',
        subjects: ['flashcards', 'visual learning', 'interactive learning', 'mermaid diagrams', 'educational content'],
        description: 'Specialized in creating interactive flashcards with visual diagrams and comprehensive learning aids'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_MATHEMATICS || 'TXGRUACVNW',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Mathematics & Statistics Specialist',
        subjects: ['mathematics', 'math', 'statistics', 'algebra', 'calculus', 'geometry', 'trigonometry', 'probability', 'data analysis'],
        description: 'Specialized in mathematical concepts, statistical analysis, and quantitative problem solving'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_DATA_SCIENCE || 'HASXTWDVJM',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Data Science Specialist',
        subjects: ['data science', 'machine learning', 'artificial intelligence', 'data analysis', 'python', 'r programming', 'statistics'],
        description: 'Expert in data science concepts, machine learning algorithms, and data analytics'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_MECHANICAL_ENGINEERING || 'W24FHTF0DQ',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Mechanical Engineering Specialist',
        subjects: ['mechanical engineering', 'thermodynamics', 'mechanics', 'fluid mechanics', 'materials science', 'manufacturing'],
        description: 'Specialized in mechanical engineering principles, design, and manufacturing processes'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_ELECTRICAL_ENGINEERING || 'EORCKPWW4Y',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Electrical Engineering Specialist',
        subjects: ['electrical engineering', 'electronics', 'circuits', 'power systems', 'control systems', 'signal processing'],
        description: 'Expert in electrical circuits, power systems, and electronic device design'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_CIVIL_ENGINEERING || '2HO5NGNUZB',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Civil Engineering Specialist',
        subjects: ['civil engineering', 'structural engineering', 'construction', 'materials', 'geotechnical', 'transportation'],
        description: 'Specialized in civil infrastructure, structural design, and construction management'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_CHEMISTRY || 'TKVRZCRSZA',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Chemical Engineering Specialist',
        subjects: ['chemical engineering', 'chemistry', 'process engineering', 'reaction engineering', 'thermodynamics', 'mass transfer'],
        description: 'Expert in chemical processes, reaction engineering, and industrial chemistry'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_ECONOMICS || 'TS69D3B8VB',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Economics Specialist',
        subjects: ['economics', 'microeconomics', 'macroeconomics', 'finance', 'business economics', 'econometrics'],
        description: 'Specialized in economic theories, market analysis, and financial concepts'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_COMPUTER_SCIENCE || 'G0LHLLA8NW',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Computer Science Specialist',
        subjects: ['computer science', 'programming', 'algorithms', 'data structures', 'software engineering', 'databases', 'networking'],
        description: 'Expert in programming, algorithms, software development, and computer systems'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_COLLABORATOR || 'TKVRZCRSZA',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'Interdisciplinary Collaborator',
        subjects: ['interdisciplinary', 'collaboration', 'project management', 'research methodology', 'technical writing'],
        description: 'Specialized in collaborative projects and interdisciplinary question paper creation'
      },
      {
        id: process.env.REACT_APP_BEDROCK_AGENT_GENERAL || 'TKVRZCRSZA',
        alias: process.env.REACT_APP_BEDROCK_AGENT_ALIAS || 'TSTALIASID',
        name: 'General Academic Specialist',
        subjects: ['general knowledge', 'current affairs', 'general studies', 'aptitude', 'reasoning', 'comprehensive'],
        description: 'Covers general academic topics and comprehensive question paper creation'
      }
    ];

    // Filter out agents with invalid IDs
    this.agents = this.agents.filter(agent => {
      const isValid = agent.id && agent.id.trim() !== '' && agent.alias && agent.alias.trim() !== '';
      if (!isValid) {
        console.warn(`Filtering out invalid agent: ${agent.name}, ID: ${agent.id}, Alias: ${agent.alias}`);
      }
      return isValid;
    });

    console.log(`Loaded ${this.agents.length} valid agents:`, this.agents.map(a => ({ name: a.name, id: a.id })));
  }

  // Test method to validate agent configuration
  async testAgentConnection(agent: BedrockAgent): Promise<boolean> {
    if (!this.client || !this.isBedrockAvailable) {
      return false;
    }

    try {
      const command = new InvokeAgentCommand({
        agentId: agent.id.trim(),
        agentAliasId: agent.alias.trim(),
        sessionId: `test-session-${Date.now()}`,
        inputText: "Test connection",
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error(`Failed to connect to agent ${agent.name}:`, error);
      return false;
    }
  }

  selectBestAgent(analysisResult: AnalysisResult): BedrockAgent {
    const subject = analysisResult.analysis.subject.toLowerCase();
    const topics = analysisResult.analysis.topics.map(topic => topic.toLowerCase());
    
    console.log('Selecting agent for subject:', subject);
    console.log('Available agents:');
    this.agents.forEach(agent => {
      console.log(`- ${agent.name}: ID=${agent.id}, subjects=${agent.subjects.join(', ')}`);
    });
    
    // Calculate relevance score for each agent
    const agentScores = this.agents.map(agent => {
      let score = 0;
      
      // Check if subject matches agent's specialization
      agent.subjects.forEach(agentSubject => {
        if (subject.includes(agentSubject) || agentSubject.includes(subject)) {
          score += 10;
        }
        
        // Check if any topics match
        topics.forEach(topic => {
          if (topic.includes(agentSubject) || agentSubject.includes(topic)) {
            score += 5;
          }
        });
      });
      
      return { agent, score };
    });
    
    // Sort by score and return the best match
    agentScores.sort((a, b) => b.score - a.score);
    
    console.log('Agent scores:', agentScores.map(as => ({ name: as.agent.name, score: as.score, id: as.agent.id })));
    
    // If no good match found, use general agent
    const bestMatch = agentScores[0];
    if (bestMatch.score === 0) {
      const fallbackAgent = this.agents.find(agent => agent.name.includes('General')) || this.agents[0];
      console.log('No good match found, using fallback agent:', fallbackAgent?.name, 'ID:', fallbackAgent?.id);
      if (!fallbackAgent) {
        throw new Error('No valid agents available');
      }
      return fallbackAgent;
    }
    
    console.log('Selected best agent:', bestMatch.agent.name, 'ID:', bestMatch.agent.id, 'Score:', bestMatch.score);
    return bestMatch.agent;
  }

  async generateQuestionPaper(
    analysisResult: AnalysisResult, 
    selectedAgent: BedrockAgent
  ): Promise<QuestionPaper> {
    // Always try Bedrock first, even if isBedrockAvailable is false, to get actual error
    console.log('� Attempting to use AWS Bedrock for question paper generation...');
    console.log('🔍 Bedrock availability flag:', this.isBedrockAvailable);
    console.log('🤖 Selected agent:', selectedAgent.name, 'ID:', selectedAgent.id);

    try {
      // Validate agent ID
      if (!selectedAgent.id || selectedAgent.id.trim() === '') {
        throw new Error(`Invalid agent ID: ${selectedAgent.id}. Agent: ${selectedAgent.name}`);
      }

      // Validate agent alias
      if (!selectedAgent.alias || selectedAgent.alias.trim() === '') {
        throw new Error(`Invalid agent alias: ${selectedAgent.alias}. Agent: ${selectedAgent.name}`);
      }

      // Prepare the enhanced prompt for the Bedrock agent
      const enhancedPrompt = this.buildEnhancedPrompt(analysisResult);
      
      const command = new InvokeAgentCommand({
        agentId: selectedAgent.id.trim(),
        agentAliasId: selectedAgent.alias.trim(),
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        inputText: enhancedPrompt,
      });

      console.log('🤖 Invoking Bedrock agent:', selectedAgent.name);
      console.log('📊 Agent ID:', selectedAgent.id);
      console.log('🏷️ Agent Alias:', selectedAgent.alias);
      console.log('🔗 Session ID:', command.input.sessionId);
      console.log('📝 Prompt length:', enhancedPrompt.length);

      if (!this.client) {
        throw new Error('Bedrock client is not initialized');
      }

      const response = await this.client.send(command);
      
      // Process the response
      let generatedContent = '';
      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            const text = new TextDecoder().decode(chunk.chunk.bytes);
            generatedContent += text;
          }
        }
      }

      console.log('📄 Generated content length:', generatedContent.length);
      
      if (!generatedContent || generatedContent.trim().length === 0) {
        console.warn('⚠️ No content generated by Bedrock agent, using fallback');
        return this.createFallbackQuestionPaperFromAnalysis(analysisResult);
      }

      // Parse the generated content into a structured question paper
      const questionPaper = this.parseQuestionPaper(generatedContent, analysisResult, selectedAgent);
      
      console.log('✅ Successfully generated question paper with Bedrock');
      return questionPaper;
      
    } catch (error) {
      console.error('❌ Error generating question paper with Bedrock:', error);
      
      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      
      // Always fallback to local generation for any Bedrock error
      console.warn('🔄 Falling back to local question paper generation due to Bedrock error');
      return this.createFallbackQuestionPaperFromAnalysis(analysisResult);
    }
  }

  // Create a fallback question paper when Bedrock is not available
  private createFallbackQuestionPaperFromAnalysis(analysisResult: AnalysisResult): QuestionPaper {
    const analysis = analysisResult.analysis;
    
    // Use parsed requirements if available, otherwise create default structure
    let requirements: any = analysis.parsedRequirements;
    
    // If no parsed requirements, try to use paper pattern
    if (!requirements && analysisResult.paperPattern) {
      const pattern = analysisResult.paperPattern;
      requirements = {
        examDuration: pattern.examDuration || '3 hours',
        totalMarks: pattern.totalMarks ? parseInt(pattern.totalMarks.toString()) : 100,
        sections: pattern.sections?.map((section: any) => ({
          name: section.sectionName || section.name || 'Section A',
          questions: section.questions || 5,
          marksPerQuestion: section.marksPerQuestion || 20,
          totalMarks: section.totalMarks || 100,
          questionType: section.questionType || 'Short Answer'
        })) || [{
          name: 'Section A',
          questions: 5,
          marksPerQuestion: 20,
          totalMarks: 100,
          questionType: 'Short Answer'
        }]
      };
    }
    
    // Final fallback to default structure
    if (!requirements) {
      requirements = {
        examDuration: '3 hours',
        totalMarks: 100,
        sections: [{
          name: 'Section A',
          questions: 5,
          marksPerQuestion: 20,
          totalMarks: 100,
          questionType: 'Short Answer'
        }]
      };
    }
    
    console.log('📋 Using requirements for fallback generation:', requirements);
    
    return {
      title: `${analysis.subject} Question Paper`,
      subject: analysis.subject,
      duration: requirements.examDuration || '3 hours',
      totalMarks: requirements.totalMarks || 100,
      timestamp: new Date().toISOString(),
      generatedBy: 'Fallback Generator (Following User Requirements)',
      instructions: [
        'Read all instructions carefully before attempting the questions.',
        'Attempt all questions.',
        'Show all calculations clearly.',
        'Use diagrams where appropriate.',
        'Manage your time effectively.'
      ],
      sections: (requirements.sections || []).map((section: any, sectionIndex: number) => ({
        sectionName: section.name || `Section ${String.fromCharCode(65 + sectionIndex)}`,
        instructions: section.instructions || `Answer all questions from this section. Each question carries ${section.marksPerQuestion || 20} marks.`,
        totalMarks: section.totalMarks || 100,
        questions: this.generateFallbackQuestions(analysis, section)
      }))
    };
  }

  private generateFallbackQuestions(analysis: any, section: any): Question[] {
    const questions: Question[] = [];
    const extractedQuestions = analysis.extractedQuestions || [];
    const numberOfQuestions = section.questions || 5;
    const marksPerQuestion = section.marksPerQuestion || 20;
    const questionType = section.questionType || 'Short Answer';
    
    console.log(`📝 Generating ${numberOfQuestions} questions of ${marksPerQuestion} marks each (${questionType} type)`);
    
    for (let i = 0; i < numberOfQuestions; i++) {
      const questionNumber = i + 1;
      
      // Use extracted questions if available, otherwise create based on topics
      let questionText = '';
      if (i < extractedQuestions.length) {
        // Clean up extracted question text
        questionText = extractedQuestions[i]
          .replace(/^\d+[a-z]?\)\s*/, '') // Remove question numbering
          .replace(/\(\d+\s*m(arks?)?\)/gi, '') // Remove marks notation
          .replace(/\[\d+\s*m(arks?)?\]/gi, '') // Remove square bracket marks
          .trim();
      } else {
        // Generate questions based on topics and difficulty
        const topic = analysis.topics[i % analysis.topics.length];
        const difficultyLevel = analysis.difficulty || 'medium';
        
        // Create questions appropriate to the question type and difficulty
        switch (questionType.toLowerCase()) {
          case 'mcq':
          case 'multiple choice':
            questionText = `Which of the following best describes the concept of ${topic}?`;
            break;
          case 'short answer':
            if (difficultyLevel === 'easy') {
              questionText = `Define ${topic} and state its key characteristics.`;
            } else if (difficultyLevel === 'hard' || difficultyLevel === 'expert') {
              questionText = `Critically analyze the significance of ${topic} in modern applications.`;
            } else {
              questionText = `Explain the concept of ${topic} with relevant examples.`;
            }
            break;
          case 'long answer':
          case 'essay':
            if (difficultyLevel === 'easy') {
              questionText = `Discuss the fundamental principles of ${topic} with examples.`;
            } else if (difficultyLevel === 'hard' || difficultyLevel === 'expert') {
              questionText = `Provide a comprehensive analysis of ${topic}, including its theoretical foundations, practical applications, and future implications.`;
            } else {
              questionText = `Explain the theory and applications of ${topic} in detail.`;
            }
            break;
          case 'numerical':
            questionText = `Solve a numerical problem related to ${topic} showing all steps.`;
            break;
          default:
            questionText = `Explain the concept of ${topic} with relevant examples and applications.`;
        }
      }
      
      // Create question object with proper typing
      const question: Question = {
        questionNumber: questionNumber,
        question: questionText,
        marks: marksPerQuestion,
        questionType: questionType as Question['questionType'],
        bloomLevel: this.getBloomLevel(analysis.difficulty || 'medium', questionType)
      };
      
      // Add MCQ options if needed
      if (questionType.toLowerCase().includes('mcq') || questionType.toLowerCase().includes('multiple choice')) {
        question.options = [
          'Option A - First possible answer',
          'Option B - Second possible answer', 
          'Option C - Third possible answer',
          'Option D - Fourth possible answer'
        ];
        question.correctAnswer = 'Option A';
      }
      
      questions.push(question);
    }
    
    console.log(`✅ Generated ${questions.length} questions for section`);
    return questions;
  }

  private getBloomLevel(difficulty: string, questionType: string): 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create' {
    const lowerType = questionType.toLowerCase();
    
    if (lowerType.includes('define') || lowerType.includes('mcq')) {
      return 'Remember';
    } else if (lowerType.includes('explain') || lowerType.includes('short')) {
      return difficulty === 'easy' ? 'Understand' : 'Apply';
    } else if (lowerType.includes('analyze') || lowerType.includes('compare')) {
      return 'Analyze';
    } else if (lowerType.includes('evaluate') || lowerType.includes('assess')) {
      return 'Evaluate';
    } else if (lowerType.includes('design') || lowerType.includes('create')) {
      return 'Create';
    } else {
      // Default based on difficulty
      switch (difficulty) {
        case 'easy': return 'Remember';
        case 'medium': return 'Understand';
        case 'hard': return 'Apply';
        case 'expert': return 'Analyze';
        default: return 'Understand';
      }
    }
  }

  private buildEnhancedPrompt(analysisResult: AnalysisResult): string {
    const { analysis, prompt, paperPattern } = analysisResult;
    const parsedRequirements = analysis.parsedRequirements;
    
    // Create structured JSON payload for Bedrock agent
    const bedrockPayload = {
      task: "GENERATE_QUESTION_PAPER",
      analysis: analysis,
      requirements: parsedRequirements,
      paperPattern: paperPattern,
      extractedContent: {
        questions: analysis.extractedQuestions || [],
        patterns: analysis.questionPatterns || [],
        topics: analysis.topics,
        subject: analysis.subject,
        difficulty: analysis.difficulty
      },
      outputFormat: {
        type: "STRUCTURED_JSON",
        includeLatex: true,
        includeMermaidGraphs: true,
        includeVisualization: true,
        supportedElements: [
          "mathematical_equations",
          "integrals",
          "derivatives", 
          "graphs",
          "tables",
          "diagrams",
          "charts",
          "chemical_formulas",
          "physics_diagrams"
        ]
      }
    };

    let enhancedPrompt = `
GENERATE QUESTION PAPER - FOLLOW USER REQUIREMENTS EXACTLY

CRITICAL: You MUST follow the exact pattern and requirements specified by the user. Do NOT deviate from:
- Number of questions per section
- Marks per question
- Question types specified
- Total marks
- Duration
- Section structure

USER'S SPECIFIC REQUIREMENTS:
${parsedRequirements ? JSON.stringify(parsedRequirements, null, 2) : 'No specific requirements parsed'}

USER'S PAPER PATTERN:
${paperPattern ? JSON.stringify(paperPattern, null, 2) : 'No paper pattern provided'}

EXTRACTED QUESTIONS FROM USER'S MATERIAL (Use these as reference for style and complexity):
${analysis.extractedQuestions ? analysis.extractedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'No extracted questions available'}

IDENTIFIED QUESTION PATTERNS (Follow these patterns exactly):
${analysis.questionPatterns ? analysis.questionPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'No specific patterns identified'}

MANDATORY RULES:
1. If user specifies "5 questions of 4 marks each" - generate EXACTLY 5 questions of 4 marks each
2. If user specifies section structure - follow the EXACT section structure
3. If user specifies question types - use ONLY those question types
4. If user specifies total marks - ensure total adds up to exactly that amount
5. If user specifies duration - use that exact duration
6. Maintain the same difficulty level and style as extracted questions
7. Use the same subject terminology and concepts from user's material

RESPONSE FORMAT:
Generate a JSON response with this EXACT structure:
{
  "title": "Use user's title or create based on subject",
  "subject": "Use exact subject from analysis",
  "duration": "Use exact duration from requirements",
  "totalMarks": "Use exact total marks from requirements",
  "timestamp": "Current ISO timestamp",
  "generatedBy": "AWS Bedrock Agent",
  "instructions": ["Follow user's instructions if provided, otherwise use standard"],
  "sections": [
    {
      "sectionName": "Use exact section names from user requirements",
      "instructions": "Follow user's section instructions",
      "totalMarks": "Calculate based on user's requirements",
      "questions": [
        {
          "questionNumber": 1,
          "question": "Generate based on user's content and style",
          "marks": "Use exact marks per question as specified by user",
          "questionType": "Use exact question type specified by user",
          "options": ["Only if MCQ"],
          "correctAnswer": "Only if MCQ",
          "answerKey": "Detailed solution",
          "bloomLevel": "Appropriate level"
        }
      ]
    }
  ]
}

SUBJECT: ${analysis.subject}
DIFFICULTY: ${analysis.difficulty}
TOPICS: ${analysis.topics.join(', ')}

PAYLOAD FOR PROCESSING:
${JSON.stringify(bedrockPayload, null, 2)}

Generate the question paper following the user's EXACT specifications. Do not add extra questions or change the structure.
${paperPattern ? JSON.stringify(paperPattern, null, 2) : 'Use standard academic format'}

OUTPUT REQUIREMENTS:
Generate a complete question paper as a JSON object with this EXACT structure:

{
  "questionPaper": {
    "title": "Complete Paper Title",
    "subject": "${analysis.subject}",
    "duration": "${paperPattern?.examDuration || '3 hours'}",
    "totalMarks": ${paperPattern?.totalMarks ? parseInt(paperPattern.totalMarks) : 100},
    "instructions": [
      "General instructions array"
    ],
    "sections": [
      {
        "sectionName": "Section A",
        "instructions": "Section specific instructions",
        "totalMarks": 25,
        "questions": [
          {
            "questionNumber": 1,
            "question": "Question text with mathematical content",
            "marks": 5,
            "questionType": "Mathematical|Graph|Diagram|Essay|MCQ|Short Answer|Long Answer",
            "mathContent": {
              "latex": "\\\\int_{0}^{\\\\infty} e^{-x^2} dx = \\\\frac{\\\\sqrt{\\\\pi}}{2}",
              "equations": ["E = mc^2", "F = ma"],
              "integrals": ["∫ x²dx = x³/3 + C"],
              "graphs": [
                {
                  "type": "function",
                  "title": "Graph Title",
                  "mathFunction": "f(x) = x^2 + 2x + 1",
                  "domain": [-5, 5],
                  "range": [-2, 10],
                  "mermaidCode": "graph TD\\\\n    A[Start] --> B[Process]\\\\n    B --> C[End]"
                }
              ],
              "tables": [
                {
                  "headers": ["X", "Y", "Z"],
                  "rows": [["1", "2", "3"], ["4", "5", "6"]],
                  "caption": "Data Table"
                }
              ]
            },
            "visualContent": {
              "diagrams": [
                {
                  "type": "flowchart",
                  "mermaidCode": "flowchart LR\\\\n    A --> B --> C",
                  "description": "Detailed description"
                }
              ],
              "charts": [
                {
                  "type": "bar",
                  "title": "Chart Title",
                  "labels": ["A", "B", "C"],
                  "datasets": [{
                    "label": "Dataset 1",
                    "data": [10, 20, 30],
                    "backgroundColor": ["#FF6384", "#36A2EB", "#FFCE56"]
                  }]
                }
              ]
            },
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "Option A",
            "answerKey": "Detailed solution with steps",
            "bloomLevel": "Apply"
          }
        ]
      }
    ],
    "answerKey": {
      "solutions": [
        {
          "questionNumber": 1,
          "solution": "Step-by-step solution with mathematical workings",
          "markingScheme": "1 mark for setup, 2 marks for calculation, 2 marks for final answer"
        }
      ]
    },
    "metadata": {
      "generatedBy": "AI Agent",
      "timestamp": "${new Date().toISOString()}",
      "difficulty": "${analysis.difficulty}",
      "estimatedTime": "${paperPattern?.examDuration || '3 hours'}"
    }
  }
}

MATHEMATICAL RENDERING GUIDELINES:
- Use LaTeX syntax: \\\\frac{a}{b}, \\\\int, \\\\sum, \\\\sqrt{}, \\\\alpha, \\\\beta
- Integrals: \\\\int_{a}^{b} f(x)dx
- Derivatives: \\\\frac{d}{dx}, \\\\frac{\\\\partial}{\\\\partial x}
- Matrices: \\\\begin{pmatrix} a & b \\\\\\\\ c & d \\\\end{pmatrix}
- Chemical: H_2SO_4, CO_2, NaOH

MERMAID GRAPH EXAMPLES:
- Flowchart: flowchart TD\\\\nA[Start] --> B{Decision}\\\\nB -->|Yes| C[Process]\\\\nB -->|No| D[End]
- Graph: graph LR\\\\nA --> B --> C
- Sequence: sequenceDiagram\\\\nAlice->>Bob: Hello

ENSURE:
1. All mathematical content is properly formatted with LaTeX
2. All graphs/diagrams include Mermaid code
3. Tables are well-structured
4. Questions match the extracted patterns exactly
5. Proper JSON structure without syntax errors
6. Complete answer keys with detailed solutions
7. Appropriate difficulty progression
8. Cover all specified topics comprehensively

Generate the most accurate, examination-worthy question paper that closely matches real academic standards and the provided reference materials.
    `;

    return enhancedPrompt.trim();
  }

  private fixTruncatedJSON(jsonString: string): string {
    // Remove any trailing commas before closing brackets/braces
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    
    // Count open and close braces/brackets
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/\]/g) || []).length;
    
    console.log(`📄 JSON structure check: {${openBraces}/${closeBraces}} [${openBrackets}/${closeBrackets}]`);
    
    // If JSON is truncated, try to close it properly
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      console.log('📄 Detected truncated JSON, attempting to fix...');
      
      let fixed = jsonString.trim();
      
      // Remove any incomplete trailing content
      // Look for incomplete structures at the end
      const lines = fixed.split('\n');
      let lastCompleteLineIndex = lines.length - 1;
      
      // Work backwards to find the last complete line
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        // If line ends with comma, colon, complete string, or closing bracket/brace - it's likely complete
        if (line.endsWith(',') || line.endsWith(':') || line.endsWith('"') || 
            line.endsWith('}') || line.endsWith(']') || line === '') {
          lastCompleteLineIndex = i;
          break;
        }
      }
      
      // Reconstruct from complete lines
      if (lastCompleteLineIndex < lines.length - 1) {
        fixed = lines.slice(0, lastCompleteLineIndex + 1).join('\n');
        console.log('📄 Removed incomplete trailing content');
      }
      
      // Remove trailing comma if present
      fixed = fixed.replace(/,\s*$/, '');
      
      // Add missing closing brackets
      const stillOpenBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < stillOpenBrackets; i++) {
        fixed += ']';
      }
      
      // Add missing closing braces
      const stillOpenBraces = (fixed.match(/{/g) || []).length - (fixed.match(/}/g) || []).length;
      for (let i = 0; i < stillOpenBraces; i++) {
        fixed += '}';
      }
      
      console.log('📄 Fixed JSON structure');
      return fixed;
    }
    
    return jsonString;
  }

  private parseQuestionPaper(
    generatedContent: string, 
    analysisResult: AnalysisResult, 
    selectedAgent: BedrockAgent
  ): QuestionPaper {
    try {
      console.log('🔍 Raw Bedrock Response:', generatedContent.substring(0, 500), '...');
      
      // Try to parse the JSON response from Bedrock
      let parsedResponse;
      try {
        // Multiple strategies to extract JSON
        let jsonString = generatedContent;
        
        // Strategy 1: Look for JSON object wrapped in text
        let jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log('📦 Found JSON match:', jsonString.substring(0, 200), '...');
        }
        
        // Strategy 2: Look for questionPaper object specifically
        let questionPaperMatch = null;
        if (!jsonMatch) {
          questionPaperMatch = generatedContent.match(/"questionPaper"\s*:\s*\{[\s\S]*?\}\s*\}/);
          if (questionPaperMatch) {
            jsonString = `{${questionPaperMatch[0]}}`;
            console.log('📋 Found questionPaper match');
          }
        }
        
        // Strategy 3: Try to fix and extract if it starts with question content
        if (!jsonMatch && !questionPaperMatch) {
          console.log('🔧 Attempting text-to-JSON conversion...');
          return this.parseTextResponseToQuestionPaper(generatedContent, analysisResult, selectedAgent);
        }
        
        // Fix common JSON issues before parsing
        jsonString = this.fixTruncatedJSON(jsonString);
        
        parsedResponse = JSON.parse(jsonString);
        console.log('✅ Successfully parsed JSON response');
        
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.log('🔄 Falling back to text parsing...');
        return this.parseTextResponseToQuestionPaper(generatedContent, analysisResult, selectedAgent);
      }

      // Extract the question paper from the parsed response
      const questionPaperData = parsedResponse.questionPaper || parsedResponse;
      
      return {
        title: questionPaperData.title || `${analysisResult.analysis.subject} Question Paper`,
        subject: questionPaperData.subject || analysisResult.analysis.subject,
        duration: questionPaperData.duration || analysisResult.paperPattern?.examDuration || '3 hours',
        totalMarks: questionPaperData.totalMarks || parseInt(analysisResult.paperPattern?.totalMarks || '100'),
        sections: this.parseSections(questionPaperData.sections || []),
        instructions: questionPaperData.instructions || this.extractInstructions(generatedContent),
        generatedBy: selectedAgent.name,
        timestamp: new Date().toISOString(),
        answerKey: questionPaperData.answerKey,
        metadata: questionPaperData.metadata || {
          generatedBy: selectedAgent.name,
          timestamp: new Date().toISOString(),
          difficulty: analysisResult.analysis.difficulty,
          estimatedTime: analysisResult.paperPattern?.examDuration || '3 hours'
        }
      };
    } catch (error) {
      console.error('Error parsing question paper:', error);
      return this.createFallbackQuestionPaperFromContent(generatedContent, analysisResult, selectedAgent);
    }
  }

  private parseSections(sectionsData: any[]): QuestionSection[] {
    return sectionsData.map(section => ({
      sectionName: section.sectionName || 'Section',
      instructions: section.instructions || 'Answer all questions in this section',
      questions: this.parseQuestions(section.questions || []),
      totalMarks: section.totalMarks || section.questions?.reduce((sum: number, q: any) => sum + (q.marks || 0), 0) || 0
    }));
  }

  private parseQuestions(questionsData: any[]): Question[] {
    return questionsData.map(q => ({
      questionNumber: q.questionNumber || 1,
      question: q.question || 'Question text',
      marks: q.marks || 1,
      questionType: q.questionType || 'Short Answer',
      options: q.options,
      correctAnswer: q.correctAnswer,
      answerKey: q.answerKey,
      bloomLevel: q.bloomLevel,
      mathContent: q.mathContent,
      visualContent: q.visualContent
    }));
  }

  private parseTextResponseToQuestionPaper(
    content: string,
    analysisResult: AnalysisResult,
    selectedAgent: BedrockAgent
  ): QuestionPaper {
    console.log('� Parsing text response to question paper...');
    console.log('📄 Content preview:', content.substring(0, 500) + '...');
    
    const title = `${analysisResult.analysis.subject} Question Paper - ${selectedAgent.name}`;
    const duration = analysisResult.paperPattern?.examDuration || '3 hours';
    const totalMarks = parseInt(analysisResult.paperPattern?.totalMarks || '100');
    
    const sections: QuestionSection[] = [];
    let currentSection: QuestionSection | null = null;
    let questionCounter = 1;
    
    // Split content into lines and clean them
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Enhanced patterns to identify different elements
    const sectionPattern = /^(Section\s+[A-Z]|Part\s+[A-Z]|Chapter\s+\d+|Unit\s+\d+|Section\s+\d+)(?:\s*[-:]?\s*(.*))?/i;
    const questionPatterns = [
      /^(\d+)[\.\)]\s*(.+)/,                    // 1. Question text
      /^Q[\.\s]*(\d+)[\.\):]?\s*(.+)/i,         // Q1. Question text
      /^Question\s*(\d+)[\.\):]?\s*(.+)/i,      // Question 1: text
      /^\[(\d+)\]\s*(.+)/,                      // [1] Question text
      /^(\d+)\s*[-–]\s*(.+)/                    // 1 - Question text
    ];
    
    // Question content patterns (for unnumbered questions)
    const questionContentPatterns = [
      /what\s+(?:is|are|do|does|can|will|would|should)/i,
      /how\s+(?:do|does|can|will|would|should|to)/i,
      /why\s+(?:is|are|do|does|did|can|will|would|should)/i,
      /when\s+(?:is|are|do|does|did|can|will|would|should)/i,
      /where\s+(?:is|are|do|does|did|can|will|would|should)/i,
      /which\s+(?:is|are|do|does|did|can|will|would|should)/i,
      /explain\s+(?:the|how|why|what|when|where)/i,
      /describe\s+(?:the|how|why|what|when|where)/i,
      /define\s+(?:the|what)/i,
      /calculate\s+(?:the|what)/i,
      /solve\s+(?:the|for)/i,
      /find\s+(?:the|what)/i,
      /derive\s+(?:the|an|a)/i,
      /prove\s+(?:that|the)/i,
      /discuss\s+(?:the|how|why)/i,
      /analyze\s+(?:the|how|why)/i,
      /compare\s+(?:and|the)/i,
      /contrast\s+(?:the|with)/i,
      /evaluate\s+(?:the|how)/i,
      /\?$/                                     // Ends with question mark
    ];
    
    console.log(`📊 Processing ${lines.length} lines of content...`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines or very short lines
      if (trimmedLine.length < 5) continue;
      
      // Check for section headers
      const sectionMatch = trimmedLine.match(sectionPattern);
      if (sectionMatch) {
        console.log(`📑 Found section: ${trimmedLine}`);
        // Save previous section if it exists
        if (currentSection && currentSection.questions.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          sectionName: trimmedLine,
          instructions: '',
          questions: [],
          totalMarks: 0
        };
        continue;
      }
      
      // Check for numbered questions using multiple patterns
      let questionFound = false;
      for (const pattern of questionPatterns) {
        const questionMatch = trimmedLine.match(pattern);
        if (questionMatch && questionMatch[2] && questionMatch[2].trim().length > 10) {
          console.log(`❓ Found numbered question: ${questionMatch[1]} - ${questionMatch[2].substring(0, 50)}...`);
          
          if (!currentSection) {
            currentSection = {
              sectionName: 'Section A',
              instructions: `Answer all questions. Each question carries ${analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4} marks.`,
              questions: [],
              totalMarks: 0
            };
          }
          
          // Check if next lines are part of this question (multi-line questions)
          let fullQuestion = questionMatch[2].trim();
          let nextLineIndex = i + 1;
          while (nextLineIndex < lines.length) {
            const nextLine = lines[nextLineIndex].trim();
            // If next line looks like a new question or section, stop
            if (nextLine.match(/^\d+[\.\)]/)) break;
            if (nextLine.match(sectionPattern)) break;
            if (nextLine.length < 5) break;
            
            // If it looks like continuation of the question
            if (nextLine.length > 10 && !nextLine.match(/^[A-Z][a-z]*\s*:/) && !nextLine.includes('marks')) {
              fullQuestion += ' ' + nextLine;
              i = nextLineIndex; // Skip this line in main loop
              nextLineIndex++;
            } else {
              break;
            }
          }
          
          const question: Question = {
            questionNumber: parseInt(questionMatch[1]) || questionCounter++,
            question: fullQuestion,
            marks: this.extractMarksFromQuestion(fullQuestion) || (analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4),
            questionType: this.determineQuestionTypeFromContent(fullQuestion)
          };
          
          currentSection.questions.push(question);
          currentSection.totalMarks += question.marks;
          questionFound = true;
          break;
        }
      }
      
      if (questionFound) continue;
      
      // Check for unnumbered questions using content patterns
      const isQuestionContent = questionContentPatterns.some(pattern => 
        trimmedLine.match(pattern)
      );
      
      if (isQuestionContent && trimmedLine.length > 15) {
        console.log(`❓ Found unnumbered question: ${trimmedLine.substring(0, 50)}...`);
        
        if (!currentSection) {
          currentSection = {
            sectionName: 'General Questions',
            instructions: `Answer all questions. Each question carries ${analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4} marks.`,
            questions: [],
            totalMarks: 0
          };
        }
        
        const question: Question = {
          questionNumber: questionCounter++,
          question: trimmedLine,
          marks: this.extractMarksFromQuestion(trimmedLine) || (analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4),
          questionType: this.determineQuestionTypeFromContent(trimmedLine)
        };
        
        currentSection.questions.push(question);
        currentSection.totalMarks += question.marks;
      }
    }
    
    // Add the last section if it exists
    if (currentSection && currentSection.questions.length > 0) {
      sections.push(currentSection);
    }
    
    // Check if we have enough questions based on user requirements
    const expectedQuestions = analysisResult.analysis.parsedRequirements?.totalQuestions || 5;
    const expectedMarksPerQuestion = analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4;
    let totalQuestionsFound = sections.reduce((sum, s) => sum + s.questions.length, 0);
    
    if (totalQuestionsFound < expectedQuestions) {
      console.log(`⚠️ Found only ${totalQuestionsFound} questions, need ${expectedQuestions}. Extracting more...`);
      
      // Split content into paragraphs and look for question-like sentences
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      const additionalQuestions: Question[] = [];
      
      for (const paragraph of paragraphs) {
        if (additionalQuestions.length >= (expectedQuestions - totalQuestionsFound)) break;
        
        const sentences = paragraph.split(/[.!]/).filter(s => s.trim().length > 15);
        
        for (const sentence of sentences) {
          if (additionalQuestions.length >= (expectedQuestions - totalQuestionsFound)) break;
          
          const trimmedSentence = sentence.trim();
          if (questionContentPatterns.some(pattern => trimmedSentence.match(pattern))) {
            additionalQuestions.push({
              questionNumber: totalQuestionsFound + additionalQuestions.length + 1,
              question: trimmedSentence.endsWith('?') ? trimmedSentence : trimmedSentence + '?',
              marks: expectedMarksPerQuestion,
              questionType: this.determineQuestionTypeFromContent(trimmedSentence)
            });
          }
        }
      }
      
      // If we still need more questions, create them from the topics
      if (additionalQuestions.length < (expectedQuestions - totalQuestionsFound)) {
        const topics = analysisResult.analysis.topics || ['General Topic'];
        const remainingQuestions = expectedQuestions - totalQuestionsFound - additionalQuestions.length;
        
        for (let i = 0; i < remainingQuestions; i++) {
          const topic = topics[i % topics.length];
          additionalQuestions.push({
            questionNumber: totalQuestionsFound + additionalQuestions.length + 1,
            question: `Explain the concept of ${topic} with suitable examples.`,
            marks: expectedMarksPerQuestion,
            questionType: 'Short Answer'
          });
        }
      }
      
      if (additionalQuestions.length > 0) {
        console.log(`✅ Added ${additionalQuestions.length} additional questions to meet requirements`);
        const existingSection = sections.find(s => s.sectionName.includes('General') || s.sectionName.includes('Section A'));
        if (existingSection) {
          existingSection.questions.push(...additionalQuestions);
          existingSection.totalMarks += additionalQuestions.reduce((sum, q) => sum + q.marks, 0);
        } else {
          sections.push({
            sectionName: 'Additional Questions',
            instructions: `Answer all questions. Each question carries ${expectedMarksPerQuestion} marks.`,
            questions: additionalQuestions,
            totalMarks: additionalQuestions.reduce((sum, q) => sum + q.marks, 0)
          });
        }
      }
      
      // Update total count
      totalQuestionsFound = sections.reduce((sum, s) => sum + s.questions.length, 0);
    }
    
    // Enhanced fallback: if no clear questions found, try to extract from paragraphs
    if (sections.length === 0 || sections.every(s => s.questions.length === 0)) {
      console.log('⚠️ No clear questions found, trying paragraph extraction...');
      
      // Split content into paragraphs and look for question-like sentences
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      const extractedQuestions: Question[] = [];
      
      for (const paragraph of paragraphs) {
        const sentences = paragraph.split(/[.!]/).filter(s => s.trim().length > 15);
        
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (questionContentPatterns.some(pattern => trimmedSentence.match(pattern))) {
            extractedQuestions.push({
              questionNumber: extractedQuestions.length + 1,
              question: trimmedSentence.endsWith('?') ? trimmedSentence : trimmedSentence + '?',
              marks: analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4,
              questionType: this.determineQuestionTypeFromContent(trimmedSentence)
            });
          }
        }
      }
      
      if (extractedQuestions.length > 0) {
        console.log(`✅ Extracted ${extractedQuestions.length} questions from paragraphs`);
        sections.push({
          sectionName: 'Extracted Questions',
          instructions: 'Answer all questions based on the provided content.',
          questions: extractedQuestions,
          totalMarks: extractedQuestions.reduce((sum, q) => sum + q.marks, 0)
        });
      } else {
        // Last resort: create questions from the raw content
        console.log('⚠️ Creating fallback questions from content...');
        const contentLines = content.split('\n').filter(line => line.trim().length > 30);
        const fallbackQuestions: Question[] = [];
        
        contentLines.slice(0, 5).forEach((line, index) => {
          if (line.trim().length > 20) {
            fallbackQuestions.push({
              questionNumber: index + 1,
              question: `Explain the following concept: "${line.trim().substring(0, 100)}${line.trim().length > 100 ? '...' : ''}"`,
              marks: analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4,
              questionType: 'Long Answer'
            });
          }
        });
        
        sections.push({
          sectionName: 'Content-Based Questions',
          instructions: 'Answer all questions based on your understanding of the provided material.',
          questions: fallbackQuestions,
          totalMarks: fallbackQuestions.reduce((sum, q) => sum + q.marks, 0)
        });
      }
    }
    
    const finalQuestionCount = sections.reduce((sum, s) => sum + s.questions.length, 0);
    console.log(`✅ Parsed ${sections.length} sections with ${finalQuestionCount} questions from text`);
    
    return {
      title,
      subject: analysisResult.analysis.subject,
      duration,
      totalMarks: sections.reduce((sum, s) => sum + s.totalMarks, 0) || (analysisResult.analysis.parsedRequirements?.totalMarks || (finalQuestionCount * (analysisResult.analysis.parsedRequirements?.marksPerQuestion || 4))),
      sections,
      instructions: [
        'Read all questions carefully before attempting.',
        'Answer all questions unless otherwise specified.',
        'Write clearly and manage your time effectively.',
        'Show all working where applicable.'
      ],
      generatedBy: selectedAgent.name,
      timestamp: new Date().toISOString(),
      metadata: {
        generatedBy: selectedAgent.name,
        timestamp: new Date().toISOString(),
        difficulty: analysisResult.analysis.difficulty,
        estimatedTime: duration
      }
    };
  }
  
  private extractMarksFromQuestion(questionText: string): number {
    const marksPattern = /\[(\d+)\s*marks?\]|\((\d+)\s*marks?\)|(\d+)\s*marks?/i;
    const match = questionText.match(marksPattern);
    if (match) {
      return parseInt(match[1] || match[2] || match[3]);
    }
    
    // Determine marks based on question type/length
    if (questionText.length > 200) return 20;
    if (questionText.length > 100) return 15;
    return 10;
  }
  
  private determineQuestionTypeFromContent(questionText: string): Question['questionType'] {
    const text = questionText.toLowerCase();
    
    if (text.includes('multiple choice') || text.includes('choose') || text.includes('select')) {
      return 'MCQ';
    } else if (text.includes('calculate') || text.includes('solve') || text.includes('find the value')) {
      return 'Numerical';
    } else if (text.includes('explain in detail') || text.includes('discuss') || text.includes('analyze') || text.length > 150) {
      return 'Long Answer';
    } else if (text.includes('define') || text.includes('what is') || text.includes('list')) {
      return 'Short Answer';
    }
    
    return 'Short Answer';
  }

  private createFallbackQuestionPaperFromContent(
    content: string, 
    analysisResult: AnalysisResult, 
    selectedAgent: BedrockAgent
  ): QuestionPaper {
    // Create a basic question paper structure if parsing fails
    const lines = content.split('\n').filter(line => line.trim());
    
    return {
      title: `${analysisResult.analysis.subject} Question Paper`,
      subject: analysisResult.analysis.subject,
      duration: analysisResult.paperPattern?.examDuration || '3 hours',
      totalMarks: parseInt(analysisResult.paperPattern?.totalMarks || '100'),
      sections: this.extractSections(content, analysisResult),
      instructions: this.extractInstructions(content),
      generatedBy: selectedAgent.name,
      timestamp: new Date().toISOString()
    };
  }

  private extractSections(content: string, analysisResult: AnalysisResult): QuestionSection[] {
    // This is a simplified extraction - enhance based on actual response format
    const sections: QuestionSection[] = [];
    
    if (analysisResult.paperPattern?.sections) {
      analysisResult.paperPattern.sections.forEach((section, index) => {
        const questions: Question[] = [];
        
        // Generate sample questions based on the section
        for (let i = 1; i <= section.questions; i++) {
          questions.push({
            questionNumber: i,
            question: `Question ${i} for ${section.sectionName}`,
            marks: section.marksPerQuestion,
            questionType: this.determineQuestionType(section.sectionName),
          });
        }
        
        sections.push({
          sectionName: section.sectionName,
          instructions: section.instructions,
          questions,
          totalMarks: section.totalMarks
        });
      });
    }
    
    return sections;
  }

  private extractInstructions(content: string): string[] {
    // Extract general instructions from the generated content
    const instructions = [
      'Read all instructions carefully before attempting the questions.',
      'All questions are compulsory unless otherwise specified.',
      'Write clearly and legibly.',
      'Manage your time effectively.'
    ];
    
    return instructions;
  }

  private determineQuestionType(sectionName: string): Question['questionType'] {
    const sectionLower = sectionName.toLowerCase();
    
    if (sectionLower.includes('multiple choice') || sectionLower.includes('mcq')) {
      return 'MCQ';
    } else if (sectionLower.includes('short')) {
      return 'Short Answer';
    } else if (sectionLower.includes('long') || sectionLower.includes('essay')) {
      return 'Long Answer';
    } else if (sectionLower.includes('numerical')) {
      return 'Numerical';
    }
    
    return 'Short Answer';
  }

  getAvailableAgents(): BedrockAgent[] {
    return this.agents;
  }

  // Flashcard generation method using Bedrock agent
  async generateFlashCards(
    analysisResult: AnalysisResult,
    agentId?: string
  ): Promise<BedrockFlashCardSet> {
    console.log('🎴 Attempting to generate flashcards with AWS Bedrock...');
    
    try {
      // Select appropriate agent for flashcard generation
      let selectedAgent: BedrockAgent;
      
      if (agentId) {
        // Use specific agent ID provided by user
        const customAgent = this.agents.find(agent => agent.id === agentId);
        if (!customAgent) {
          throw new Error(`Agent with ID ${agentId} not found`);
        }
        selectedAgent = customAgent;
      } else {
        // Auto-select best agent based on subject
        selectedAgent = this.selectBestAgent(analysisResult);
      }

      console.log('🤖 Selected agent for flashcards:', selectedAgent.name, 'ID:', selectedAgent.id);

      if (!this.client) {
        throw new Error('Bedrock client is not initialized');
      }

      // Build the enhanced prompt for flashcard generation
      const flashCardPrompt = this.buildFlashCardPrompt(analysisResult);
      
      const command = new InvokeAgentCommand({
        agentId: selectedAgent.id.trim(),
        agentAliasId: selectedAgent.alias.trim(),
        sessionId: `flashcard-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        inputText: flashCardPrompt,
      });

      console.log('🎴 Invoking Bedrock agent for flashcard generation...');
      console.log('📝 Prompt length:', flashCardPrompt.length);

      const response = await this.client.send(command);
      
      // Process the response
      let generatedContent = '';
      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            const text = new TextDecoder().decode(chunk.chunk.bytes);
            generatedContent += text;
          }
        }
      }

      console.log('📄 Generated flashcard content length:', generatedContent.length);
      
      if (!generatedContent || generatedContent.trim().length === 0) {
        console.warn('⚠️ No flashcard content generated by Bedrock agent, using fallback');
        return this.createFallbackFlashCardSet(analysisResult);
      }

      // Parse the generated content into structured flashcards
      const flashCardSet = this.parseFlashCardSet(generatedContent, analysisResult, selectedAgent);
      
      console.log('✅ Successfully generated flashcard set with Bedrock');
      console.log(`🎴 Generated ${flashCardSet.totalCards} flashcards`);
      
      return flashCardSet;
      
    } catch (error) {
      console.error('❌ Error generating flashcards with Bedrock:', error);
      
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      
      // Fallback to local generation
      console.warn('🔄 Falling back to local flashcard generation due to Bedrock error');
      return this.createFallbackFlashCardSet(analysisResult);
    }
  }

  private buildFlashCardPrompt(analysisResult: AnalysisResult): string {
    const { analysis, threePrompts } = analysisResult;
    
    // Use Gemini's specific flashcard prompt from the three-prompt system, with fallback
    let geminiFlashCardPrompt: string;
    
    if (threePrompts && threePrompts.flashCardPrompt) {
      geminiFlashCardPrompt = threePrompts.flashCardPrompt;
    } else {
      // Fallback prompt for older sessions or missing data
      geminiFlashCardPrompt = `Create educational flashcards from the content about ${analysis.subject}. Each flashcard should have a clear question/term on the front and a comprehensive answer/definition on the back. Focus on key concepts, important terms, and critical information.`;
    }
    
    // Create structured JSON payload for Bedrock agent that incorporates Gemini's prompt
    const bedrockFlashCardPayload = {
      task: "GENERATE_MERMAID_FLASHCARDS",
      geminiPrompt: geminiFlashCardPrompt,
      analysis: analysis,
      extractedContent: {
        questions: analysis.extractedQuestions || [],
        patterns: analysis.questionPatterns || [],
        topics: analysis.topics,
        subject: analysis.subject,
        difficulty: analysis.difficulty
      },
      requirements: {
        cardCount: "15-25",
        includeMermaid: true,
        difficultyLevels: ['easy', 'medium', 'hard'],
        cardTypes: ['definition', 'concept', 'formula', 'process', 'diagram', 'example'],
        visualEnhancement: true,
        useGeminiPrompt: true
      },
      outputFormat: {
        type: "STRUCTURED_JSON",
        includeMermaidDiagrams: true,
        includeVisualElements: true,
        includeHints: true,
        includeRelatedConcepts: true
      }
    };

    return `
FLASHCARD GENERATION REQUEST:

Primary Prompt from Gemini Analysis:
${geminiFlashCardPrompt}

Additional Context:
${JSON.stringify(bedrockFlashCardPayload, null, 2)}

INSTRUCTIONS:
Use the Gemini prompt as your primary guide for content creation, and supplement it with the additional context provided. Generate high-quality interactive flashcards with Mermaid diagrams based on the combined analysis.

Key Requirements:
1. Follow the Gemini prompt guidelines for content and structure
2. Create 15-25 comprehensive flashcards covering all major topics
3. Include relevant Mermaid diagrams for visual learning
4. Use various diagram types: flowcharts, graphs, mind maps, sequences
5. Balance difficulty levels appropriately
6. Provide clear learning objectives and helpful hints
7. Ensure all Mermaid code is syntactically correct

Focus on creating flashcards that enhance understanding through visual learning and proper knowledge assessment while staying true to the Gemini prompt's intent.
    `.trim();
  }

  private parseFlashCardSet(
    content: string, 
    analysisResult: AnalysisResult, 
    selectedAgent: BedrockAgent
  ): BedrockFlashCardSet {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const cleanedContent = jsonMatch[0]
          .replace(/```json\n?|\n?```/g, '')
          .replace(/```\n?|\n?```/g, '');
        
        const parsed = JSON.parse(cleanedContent);
        
        // Validate and enhance the parsed result
        return {
          title: parsed.title || `Interactive Flashcards for ${analysisResult.analysis.subject}`,
          subject: parsed.subject || analysisResult.analysis.subject,
          cards: this.validateAndEnhanceCards(parsed.cards || []),
          totalCards: parsed.totalCards || parsed.cards?.length || 0,
          estimatedStudyTime: parsed.estimatedStudyTime || this.calculateStudyTime(parsed.cards?.length || 0),
          difficultyDistribution: parsed.difficultyDistribution || this.calculateDifficultyDistribution(parsed.cards || []),
          topicCoverage: parsed.topicCoverage || analysisResult.analysis.topics,
          mermaidTypes: parsed.mermaidTypes || ['flowchart', 'graph', 'mindmap'],
          generatedBy: `Bedrock Agent: ${selectedAgent.name}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (parseError) {
      console.error('Failed to parse Bedrock flashcard response:', parseError);
    }
    
    // If parsing fails, create from analysis
    return this.createFallbackFlashCardSet(analysisResult);
  }

  private validateAndEnhanceCards(cards: any[]): BedrockFlashCard[] {
    return cards.map((card, index) => ({
      id: card.id || `bedrock_card_${index + 1}`,
      front: card.front || 'Question not available',
      back: card.back || 'Answer not available',
      topic: card.topic || 'General',
      difficulty: this.validateDifficulty(card.difficulty),
      type: this.validateCardType(card.type),
      mermaidDiagram: card.mermaidDiagram ? {
        type: this.validateMermaidType(card.mermaidDiagram.type),
        code: card.mermaidDiagram.code || '',
        description: card.mermaidDiagram.description || ''
      } : undefined,
      visualElements: {
        hasFormula: card.visualElements?.hasFormula || false,
        hasChart: card.visualElements?.hasChart || false,
        hasDiagram: card.visualElements?.hasDiagram || !!card.mermaidDiagram,
        complexityLevel: this.validateComplexityLevel(card.visualElements?.complexityLevel)
      },
      learningObjective: card.learningObjective || 'Understand the concept',
      hints: Array.isArray(card.hints) ? card.hints : [],
      relatedConcepts: Array.isArray(card.relatedConcepts) ? card.relatedConcepts : []
    }));
  }

  private validateDifficulty(difficulty: any): 'easy' | 'medium' | 'hard' {
    const validDifficulties = ['easy', 'medium', 'hard'];
    return validDifficulties.includes(difficulty) ? difficulty : 'medium';
  }

  private validateCardType(type: any): BedrockFlashCard['type'] {
    const validTypes: BedrockFlashCard['type'][] = ['definition', 'concept', 'formula', 'process', 'diagram', 'example'];
    return validTypes.includes(type) ? type : 'concept';
  }

  private validateMermaidType(type: any): MermaidDiagram['type'] {
    const validTypes: MermaidDiagram['type'][] = ['flowchart', 'graph', 'mindmap', 'sequence', 'class', 'state', 'pie', 'gitgraph'];
    return validTypes.includes(type) ? type : 'flowchart';
  }

  private validateComplexityLevel(level: any): 'simple' | 'moderate' | 'complex' {
    const validLevels = ['simple', 'moderate', 'complex'];
    return validLevels.includes(level) ? level : 'moderate';
  }

  private calculateStudyTime(cardCount: number): string {
    const minutesPerCard = 2;
    const totalMinutes = cardCount * minutesPerCard;
    
    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  private calculateDifficultyDistribution(cards: any[]): { easy: number; medium: number; hard: number } {
    const distribution = { easy: 0, medium: 0, hard: 0 };
    
    cards.forEach(card => {
      const difficulty = this.validateDifficulty(card.difficulty);
      distribution[difficulty]++;
    });
    
    return distribution;
  }

  private createFallbackFlashCardSet(analysisResult: AnalysisResult): BedrockFlashCardSet {
    const { analysis } = analysisResult;
    const fallbackCards: BedrockFlashCard[] = [];
    
    // Create basic flashcards from topics
    analysis.topics.forEach((topic, index) => {
      const cardId = `fallback_card_${index + 1}`;
      
      // Create a definition card
      fallbackCards.push({
        id: cardId,
        front: `What is ${topic}?`,
        back: `${topic} is an important concept in ${analysis.subject}. It requires understanding of fundamental principles and practical applications.`,
        topic: topic,
        difficulty: this.mapDifficulty(analysis.difficulty),
        type: 'definition',
        mermaidDiagram: {
          type: 'mindmap',
          code: `mindmap\n  root((${topic}))\n    Concept\n      Definition\n      Examples\n    Application\n      Uses\n      Benefits`,
          description: `Mind map showing key aspects of ${topic}`
        },
        visualElements: {
          hasFormula: false,
          hasChart: false,
          hasDiagram: true,
          complexityLevel: 'simple'
        },
        learningObjective: `Understand the basic concept and applications of ${topic}`,
        hints: [`Think about how ${topic} relates to ${analysis.subject}`, 'Consider real-world examples'],
        relatedConcepts: analysis.topics.filter(t => t !== topic).slice(0, 2)
      });
    });
    
    // Add extracted questions as flashcards if available
    if (analysis.extractedQuestions && analysis.extractedQuestions.length > 0) {
      analysis.extractedQuestions.slice(0, 5).forEach((question, index) => {
        fallbackCards.push({
          id: `question_card_${index + 1}`,
          front: question,
          back: `This question tests understanding of key concepts in ${analysis.subject}. Consider the theoretical foundations and practical applications.`,
          topic: analysis.topics[index % analysis.topics.length] || 'General',
          difficulty: this.mapDifficulty(analysis.difficulty),
          type: 'example',
          visualElements: {
            hasFormula: question.toLowerCase().includes('formula') || question.toLowerCase().includes('equation'),
            hasChart: question.toLowerCase().includes('graph') || question.toLowerCase().includes('chart'),
            hasDiagram: false,
            complexityLevel: 'moderate'
          },
          learningObjective: 'Apply knowledge to solve problems',
          hints: ['Break down the question into parts', 'Identify key concepts involved'],
          relatedConcepts: analysis.topics.slice(0, 2)
        });
      });
    }

    return {
      title: `Flashcards for ${analysis.subject}`,
      subject: analysis.subject,
      cards: fallbackCards,
      totalCards: fallbackCards.length,
      estimatedStudyTime: this.calculateStudyTime(fallbackCards.length),
      difficultyDistribution: this.calculateDifficultyDistribution(fallbackCards),
      topicCoverage: analysis.topics,
      mermaidTypes: ['mindmap', 'flowchart'],
      generatedBy: 'Fallback Generator',
      timestamp: new Date().toISOString()
    };
  }

  private mapDifficulty(difficulty: string): 'easy' | 'medium' | 'hard' {
    switch (difficulty) {
      case 'easy': return 'easy';
      case 'medium': return 'medium';
      case 'hard':
      case 'expert': return 'hard';
      default: return 'medium';
    }
  }
}

export const bedrockService = new BedrockService();
