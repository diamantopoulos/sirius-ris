import { Injectable, OnDestroy } from '@angular/core';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { Observable, Subject, EMPTY } from 'rxjs';
import { catchError, tap, retryWhen, delay, takeUntil } from 'rxjs/operators';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';

@Injectable()
export class WebsocketService implements OnDestroy {
  private ws$: WebSocketSubject<any> | null = null;
  private destroy$ = new Subject<void>();
  private readonly WS_URL = 'ws://localhost:3003';  // chat-service

  constructor(private sharedFunctions: SharedFunctionsService) {}

  private getToken(): string {
    // Use sirius-ris shared function to read token from localStorage
    return this.sharedFunctions.readToken() || '';
  }

  connect(): Observable<any> {
    if (!this.ws$) {
      const token = this.getToken();
      if (!token) {
        console.error('No auth token available for WebSocket connection');
        return EMPTY;
      }

      this.ws$ = webSocket({
        url: `${this.WS_URL}?token=${token}`,
        openObserver: {
          next: () => console.log('WebSocket connected')
        },
        closeObserver: {
          next: () => {
            console.log('WebSocket disconnected');
            this.ws$ = null;
          }
        }
      });
    }

    return this.ws$.pipe(
      takeUntil(this.destroy$),
      retryWhen(errors => errors.pipe(
        tap(err => console.log('WebSocket error, retrying...', err)),
        delay(3000)
      )),
      catchError(err => {
        console.error('WebSocket connection failed:', err);
        return EMPTY;
      })
    );
  }

  send(message: any): void {
    if (this.ws$) {
      this.ws$.next(message);
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  disconnect(): void {
    if (this.ws$) {
      this.ws$.complete();
      this.ws$ = null;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
