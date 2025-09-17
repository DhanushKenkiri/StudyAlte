import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedRequirements {
  examType: string;
  totalQuestions: number;
  marksPerQuestion: number;
  totalMarks: number;
  difficultyLevel: string;
  examDuration: string;
  questionTypes: string[];
  sections: {
    name: string;
    questions: number;
    marksPerQuestion: number;
    totalMarks: number;
    questionType: string;
  }[];
  specialInstructions: string[];
}

export interface SummaryData {
  title: string;
  subject: string;
  keyTopics: string[];
  mainConcepts: {
    topic: string;
    description: string;
    importance: string;
  }[];
  studyGuide: {
    section: string;
    points: string[];
  }[];
  timeEstimate: string;
  difficulty: string;
  generatedBy: string;
  timestamp: string;
}

export interface FlashCardData {
  id: string;
  front: string;
  back: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'definition' | 'concept' | 'formula' | 'example';
}

export interface FlashCardSet {
  title: string;
  subject: string;
  cards: FlashCardData[];
  totalCards: number;
  estimatedStudyTime: string;
  generatedBy: string;
  timestamp: string;
}

export interface ThreePromptResult {
  questionPaperPrompt: string;
  summaryPrompt: string;
  flashCardPrompt: string;
}

export interface AnalysisResult {
  analysis: {
    subject: string;
    topics: string[];
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    confidence: number;
    extractedQuestions?: string[];
    questionPatterns?: string[];
    documentTypes?: string[];
    markingSchemes?: string[];
    languageStyle?: string;
    parsedRequirements?: ParsedRequirements;
  };
  prompt: string;
  threePrompts: ThreePromptResult;
  paperPattern?: {
    examDuration: string;
    totalMarks: string;
    sections: {
      sectionName: string;
      instructions: string;
      questions: number;
      marksPerQuestion: number;
      totalMarks: number;
      questionType?: string;
    }[];
    generalInstructions: string[];
  };
  usageInstructions?: {
    forChatGPT: string;
    forClaude: string;
    forBard: string;
    customization: string;
  };
  timestamp: string;
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  content: string;
  isImage: boolean;
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Use API key from environment variables only
    const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error('REACT_APP_GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  setApiKey(apiKey: string) {
    // This method is kept for compatibility but not needed anymore
    return true;
  }

