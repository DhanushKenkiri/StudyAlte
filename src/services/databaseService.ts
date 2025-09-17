import { ref, push, set, get, query, orderByChild, equalTo, remove } from 'firebase/database';
import { User } from 'firebase/auth';
import { database } from '../config/firebase';
import { AnalysisResult, SummaryData, FlashCardSet } from './geminiService';
import { BedrockFlashCardSet, QuestionPaper } from './bedrockService';

export interface SavedPrompt {
  id: string;
  userId: string;
  title: string;
  analysisResult: AnalysisResult;
  userRequirements: string;
  uploadedFiles: Array<{
    name: string;
    type: string;
    size: number;
  }>;
  createdAt: string;
  lastUsed?: string;
  // New fields for the three-prompt system
  summaryData?: SummaryData;
  flashCardSet?: FlashCardSet;
  bedrockFlashCardSet?: BedrockFlashCardSet;
  questionPaper?: QuestionPaper;
}

export interface PromptHistory {
  id: string;
  title: string;
  createdAt: string;
  lastUsed?: string;
  fileCount: number;
  subject: string;
  hasSummary?: boolean;
  hasFlashCards?: boolean;
  hasBedrockFlashCards?: boolean;
  hasQuestionPaper?: boolean;
}

class DatabaseService {
  private getPromptsRef(userId: string) {
    if (!database) {
      throw new Error('Firebase database is not initialized');
    }
    return ref(database, `users/${userId}/prompts`);
  }

  private getPromptRef(userId: string, promptId: string) {
    if (!database) {
      throw new Error('Firebase database is not initialized');
    }
    return ref(database, `users/${userId}/prompts/${promptId}`);
  }

