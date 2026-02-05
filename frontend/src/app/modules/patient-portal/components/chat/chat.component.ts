import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService, ChatMessage } from '@modules/patient-portal/services/chat.service';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  animations: [
    trigger('messageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('expandAnimation', [
      transition(':enter', [
        style({ opacity: 0, height: 0 }),
        animate('200ms ease-out', style({ opacity: 1, height: '*' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, height: 0 }))
      ])
    ])
  ]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;
  @ViewChild('inputField') private inputField!: ElementRef;

  messages$: Observable<ChatMessage[]>;
  isLoading$: Observable<boolean>;
  newMessage = '';
  expandedToolCalls: { [key: number]: boolean } = {};
  private shouldScroll = false;

  constructor(
    private chatService: ChatService,
    private sanitizer: DomSanitizer,
    private sharedProp: SharedPropertiesService
  ) {
    this.messages$ = this.chatService.getMessages();
    this.isLoading$ = this.chatService.isLoading();

    //Clear action bar (reset from other pages like Study Results):
    this.sharedProp.actionSetter({
      content_title       : '',
      content_icon        : '',
      add_button          : false,
      filters_form        : false
    });
  }

  ngOnInit(): void {
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

    // Focus back on input
    setTimeout(() => {
      if (this.inputField) {
        this.inputField.nativeElement.focus();
      }
    }, 100);
  }

  quickAction(message: string): void {
    this.newMessage = message;
    this.sendMessage();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearConversation(): void {
    this.chatService.clearConversation();
  }

  toggleToolCalls(index: number): void {
    this.expandedToolCalls[index] = !this.expandedToolCalls[index];
  }

  getToolIcon(toolName: string): string {
    const icons: { [key: string]: string } = {
      'get_patient_appointments': 'event',
      'get_appointment_details': 'info',
      'create_appointment': 'add_circle',
      'reschedule_appointment': 'update',
      'cancel_appointment': 'cancel',
      'get_available_slots': 'schedule',
      'get_slot_details': 'access_time',
      'check_slot_availability': 'check_circle',
      'list_procedures': 'list',
      'get_procedure_details': 'description',
      'get_preparation_instructions': 'assignment'
    };
    return icons[toolName] || 'build';
  }

  formatToolName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  truncateResult(result: string): string {
    if (result.length > 80) {
      return result.substring(0, 80) + '...';
    }
    return result;
  }

  getMessageSize(msg: ChatMessage): string {
    let totalSize = 0;

    // Content size
    if (msg.content) {
      totalSize += new Blob([msg.content]).size;
    }

    // Tool calls size
    if (msg.toolCalls) {
      for (const tool of msg.toolCalls) {
        totalSize += new Blob([JSON.stringify(tool)]).size;
      }
    }

    // Format as KB or bytes
    if (totalSize >= 1024) {
      return (totalSize / 1024).toFixed(1) + ' KB';
    }
    return totalSize + ' B';
  }

  formatRoundtrip(ms: number | undefined): string {
    if (!ms) return '';
    if (ms >= 1000) {
      return (ms / 1000).toFixed(1) + 's';
    }
    return ms + 'ms';
  }

  formatMessage(content: string): SafeHtml {
    if (!content) return '';

    // Convert markdown-like formatting to HTML
    let html = content
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Lists (simple)
      .replace(/^- (.*)/gm, '• $1')
      .replace(/^\d+\. (.*)/gm, '$&');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private scrollToBottom(): void {
    try {
      const container = this.messageContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      // Ignore scroll errors
    }
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }
}
