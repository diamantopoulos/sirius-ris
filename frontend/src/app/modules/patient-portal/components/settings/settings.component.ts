import { Component, OnInit } from '@angular/core';
import { NotificationService, TelegramStatus, TelegramLinkResponse } from '@modules/patient-portal/services/notification.service';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  // Telegram status
  telegramStatus: TelegramStatus = { isLinked: false };
  isLoadingStatus = true;

  // Link generation
  linkData: TelegramLinkResponse | null = null;
  isGeneratingLink = false;
  linkError: string | null = null;

  // Unlink
  isUnlinking = false;

  // Timer for link expiration
  linkExpiresIn = 0;
  private linkTimer: any;

  constructor(
    private notificationService: NotificationService,
    private sharedProp: SharedPropertiesService,
    private snackBar: MatSnackBar
  ) {
    // Clear action bar
    this.sharedProp.actionSetter({
      content_title: '',
      content_icon: '',
      add_button: false,
      filters_form: false
    });
  }

  ngOnInit(): void {
    this.loadTelegramStatus();
  }

  ngOnDestroy(): void {
    if (this.linkTimer) {
      clearInterval(this.linkTimer);
    }
  }

  /**
   * Load current Telegram link status
   */
  loadTelegramStatus(): void {
    this.isLoadingStatus = true;
    this.notificationService.getTelegramStatus().subscribe({
      next: (status) => {
        this.telegramStatus = status;
        this.isLoadingStatus = false;
      },
      error: (err) => {
        console.error('Failed to load Telegram status:', err);
        this.isLoadingStatus = false;
      }
    });
  }

  /**
   * Generate a new Telegram link
   */
  generateLink(): void {
    this.isGeneratingLink = true;
    this.linkError = null;
    this.linkData = null;

    this.notificationService.generateTelegramLink().subscribe({
      next: (data) => {
        this.linkData = data;
        this.isGeneratingLink = false;
        this.startLinkTimer(data.expiresIn);
      },
      error: (err) => {
        console.error('Failed to generate link:', err);
        this.isGeneratingLink = false;
        if (err.error?.error === 'Already linked') {
          this.linkError = 'Your account is already linked to Telegram.';
          this.loadTelegramStatus(); // Refresh status
        } else {
          this.linkError = 'Failed to generate link. Please try again.';
        }
      }
    });
  }

  /**
   * Start countdown timer for link expiration
   */
  private startLinkTimer(seconds: number): void {
    this.linkExpiresIn = seconds;

    if (this.linkTimer) {
      clearInterval(this.linkTimer);
    }

    this.linkTimer = setInterval(() => {
      this.linkExpiresIn--;
      if (this.linkExpiresIn <= 0) {
        clearInterval(this.linkTimer);
        this.linkData = null;
        this.linkError = 'Link expired. Please generate a new one.';
      }
    }, 1000);
  }

  /**
   * Copy deep link to clipboard
   */
  copyLink(): void {
    if (this.linkData?.deepLink) {
      navigator.clipboard.writeText(this.linkData.deepLink).then(() => {
        this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 2000 });
      });
    }
  }

  /**
   * Open deep link in new tab/app
   */
  openLink(): void {
    if (this.linkData?.deepLink) {
      window.open(this.linkData.deepLink, '_blank');
    }
  }

  /**
   * Unlink Telegram account
   */
  unlinkTelegram(): void {
    if (!confirm('Are you sure you want to unlink your Telegram account? You will stop receiving appointment notifications.')) {
      return;
    }

    this.isUnlinking = true;

    this.notificationService.unlinkTelegram().subscribe({
      next: () => {
        this.telegramStatus = { isLinked: false };
        this.isUnlinking = false;
        this.linkData = null;
        this.snackBar.open('Telegram account unlinked', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to unlink:', err);
        this.isUnlinking = false;
        this.snackBar.open('Failed to unlink account', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Format expiration time
   */
  formatExpiration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
