import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { environment } from '@env/environment';

/**
 * SSE Event types from booking-agent
 */
export interface SSETokenEvent {
  token: string;
}

export interface SSEToolCallEvent {
  name: string;
  args: Record<string, unknown>;
}

export interface SSEToolResultEvent {
  name: string;
  result: string;
}

export interface SSECompleteEvent {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: string;
  }>;
}

export interface SSEErrorEvent {
  message: string;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: Array<{
    name: string;
    result: string;
  }>;
}

/**
 * Service for communicating with the booking-agent via SSE + HTTP POST
 */
@Injectable()
export class BookingAgentService implements OnDestroy {
  private messages$ = new BehaviorSubject<ChatMessage[]>([]);
  private isLoading$ = new BehaviorSubject<boolean>(false);
  private error$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  private readonly API_URL = environment.bookingAgentUrl || 'http://localhost:3003';
  private abortController: AbortController | null = null;

  constructor(private sharedFunctions: SharedFunctionsService) {}

  /**
   * Get auth token from sirius-ris
   */
  private getToken(): string {
    return this.sharedFunctions.readToken() || '';
  }

  /**
   * Send a message and stream the response via SSE
   */
  async sendMessage(content: string): Promise<void> {
    const token = this.getToken();
    if (!token) {
      this.error$.next('Not authenticated');
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    };
    this.addMessage(userMessage);

    // Create placeholder for streaming assistant message
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    this.addMessage(assistantMessage);

    this.isLoading$.next(true);

    // Cancel any previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: content }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read SSE stream
      await this.readSSEStream(response);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }

      console.error('Chat error:', error);
      this.error$.next(error.message || 'Failed to send message');

      // Update the streaming message to show error
      this.updateLastMessage({
        content: 'Sorry, I encountered an error. Please try again.',
        isStreaming: false
      });
    } finally {
      this.isLoading$.next(false);
      this.abortController = null;
    }
  }

  /**
   * Read and process SSE stream from response
   */
  private async readSSEStream(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let streamedContent = '';
    const toolCalls: Array<{ name: string; result: string }> = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data && currentEvent) {
              this.handleSSEEvent(currentEvent, data, (token) => {
                streamedContent += token;
                this.updateLastMessage({ content: streamedContent });
              }, toolCalls);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Finalize the message
    this.updateLastMessage({
      content: streamedContent || 'No response received.',
      isStreaming: false,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    });
  }

  /**
   * Handle individual SSE events
   */
  private handleSSEEvent(
    event: string,
    dataStr: string,
    onToken: (token: string) => void,
    toolCalls: Array<{ name: string; result: string }>
  ): void {
    try {
      const data = JSON.parse(dataStr);

      switch (event) {
        case 'token':
          onToken((data as SSETokenEvent).token);
          break;

        case 'tool_call':
          console.log('Tool called:', (data as SSEToolCallEvent).name);
          break;

        case 'tool_result':
          const result = data as SSEToolResultEvent;
          toolCalls.push({ name: result.name, result: result.result });
          break;

        case 'complete':
          // Final content is already streamed via tokens
          break;

        case 'error':
          console.error('SSE error:', (data as SSEErrorEvent).message);
          break;

        case 'done':
          // Stream finished
          break;
      }
    } catch (e) {
      console.warn('Failed to parse SSE data:', dataStr);
    }
  }

  /**
   * Add a message to the list
   */
  private addMessage(message: ChatMessage): void {
    const current = this.messages$.getValue();
    this.messages$.next([...current, message]);
  }

  /**
   * Update the last message (used for streaming)
   */
  private updateLastMessage(updates: Partial<ChatMessage>): void {
    const current = this.messages$.getValue();
    if (current.length === 0) return;

    const updated = [...current];
    const lastIndex = updated.length - 1;
    updated[lastIndex] = { ...updated[lastIndex], ...updates };
    this.messages$.next(updated);
  }

  /**
   * Clear conversation history (local and server)
   */
  async clearConversation(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    try {
      await fetch(`${this.API_URL}/api/chat`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to clear conversation:', error);
    }

    this.messages$.next([]);
  }

  /**
   * Cancel current streaming request
   */
  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.isLoading$.next(false);
    }
  }

  /**
   * Observable of all messages
   */
  getMessages(): Observable<ChatMessage[]> {
    return this.messages$.asObservable();
  }

  /**
   * Observable of loading state
   */
  getLoadingState(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  /**
   * Observable of errors
   */
  getErrors(): Observable<string> {
    return this.error$.asObservable();
  }

  ngOnDestroy(): void {
    this.cancelRequest();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
