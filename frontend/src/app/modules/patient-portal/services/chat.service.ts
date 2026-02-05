import { Injectable, OnDestroy } from '@angular/core';
import { BookingAgentService, ChatMessage } from './booking-agent.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Re-export ChatMessage for consumers
export { ChatMessage } from './booking-agent.service';

/**
 * Chat service - facade over BookingAgentService
 *
 * Provides a simple interface for the chat component to send/receive messages.
 * Uses SSE streaming for real-time responses from the AI booking agent.
 */
@Injectable()
export class ChatService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private bookingAgent: BookingAgentService) {
    // Subscribe to errors and log them
    this.bookingAgent.getErrors().pipe(
      takeUntil(this.destroy$)
    ).subscribe(error => {
      console.error('Chat service error:', error);
    });
  }

  /**
   * Send a message to the booking agent
   * Response will be streamed via SSE and added to messages
   */
  sendMessage(content: string): void {
    this.bookingAgent.sendMessage(content);
  }

  /**
   * Get observable of all messages
   */
  getMessages(): Observable<ChatMessage[]> {
    return this.bookingAgent.getMessages();
  }

  /**
   * Get loading state (true while streaming response)
   */
  isLoading(): Observable<boolean> {
    return this.bookingAgent.getLoadingState();
  }

  /**
   * Clear all messages (local and server-side)
   */
  clearMessages(): void {
    this.bookingAgent.clearConversation();
  }

  /**
   * Alias for clearMessages
   */
  clearConversation(): void {
    this.clearMessages();
  }

  /**
   * Cancel current request (if streaming)
   */
  cancelRequest(): void {
    this.bookingAgent.cancelRequest();
  }

  /**
   * No-op for backwards compatibility
   * SSE doesn't require explicit connect/disconnect
   */
  connect(): void {
    // No-op - SSE connects on-demand per request
  }

  /**
   * No-op for backwards compatibility
   */
  disconnect(): void {
    this.bookingAgent.cancelRequest();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.bookingAgent.cancelRequest();
  }
}
