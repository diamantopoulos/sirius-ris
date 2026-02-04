import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatService, ChatMessage } from '@modules/patient-portal/services/chat.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  messages$: Observable<ChatMessage[]>;
  isLoading$: Observable<boolean>;
  newMessage = '';
  private shouldScroll = false;

  constructor(private chatService: ChatService) {
    this.messages$ = this.chatService.getMessages();
    this.isLoading$ = this.chatService.isLoading();
  }

  ngOnInit(): void {
    // SSE doesn't require explicit connect - it connects on-demand
    this.chatService.connect();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  sendMessage(): void {
    const content = this.newMessage.trim();
    if (!content) return;

    this.chatService.sendMessage(content);
    this.newMessage = '';
    this.shouldScroll = true;
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop =
        this.messageContainer.nativeElement.scrollHeight;
    } catch (err) {
      // Ignore scroll errors
    }
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }
}