  async parseUserRequirements(userRequirements: string): Promise<ParsedRequirements> {
    if (!this.model) {
      throw new Error('API key not set');
    }

    try {
      const parsePrompt = `Parse the following user requirements for a question paper and extract structured information:

User Requirements: "${userRequirements}"

Extract and structure the requirements into JSON format:
{
  "examType": "type of exam (e.g., university, school, competitive)",
  "totalQuestions": number of questions requested,
  "marksPerQuestion": marks per question,
  "totalMarks": total marks for the paper,
  "difficultyLevel": "easy/medium/hard/advanced",
  "examDuration": "suggested duration (e.g., 2 hours, 3 hours)",
  "questionTypes": ["types of questions like MCQ, short answer, long answer"],
  "sections": [
    {
      "name": "Section name",
      "questions": number of questions in this section,
      "marksPerQuestion": marks per question in this section,
      "totalMarks": total marks for this section,
      "questionType": "type of questions in this section"
    }
  ],
  "specialInstructions": ["any special requirements or instructions"]
}

If the user mentions specific numbers (like "5 questions of 4 marks each"), use those EXACTLY.
If information is missing, make reasonable assumptions based on educational standards.
Ensure the paper structure is realistic and follows standard exam patterns.`;

      const result = await this.model.generateContent(parsePrompt);
      const response = await result.response;
      const text = response.text();

      try {
        const cleanedText = text.replace(/```json\n?|\n?```/g, '');
        return JSON.parse(cleanedText);
      } catch (parseError) {
        // Fallback parsing if JSON is malformed
        return {
          examType: 'general',
          totalQuestions: this.extractNumber(userRequirements, 'questions') || 5,
          marksPerQuestion: this.extractNumber(userRequirements, 'marks') || 10,
          totalMarks: (this.extractNumber(userRequirements, 'questions') || 5) * (this.extractNumber(userRequirements, 'marks') || 10),
          difficultyLevel: 'medium',
          examDuration: '2 hours',
          questionTypes: ['Long Answer'],
          sections: [{
            name: 'Section A',
            questions: this.extractNumber(userRequirements, 'questions') || 5,
            marksPerQuestion: this.extractNumber(userRequirements, 'marks') || 10,
            totalMarks: (this.extractNumber(userRequirements, 'questions') || 5) * (this.extractNumber(userRequirements, 'marks') || 10),
            questionType: 'Long Answer'
          }],
          specialInstructions: ['All questions are compulsory']
        };
      }
    } catch (error: any) {
      console.error('Error parsing requirements:', error);
      
      // Enhanced error handling for requirement parsing
      if (error?.message?.includes('503') || 
          error?.message?.includes('overloaded') || 
          error?.status === 503) {
        throw new Error('The AI service is currently overloaded. Please try again in a few minutes.');
      } else if (error?.message?.includes('502') || error?.status === 502) {
        throw new Error('AI service gateway error. Please try again.');
      } else if (error?.message?.includes('timeout')) {
        throw new Error('Request timed out while parsing requirements. Please try again.');
      } else if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
        throw new Error('API quota exceeded. Please try again later.');
      } else {
        throw new Error(`Failed to parse requirements: ${error?.message || 'Unknown error'}`);
      }
    }
  }

  private extractNumber(text: string, context: string): number | null {
    const patterns = {
      'questions': /(\d+)\s*questions?/i,
      'marks': /(\d+)\s*marks?/i
    };
    
    const match = text.match(patterns[context as keyof typeof patterns]);
    return match ? parseInt(match[1]) : null;
  }

  async generateThreePrompts(
    parsedRequirements: ParsedRequirements,
    files: UploadedFile[]
  ): Promise<ThreePromptResult> {
    const filesContent = files.map(file => `
File: ${file.name} (${file.type})
Content: ${file.content.substring(0, 4000)}${file.content.length > 4000 ? '...' : ''}
`).join('\n');

    const threePromptsRequest = `Based on the following educational content and user requirements, generate three specialized prompts for different purposes:

USER REQUIREMENTS:
- Exam Type: ${parsedRequirements.examType}
- Total Questions: ${parsedRequirements.totalQuestions}
- Marks Per Question: ${parsedRequirements.marksPerQuestion}
- Total Marks: ${parsedRequirements.totalMarks}
- Difficulty Level: ${parsedRequirements.difficultyLevel}
- Exam Duration: ${parsedRequirements.examDuration}
- Question Types: ${parsedRequirements.questionTypes.join(', ')}

EDUCATIONAL CONTENT:
${filesContent}

Generate exactly three specialized prompts in JSON format:

{
  "questionPaperPrompt": "Extremely detailed prompt for generating question papers that follows the exact user specifications and includes all extracted questions as reference templates",
  "summaryPrompt": "Comprehensive prompt for generating study summaries that covers all key topics, concepts, and creates organized study notes from the uploaded material",
  "flashCardPrompt": "Detailed prompt for creating flashcards that converts the content into question-answer pairs suitable for active recall and spaced repetition learning"
}

REQUIREMENTS FOR EACH PROMPT:

1. QUESTION PAPER PROMPT:
   - Must include ALL extracted questions as reference examples
   - Should specify exact paper structure: ${parsedRequirements.totalQuestions} questions × ${parsedRequirements.marksPerQuestion} marks
   - Include difficulty level requirements
   - Specify question types and marking schemes
   - Include time management guidance

2. SUMMARY PROMPT:
   - Should create organized study notes covering all topics
   - Include key concepts, definitions, and important points
   - Organize by difficulty level and importance
   - Include time estimates for studying each section
   - Format should be student-friendly and easy to review

3. FLASHCARD PROMPT:
   - Convert content into question-answer pairs
   - Create cards for definitions, concepts, formulas, and examples
   - Include different difficulty levels
   - Specify front and back of each card clearly
   - Include topic categorization for organized study

Make each prompt extremely detailed and actionable.`;

    try {
      const result = await this.model.generateContent(threePromptsRequest);
      const response = await result.response;
      const text = response.text();

      const cleanedText = text.replace(/```json\n?|\n?```/g, '');
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('Error generating three prompts:', error);
      // Fallback prompts
      return {
        questionPaperPrompt: `Generate a ${parsedRequirements.difficultyLevel} difficulty question paper with ${parsedRequirements.totalQuestions} questions of ${parsedRequirements.marksPerQuestion} marks each. Duration: ${parsedRequirements.examDuration}. Include proper sections and marking schemes.`,
        summaryPrompt: `Create a comprehensive study summary covering all topics from the uploaded content. Organize by importance and difficulty. Include key concepts, definitions, and study tips.`,
        flashCardPrompt: `Convert the educational content into flashcards with clear questions on front and answers on back. Include definitions, concepts, formulas, and examples. Categorize by topic and difficulty.`
      };
    }
  }

  async analyzeContent(
    userRequirements: string,
    files: UploadedFile[]
  ): Promise<AnalysisResult> {
    if (!this.model) {
      throw new Error('API key not set. Please configure your Gemini API key.');
    }

    try {
      // Step 1: Parse user requirements
      const parsedRequirements = await this.parseUserRequirements(userRequirements);

      // Step 2: Generate three specialized prompts
      const threePrompts = await this.generateThreePrompts(parsedRequirements, files);

      // Step 3: Analyze content and generate comprehensive prompt (original logic for backward compatibility)
      let analysisPrompt = `Generate a comprehensive question paper based on the following structured requirements and content analysis:

PARSED USER REQUIREMENTS:
- Exam Type: ${parsedRequirements.examType}
- Total Questions: ${parsedRequirements.totalQuestions}
- Marks Per Question: ${parsedRequirements.marksPerQuestion}
- Total Marks: ${parsedRequirements.totalMarks}
- Difficulty Level: ${parsedRequirements.difficultyLevel}
- Exam Duration: ${parsedRequirements.examDuration}
- Question Types: ${parsedRequirements.questionTypes.join(', ')}

SECTIONS STRUCTURE:
${parsedRequirements.sections.map(section => 
  `- ${section.name}: ${section.questions} questions × ${section.marksPerQuestion} marks = ${section.totalMarks} marks (${section.questionType})`
).join('\n')}

FILES CONTENT ANALYSIS (Previous Year Papers & Reference Material):
${files.map(file => `
File: ${file.name} (${file.type})
Content Length: ${file.content.length} characters
Content: ${file.content.substring(0, 8000)}${file.content.length > 8000 ? '...' : ''}
`).join('\n')}

CRITICAL INSTRUCTIONS FOR MAXIMUM ACCURACY:
1. Extract ALL questions from uploaded documents (previous year papers, sample questions, etc.)
2. Analyze question patterns, marking schemes, difficulty levels, and language style
3. Use extracted questions as REFERENCE TEMPLATES for generating similar high-quality questions
4. Follow the EXACT paper structure specified by user: ${parsedRequirements.totalQuestions} questions × ${parsedRequirements.marksPerQuestion} marks each
5. Generate questions that could realistically appear in actual exams (40%+ prediction accuracy)
6. Match the writing style, terminology, and complexity of reference questions
7. Ensure topic coverage matches the uploaded content proportionally

Provide a JSON response:
{
  "analysis": {
    "subject": "detected subject area from content",
    "topics": ["comprehensive list of all topics found in documents"],
    "difficulty": "${parsedRequirements.difficultyLevel}",
    "confidence": 90,
    "extractedQuestions": ["ALL questions found in documents - include complete text with marks allocation"],
    "questionPatterns": ["specific patterns in question formation, language style, difficulty progression"],
    "documentTypes": ["previous year papers, sample questions, textbook exercises, etc."],
    "markingSchemes": ["marking patterns and evaluation criteria found"],
    "languageStyle": "observed writing style and terminology used",
    "parsedRequirements": ${JSON.stringify(parsedRequirements)}
  },
  "prompt": "DETAILED AI PROMPT FOR ACCURATE QUESTION GENERATION - Must be comprehensive and specific",
  "paperPattern": {
    "examDuration": "${parsedRequirements.examDuration}",
    "totalMarks": "${parsedRequirements.totalMarks}",
    "sections": ${JSON.stringify(parsedRequirements.sections.map(section => ({
      sectionName: section.name,
      instructions: `Answer ${section.questions} questions from this section. Each question carries ${section.marksPerQuestion} marks.`,
      questions: section.questions,
      marksPerQuestion: section.marksPerQuestion,
      totalMarks: section.totalMarks,
      questionType: section.questionType
    })))},
    "generalInstructions": ${JSON.stringify([...parsedRequirements.specialInstructions, "Read all instructions carefully", "Manage your time effectively", "All questions are compulsory"])}
  },
  "usageInstructions": {
    "forChatGPT": "Copy this comprehensive prompt to ChatGPT to generate an accurate question paper matching the exact specifications",
    "forClaude": "Use with Claude AI for professional question paper generation with high accuracy",
    "forBard": "Apply in Google Bard for educational content creation following institutional standards",
    "customization": "Modify topics and difficulty as needed while maintaining the exact structure and marking scheme"
  },
  "timestamp": "${new Date().toISOString()}"
}

THE PROMPT MUST BE EXTREMELY DETAILED AND INCLUDE:

"You are an expert question paper creator with access to previous year papers and comprehensive educational content. Your task is to generate a question paper that matches EXACTLY the user's specifications while maintaining high accuracy for exam prediction.

USER'S EXACT REQUIREMENTS:
- Create ${parsedRequirements.totalQuestions} questions
- Each question worth ${parsedRequirements.marksPerQuestion} marks
- Total marks: ${parsedRequirements.totalMarks}
- Difficulty level: ${parsedRequirements.difficultyLevel}
- Exam duration: ${parsedRequirements.examDuration}
- Paper structure: [Include exact section breakdown]

REFERENCE MATERIAL - EXTRACTED QUESTIONS FOR PATTERN ANALYSIS:
[Include ALL extracted questions here as templates - these are from previous year papers and should guide the style, difficulty, and format of new questions]

IDENTIFIED QUESTION PATTERNS:
[List specific patterns found in reference material - question structure, marking allocation, difficulty progression, etc.]

TOPICS TO COVER (Based on Content Analysis):
[Comprehensive topic list with weightage based on reference material analysis]

DETAILED INSTRUCTIONS FOR QUESTION GENERATION:
1. Generate questions that follow the EXACT style and pattern of the reference material
2. Use similar language, terminology, and complexity as found in extracted questions
3. Ensure each question is worth exactly ${parsedRequirements.marksPerQuestion} marks as specified
4. Create ${parsedRequirements.totalQuestions} distinct questions covering different aspects of the subject
5. Follow the same marking scheme pattern observed in reference material
6. Maintain the same difficulty distribution as found in previous papers
7. Include proper question numbering and mark allocation display
8. Ensure questions test both conceptual understanding and application
9. Create questions that could realistically appear in the actual upcoming exam
10. Include complete marking scheme and model answers for each question

QUALITY ASSURANCE REQUIREMENTS:
- Questions must be original but stylistically consistent with reference material
- Language precision must match institutional standards
- Difficulty curve should mirror reference papers
- Time allocation should be realistic for ${parsedRequirements.examDuration}
- Total marks must equal exactly ${parsedRequirements.totalMarks}
- Each question must be answerable within the allocated time and marks

PAPER FORMAT:
[Exact format based on user requirements and reference material patterns]

MARKING SCHEME:
[Detailed breakdown of how each question should be evaluated]

Generate a complete, ready-to-use question paper that educators can implement immediately for examinations with confidence in its accuracy and relevance."

Make this prompt extremely comprehensive, incorporating ALL extracted questions as reference examples, and ensure it generates questions that match the user's EXACT specifications.`;

      const result = await this.model.generateContent(analysisPrompt);
      const response = await result.response;
      const text = response.text();

      // Try to extract JSON from the response
      let analysisResult: AnalysisResult;
      try {
        // Remove markdown code block markers if present
        const cleanedText = text.replace(/```json\n?|\n?```/g, '');
        const parsedResult = JSON.parse(cleanedText);
        
        // Add the three prompts to the result
        analysisResult = {
          ...parsedResult,
          threePrompts: threePrompts
        };
      } catch (parseError) {
        // If JSON parsing fails, create a structured response
        analysisResult = {
          analysis: {
            subject: 'General',
            topics: ['Based on uploaded content'],
            difficulty: 'medium',
            confidence: 75,
            parsedRequirements: parsedRequirements
          },
          prompt: text,
          threePrompts: threePrompts,
          timestamp: new Date().toISOString()
        };
      }

      return analysisResult;
    } catch (error: any) {
      console.error('Error analyzing content:', error);
      
      // Enhanced error handling for content analysis
      if (error?.message?.includes('503') || 
          error?.message?.includes('overloaded') || 
          error?.status === 503) {
        throw new Error('The AI service is currently overloaded. Please try again in a few minutes.');
      } else if (error?.message?.includes('502') || error?.status === 502) {
        throw new Error('AI service gateway error. Please try again.');
      } else if (error?.message?.includes('timeout')) {
        throw new Error('Request timed out. Please try again with smaller files or simpler requirements.');
      } else if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
        throw new Error('API quota exceeded. Please try again later or contact support.');
      } else if (error?.message?.includes('API key')) {
        throw new Error('Invalid API key. Please check your configuration.');
      } else {
        throw new Error(`Content analysis failed: ${error?.message || 'Unknown error occurred'}`);
      }
    }
  }

  async analyzeImageContent(imageFile: File): Promise<string> {
    if (!this.model) {
      throw new Error('API key not set');
    }

    try {
      // Convert image to base64
      const base64Data = await this.fileToBase64(imageFile);
      
      const imagePart = {
        inlineData: {
          data: base64Data.split(',')[1], // Remove data:image/jpeg;base64, prefix
          mimeType: imageFile.type
        }
      };

      const prompt = `Analyze this image thoroughly and extract:
1. ALL QUESTIONS present in the image (word for word)
2. Question numbers and marks allocation
3. Any instructions or guidelines
4. Diagrams, charts, or visual content descriptions
5. Mathematical formulas or equations
6. Answer patterns or schemes if visible
7. Paper format and structure
8. Subject area and topics covered

Please provide a detailed extraction of all text content, especially focusing on identifying complete questions with their mark allocations. If this appears to be from an exam paper or question bank, note the pattern and format used.`;
      
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('Error analyzing image:', error);
      
      // Enhanced error handling for image analysis
      if (error?.message?.includes('503') || 
          error?.message?.includes('overloaded') || 
          error?.status === 503) {
        throw new Error('The AI service is currently overloaded. Please try again in a few minutes.');
      } else if (error?.message?.includes('502') || error?.status === 502) {
        throw new Error('AI service gateway error. Please try again.');
      } else if (error?.message?.includes('timeout')) {
        throw new Error('Image analysis timed out. Please try with a smaller image or try again later.');
      } else if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
        throw new Error('API quota exceeded. Please try again later.');
      } else {
        throw new Error(`Image analysis failed for ${imageFile.name}: ${error?.message || 'Unknown error'}`);
      }
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  async generateSummary(analysisResult: AnalysisResult): Promise<SummaryData> {
    if (!this.model) {
      throw new Error('API key not set. Please configure your Gemini API key.');
    }

    try {
      // Check if threePrompts exists, if not create a fallback
      let summaryPrompt: string;
      
      if (analysisResult.threePrompts && analysisResult.threePrompts.summaryPrompt) {
        summaryPrompt = analysisResult.threePrompts.summaryPrompt;
      } else {
        // Fallback prompt for older sessions or missing data
        summaryPrompt = `Create a comprehensive study summary covering all topics from the uploaded content about ${analysisResult.analysis.subject}. Organize by importance and difficulty. Include key concepts, definitions, and study tips.`;
      }
      
      const enhancedSummaryPrompt = `${summaryPrompt}

Based on the analyzed content, create a comprehensive and detailed study summary in JSON format. Make it thorough and educational:

{
  "title": "Comprehensive Study Summary for ${analysisResult.analysis.subject}",
  "subject": "${analysisResult.analysis.subject}",
  "keyTopics": ["array of 8-12 main topics from analysis with specific details"],
  "mainConcepts": [
    {
      "topic": "specific topic name",
      "description": "detailed explanation with examples and context (minimum 100 words per concept)",
      "importance": "comprehensive explanation of why this is crucial for understanding the subject and how it connects to other concepts"
    }
  ],
  "studyGuide": [
    {
      "section": "organized section name (e.g., Fundamentals, Advanced Concepts, Applications)",
      "points": ["detailed key points with explanations", "important formulas or definitions with context", "study strategies and memory techniques", "practice recommendations", "common mistakes to avoid"]
    }
  ],
  "timeEstimate": "realistic detailed study time breakdown (e.g., '4-6 hours total: 2 hours for basics, 2 hours for practice, 1-2 hours for review')",
  "difficulty": "${analysisResult.analysis.difficulty}",
  "generatedBy": "AI Study Assistant - Enhanced Analysis",
  "timestamp": "${new Date().toISOString()}"
}

DETAILED CONTENT TO SUMMARIZE:
Subject: ${analysisResult.analysis.subject}
Topics: ${analysisResult.analysis.topics.join(', ')}
Difficulty: ${analysisResult.analysis.difficulty}
Question Patterns: ${analysisResult.analysis.questionPatterns?.join(', ') || 'To be derived from content'}
Document Types: ${analysisResult.analysis.documentTypes?.join(', ') || 'Standard academic content'}
Extracted Questions: ${analysisResult.analysis.extractedQuestions?.slice(0, 15).join('\n') || 'None available'}

INSTRUCTIONS FOR ENHANCED SUMMARY:
1. Provide 6-10 main concepts with detailed descriptions (100+ words each)
2. Create 4-6 study guide sections with 5-8 detailed points each
3. Include practical applications and real-world examples
4. Add memory techniques and study strategies
5. Suggest learning progression and prerequisites
6. Make the content engaging and easy to understand
7. Include common pitfalls and how to avoid them
8. Provide specific study time recommendations for each section

Create a comprehensive, student-friendly summary that serves as a complete study resource.`;

      const result = await this.model.generateContent(enhancedSummaryPrompt);
      const response = await result.response;
      const text = response.text();

      try {
        const cleanedText = text.replace(/```json\n?|\n?```/g, '');
        return JSON.parse(cleanedText);
      } catch (parseError) {
        // Fallback summary
        return {
          title: `Study Summary for ${analysisResult.analysis.subject}`,
          subject: analysisResult.analysis.subject,
          keyTopics: analysisResult.analysis.topics,
          mainConcepts: analysisResult.analysis.topics.map(topic => ({
            topic: topic,
            description: `Key concepts related to ${topic}`,
            importance: 'Important for exam preparation'
          })),
          studyGuide: [{
            section: 'Main Topics',
            points: analysisResult.analysis.topics.map(topic => `Study ${topic} thoroughly`)
          }],
          timeEstimate: '2-3 hours',
          difficulty: analysisResult.analysis.difficulty,
          generatedBy: 'AI Study Assistant',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error: any) {
      console.error('Error generating summary:', error);
      throw new Error(`Summary generation failed: ${error?.message || 'Unknown error occurred'}`);
    }
  }

  async generateFlashCards(analysisResult: AnalysisResult): Promise<FlashCardSet> {
    if (!this.model) {
      throw new Error('API key not set. Please configure your Gemini API key.');
    }

    try {
      // Check if threePrompts exists, if not create a fallback
      let flashCardPrompt: string;
      
      if (analysisResult.threePrompts && analysisResult.threePrompts.flashCardPrompt) {
        flashCardPrompt = analysisResult.threePrompts.flashCardPrompt;
      } else {
        // Fallback prompt for older sessions or missing data
        flashCardPrompt = `Create educational flashcards from the uploaded content about ${analysisResult.analysis.subject}. Each flashcard should have a clear question/term on the front and a comprehensive answer/definition on the back. Focus on key concepts, important terms, and critical information.`;
      }
      
      const enhancedFlashCardPrompt = `${flashCardPrompt}

Based on the analyzed content, create a comprehensive flashcard set in JSON format:

{
  "title": "Flashcards for ${analysisResult.analysis.subject}",
  "subject": "${analysisResult.analysis.subject}",
  "cards": [
    {
      "id": "unique_id",
      "front": "Question or term",
      "back": "Answer or definition",
      "topic": "related topic",
      "difficulty": "easy|medium|hard",
      "type": "definition|concept|formula|example"
    }
  ],
  "totalCards": "number of cards",
  "estimatedStudyTime": "time estimate",
  "generatedBy": "AI Study Assistant",
  "timestamp": "${new Date().toISOString()}"
}

CONTENT TO CONVERT TO FLASHCARDS:
Subject: ${analysisResult.analysis.subject}
Topics: ${analysisResult.analysis.topics.join(', ')}
Extracted Questions: ${analysisResult.analysis.extractedQuestions?.slice(0, 5).join('\n') || 'None available'}

Create diverse flashcards including:
1. Definition cards for key terms
2. Concept cards for understanding
3. Formula cards for mathematical content
4. Example cards for application
5. Question-answer cards from extracted content

Generate at least 20 high-quality flashcards covering all major topics.`;

      const result = await this.model.generateContent(enhancedFlashCardPrompt);
      const response = await result.response;
      const text = response.text();

      try {
        const cleanedText = text.replace(/```json\n?|\n?```/g, '');
        return JSON.parse(cleanedText);
      } catch (parseError) {
        // Fallback flashcards
        const fallbackCards: FlashCardData[] = analysisResult.analysis.topics.map((topic, index) => ({
          id: `card_${index + 1}`,
          front: `What is ${topic}?`,
          back: `${topic} is an important concept in ${analysisResult.analysis.subject}`,
          topic: topic,
          difficulty: analysisResult.analysis.difficulty === 'expert' ? 'hard' : analysisResult.analysis.difficulty as 'easy' | 'medium' | 'hard',
          type: 'definition'
        }));

        return {
          title: `Flashcards for ${analysisResult.analysis.subject}`,
          subject: analysisResult.analysis.subject,
          cards: fallbackCards,
          totalCards: fallbackCards.length,
          estimatedStudyTime: `${Math.ceil(fallbackCards.length * 2)} minutes`,
          generatedBy: 'AI Study Assistant',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      throw new Error(`Flashcard generation failed: ${error?.message || 'Unknown error occurred'}`);
    }
  }
}

export const geminiService = new GeminiService();