  async savePrompt(
    user: User,
    analysisResult: AnalysisResult,
    userRequirements: string,
    uploadedFiles: Array<{ name: string; type: string; size: number }>
  ): Promise<string> {
    try {
      console.log('🔄 Starting to save prompt to Firebase...');
      console.log('👤 User ID:', user.uid);
      console.log('📁 Files count:', uploadedFiles.length);
      
      const promptsRef = this.getPromptsRef(user.uid);
      const newPromptRef = push(promptsRef);
      
      // Generate a meaningful title
      const title = this.generateTitle(userRequirements, analysisResult);
      console.log('📝 Generated title:', title);
      
      const savedPrompt: Omit<SavedPrompt, 'id'> = {
        userId: user.uid,
        title,
        analysisResult,
        userRequirements,
        uploadedFiles: uploadedFiles.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size
        })),
        createdAt: new Date().toISOString(),
      };

      console.log('💾 Attempting to save to Firebase database...');
      
      // Add timeout to the Firebase save operation
      const savePromise = set(newPromptRef, savedPrompt);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Database save operation timed out after 30 seconds'));
        }, 30000); // 30 second timeout
      });
      
      await Promise.race([savePromise, timeoutPromise]);
      
      console.log('✅ Prompt saved successfully with ID:', newPromptRef.key);
      return newPromptRef.key!;
    } catch (error) {
      console.error('❌ Error saving prompt:', error);
      
      // Enhanced error handling
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('Database save timed out. Please check your internet connection and try again.');
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          throw new Error('Database permission denied. Please check your Firebase configuration.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('Network error while saving to database. Please check your connection.');
        }
      }
      
      throw new Error(`Failed to save prompt to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPromptHistory(user: User): Promise<PromptHistory[]> {
    try {
      const promptsRef = this.getPromptsRef(user.uid);
      const snapshot = await get(promptsRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      const prompts: PromptHistory[] = [];
      snapshot.forEach((childSnapshot) => {
        const promptData = childSnapshot.val() as SavedPrompt;
        prompts.push({
          id: childSnapshot.key!,
          title: promptData.title,
          createdAt: promptData.createdAt,
          lastUsed: promptData.lastUsed,
          fileCount: promptData.uploadedFiles.length,
          subject: promptData.analysisResult.analysis.subject || 'General'
        });
      });

      // Sort by creation date (newest first)
      return prompts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('❌ Error fetching prompt history:', error);
      throw new Error('Failed to fetch prompt history');
    }
  }

  async getPromptById(user: User, promptId: string): Promise<SavedPrompt | null> {
    try {
      const promptRef = this.getPromptRef(user.uid, promptId);
      const snapshot = await get(promptRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      const promptData = snapshot.val() as Omit<SavedPrompt, 'id'>;
      return {
        id: promptId,
        ...promptData
      };
    } catch (error) {
      console.error('❌ Error fetching prompt:', error);
      throw new Error('Failed to fetch prompt');
    }
  }

  async updateLastUsed(user: User, promptId: string): Promise<void> {
    try {
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      await set(ref(database, `users/${user.uid}/prompts/${promptId}/lastUsed`), new Date().toISOString());
      console.log('✅ Updated last used timestamp for prompt:', promptId);
    } catch (error) {
      console.error('❌ Error updating last used:', error);
    }
  }

  async deletePrompt(user: User, promptId: string): Promise<void> {
    try {
      const promptRef = this.getPromptRef(user.uid, promptId);
      await remove(promptRef);
      console.log('✅ Prompt deleted successfully:', promptId);
    } catch (error) {
      console.error('❌ Error deleting prompt:', error);
      throw new Error('Failed to delete prompt');
    }
  }

  private generateTitle(userRequirements: string, analysisResult: AnalysisResult): string {
    // Try to generate a meaningful title from the requirements or analysis
    const subject = analysisResult.analysis.subject || 'General';
    const requirementsSnippet = userRequirements.substring(0, 50).trim();
    
    if (requirementsSnippet) {
      return `${subject} - ${requirementsSnippet}${requirementsSnippet.length >= 50 ? '...' : ''}`;
    }
    
    // Fallback to timestamp-based title
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${subject} Question Paper - ${date} ${time}`;
  }

  // Utility method to get user data
  async getUserData(user: User) {
    try {
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      const userRef = ref(database, `users/${user.uid}/profile`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        // Create user profile if it doesn't exist
        const userProfile = {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        
        await set(userRef, userProfile);
        return userProfile;
      }
      
      // Update last login
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      await set(ref(database, `users/${user.uid}/profile/lastLoginAt`), new Date().toISOString());
      
      return snapshot.val();
    } catch (error) {
      console.error('❌ Error managing user data:', error);
      return null;
    }
  }

  // Save summary data to an existing prompt
  async saveSummary(user: User, promptId: string, summaryData: SummaryData): Promise<void> {
    try {
      console.log('💾 Saving summary for prompt:', promptId);
      
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const summaryRef = ref(database, `users/${user.uid}/prompts/${promptId}/summaryData`);
      await set(summaryRef, summaryData);
      
      console.log('✅ Summary saved successfully');
    } catch (error) {
      console.error('❌ Error saving summary:', error);
      throw new Error(`Failed to save summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Save flashcard set to an existing prompt
  async saveFlashCards(user: User, promptId: string, flashCardSet: FlashCardSet): Promise<void> {
    try {
      console.log('💾 Saving flashcards for prompt:', promptId);
      
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const flashCardsRef = ref(database, `users/${user.uid}/prompts/${promptId}/flashCardSet`);
      await set(flashCardsRef, flashCardSet);
      
      console.log('✅ Flashcards saved successfully');
    } catch (error) {
      console.error('❌ Error saving flashcards:', error);
      throw new Error(`Failed to save flashcards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get summary data for a prompt
  async getSummary(user: User, promptId: string): Promise<SummaryData | null> {
    try {
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const summaryRef = ref(database, `users/${user.uid}/prompts/${promptId}/summaryData`);
      const snapshot = await get(summaryRef);
      
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('❌ Error retrieving summary:', error);
      return null;
    }
  }

  // Get flashcard set for a prompt
  async getFlashCards(user: User, promptId: string): Promise<FlashCardSet | null> {
    try {
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const flashCardsRef = ref(database, `users/${user.uid}/prompts/${promptId}/flashCardSet`);
      const snapshot = await get(flashCardsRef);
      
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('❌ Error retrieving flashcards:', error);
      return null;
    }
  }

  // Save Bedrock flashcard set to an existing prompt
  async saveBedrockFlashCards(user: User, promptId: string, flashCardSet: BedrockFlashCardSet): Promise<void> {
    try {
      console.log('💾 Saving Bedrock flashcards for prompt:', promptId);
      
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const flashCardsRef = ref(database, `users/${user.uid}/prompts/${promptId}/bedrockFlashCardSet`);
      await set(flashCardsRef, flashCardSet);
      
      console.log('✅ Bedrock flashcards saved successfully');
    } catch (error) {
      console.error('❌ Error saving Bedrock flashcards:', error);
      throw new Error(`Failed to save Bedrock flashcards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get Bedrock flashcard set for a prompt
  async getBedrockFlashCards(user: User, promptId: string): Promise<BedrockFlashCardSet | null> {
    try {
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const flashCardsRef = ref(database, `users/${user.uid}/prompts/${promptId}/bedrockFlashCardSet`);
      const snapshot = await get(flashCardsRef);
      
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('❌ Error retrieving Bedrock flashcards:', error);
      return null;
    }
  }

  // Save question paper to an existing prompt
  async saveQuestionPaper(user: User, promptId: string, questionPaper: QuestionPaper): Promise<void> {
    try {
      console.log('💾 Saving question paper for prompt:', promptId);
      
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const questionPaperRef = ref(database, `users/${user.uid}/prompts/${promptId}/questionPaper`);
      await set(questionPaperRef, questionPaper);
      
      console.log('✅ Question paper saved successfully');
    } catch (error) {
      console.error('❌ Error saving question paper:', error);
      throw new Error(`Failed to save question paper: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get question paper for a prompt
  async getQuestionPaper(user: User, promptId: string): Promise<QuestionPaper | null> {
    try {
      if (!database) {
        throw new Error('Firebase database is not initialized');
      }
      
      const questionPaperRef = ref(database, `users/${user.uid}/prompts/${promptId}/questionPaper`);
      const snapshot = await get(questionPaperRef);
      
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('❌ Error retrieving question paper:', error);
      return null;
    }
  }

  // Get complete session data for a prompt (all generated content)
  async getSessionData(user: User, promptId: string) {
    try {
      console.log('📚 Loading complete session data for prompt:', promptId);
      
      const [savedPrompt, summaryData, flashCardSet, bedrockFlashCardSet, questionPaper] = await Promise.all([
        this.getPromptById(user, promptId),
        this.getSummary(user, promptId),
        this.getFlashCards(user, promptId),
        this.getBedrockFlashCards(user, promptId),
        this.getQuestionPaper(user, promptId)
      ]);

      if (!savedPrompt) {
        return null;
      }

      return {
        prompt: savedPrompt,
        summaryData,
        flashCardSet,
        bedrockFlashCardSet,
        questionPaper
      };
    } catch (error) {
      console.error('❌ Error loading session data:', error);
      return null;
    }
  }

  // Update the getHistory method to include summary and flashcard flags
  async getHistory(user: User): Promise<PromptHistory[]> {
    try {
      console.log('📚 Fetching user history...');
      
      const promptsRef = this.getPromptsRef(user.uid);
      const snapshot = await get(promptsRef);
      
      if (!snapshot.exists()) {
        console.log('📚 No history found for user');
        return [];
      }

      const prompts = snapshot.val();
      const history: PromptHistory[] = [];

      for (const [id, prompt] of Object.entries(prompts) as [string, any][]) {
        if (prompt && prompt.analysisResult) {
          history.push({
            id,
            title: prompt.title || 'Untitled Prompt',
            createdAt: prompt.createdAt,
            lastUsed: prompt.lastUsed,
            fileCount: prompt.uploadedFiles?.length || 0,
            subject: prompt.analysisResult?.analysis?.subject || 'Unknown Subject',
            hasSummary: !!prompt.summaryData,
            hasFlashCards: !!prompt.flashCardSet,
            hasBedrockFlashCards: !!prompt.bedrockFlashCardSet,
            hasQuestionPaper: !!prompt.questionPaper
          });
        }
      }

      // Sort by creation date (newest first)
      history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`✅ Retrieved ${history.length} history items`);
      return history;
    } catch (error) {
      console.error('❌ Error fetching history:', error);
      throw new Error(`Failed to fetch history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const databaseService = new DatabaseService();