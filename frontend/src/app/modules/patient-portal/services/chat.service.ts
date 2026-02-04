import { Injectable, OnDestroy } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

@Injectable()
export class ChatService implements OnDestroy {
  private messages$ = new BehaviorSubject<ChatMessage[]>([]);
  private destroy$ = new Subject<void>();
  private connected = false;

  constructor(private websocket: WebsocketService) {}

  connect(): void {
    if (this.connected) return;

    this.websocket.connect().pipe(
      takeUntil(this.destroy$),
      filter(msg => msg != null)
    ).subscribe({
      next: (msg) => this.handleMessage(msg),
      error: (err) => console.error('Chat connection error:', err)
    });

    this.connected = true;
  }

  private handleMessage(msg: any): void {
    // Handle different message types from chat-service
    if (msg.type === 'state_sync') {
      // Restore conversation state on reconnect
      const messages = msg.messages || [];
      this.messages$.next(messages);
    } else if (msg.type === 'assistant' || msg.type === 'echo') {
      // Add assistant response
      const newMessage: ChatMessage = {
        role: 'assistant',
        content: msg.content,
        timestamp: new Date()
      };
      const current = this.messages$.getValue();
      this.messages$.next([...current, newMessage]);
    }
  }

  sendMessage(content: string): void {
    // Add user message to local state
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    };
    const current = this.messages$.getValue();
    this.messages$.next([...current, userMessage]);

    // Send to server
    this.websocket.send({
      type: 'user_message',
      content
    });
  }

  getMessages(): Observable<ChatMessage[]> {
    return this.messages$.asObservable();
  }

  clearMessages(): void {
    this.messages$.next([]);
  }

  disconnect(): void {
    this.websocket.disconnect();
    this.connected = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
