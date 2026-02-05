import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { environment } from '@env/environment';

export interface TelegramLinkResponse {
  success: boolean;
  deepLink: string;
  qrCode: string;  // Base64 data URL
  expiresIn: number;  // seconds
}

export interface TelegramStatus {
  isLinked: boolean;
  username?: string;
  linkedAt?: string;
}

/**
 * Service for managing patient notification settings (Telegram integration)
 */
@Injectable()
export class NotificationService {
  private readonly API_URL = environment.notificationServiceUrl || 'http://localhost:3004';

  constructor(
    private http: HttpClient,
    private sharedFunctions: SharedFunctionsService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.sharedFunctions.readToken() || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Get Telegram link status for current patient
   */
  getTelegramStatus(): Observable<TelegramStatus> {
    return this.http.get<TelegramStatus>(
      `${this.API_URL}/api/telegram/status`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error getting Telegram status:', err);
        return of({ isLinked: false });
      })
    );
  }

  /**
   * Generate Telegram link (QR code and deep link)
   */
  generateTelegramLink(): Observable<TelegramLinkResponse> {
    return this.http.get<TelegramLinkResponse>(
      `${this.API_URL}/api/telegram/link`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Unlink Telegram account
   */
  unlinkTelegram(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.API_URL}/api/telegram/unlink`,
      { headers: this.getHeaders() }
    );
  }
}
