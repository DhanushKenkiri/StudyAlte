import { 
  BedrockRuntimeClient, 
  InvokeModelCommand, 
  InvokeModelCommandInput 
} from '@aws-sdk/client-bedrock-runtime';

export interface BedrockMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BedrockModelConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface BedrockResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  finishReason?: string;
}

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private defaultModelId: string = 'anthropic.claude-3-sonnet-20240229-v1:0';

  constructor(region: string = 'us-east-1') {
    this.client = new BedrockRuntimeClient({ region });
  }

  /**
   * Invoke Claude model with messages
   */
  async invokeModel(
    messages: BedrockMessage[],
    config?: Partial<BedrockModelConfig>
  ): Promise<BedrockResponse> {
    try {
      const modelConfig = {
        modelId: this.defaultModelId,
        maxTokens: 4000,
        temperature: 0.7,
        topP: 0.9,
        ...config
      };

      // Convert messages to Claude format
      const prompt = this.formatMessagesForClaude(messages);

      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        top_p: modelConfig.topP,
        messages: [{
          role: "user",
          content: prompt
        }]
      };

      const command = new InvokeModelCommand({
        modelId: modelConfig.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });

      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return {
        content: responseBody.content[0]?.text || '',
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0,
        finishReason: responseBody.stop_reason
      };

    } catch (error: any) {
      throw new Error(`Bedrock invocation failed: ${error.message}`);
    }
  }

  /**
   * Invoke model for simple text completion
   */
  async generateText(
    prompt: string,
    config?: Partial<BedrockModelConfig>
  ): Promise<string> {
    const messages: BedrockMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await this.invokeModel(messages, config);
    return response.content;
  }

  /**
   * Invoke model with system prompt and user message
   */
  async generateWithSystemPrompt(
    systemPrompt: string,
    userMessage: string,
    config?: Partial<BedrockModelConfig>
  ): Promise<BedrockResponse> {
    const messages: BedrockMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    return this.invokeModel(messages, config);
  }

  /**
   * Generate structured JSON response
   */
  async generateStructuredResponse<T>(
    prompt: string,
    jsonSchema: string,
    config?: Partial<BedrockModelConfig>
  ): Promise<T> {
    const structuredPrompt = `${prompt}

Please respond with valid JSON that conforms to this schema:
${jsonSchema}

Respond only with the JSON, no additional text:`;

    const response = await this.generateText(structuredPrompt, config);
    
    try {
      return JSON.parse(response) as T;
    } catch (error: any) {
      throw new Error('Invalid JSON response from Bedrock');
    }
  }

  /**
   * Format messages for Claude's conversational format
   */
  private formatMessagesForClaude(messages: BedrockMessage[]): string {
    let prompt = '';
    
    for (const message of messages) {
      switch (message.role) {
        case 'system':
          prompt += `System: ${message.content}\n\n`;
          break;
        case 'user':
          prompt += `Human: ${message.content}\n\n`;
          break;
        case 'assistant':
          prompt += `Assistant: ${message.content}\n\n`;
          break;
      }
    }
    
    // Ensure the prompt ends with Assistant:
    if (!prompt.endsWith('Assistant: ')) {
      prompt += 'Assistant: ';
    }
    
    return prompt;
  }

  /**
   * Get available model configurations
   */
  getModelConfigs(): Record<string, BedrockModelConfig> {
    return {
      'claude-3-sonnet': {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        maxTokens: 4000,
        temperature: 0.7,
        topP: 0.9
      },
      'claude-3-haiku': {
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        maxTokens: 4000,
        temperature: 0.7,
        topP: 0.9
      },
      'claude-instant': {
        modelId: 'anthropic.claude-instant-v1',
        maxTokens: 4000,
        temperature: 0.7,
        topP: 0.9
      }
    };
  }
}

// Export singleton instance
export const bedrockClient = new BedrockClient();
