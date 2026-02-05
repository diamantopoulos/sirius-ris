import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { I18nService } from '@shared/services/i18n.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { environment } from '@env/environment';

@Component({
  selector: 'app-my-appointments',
  templateUrl: './my-appointments.component.html',
  styleUrls: ['./my-appointments.component.css']
})
export class MyAppointmentsComponent implements OnInit {
  public loading: boolean = true;
  public appointments: any[] = [];
  public patientId: string = '';

  // Displayed columns for patient view (simplified)
  public displayedColumns: string[] = [
    'date',
    'time',
    'procedure',
    'status',
    'actions'
  ];

  constructor(
    public sharedProp: SharedPropertiesService,
    public sharedFunctions: SharedFunctionsService,
    private i18n: I18nService,
    private router: Router,
    private dialog: MatDialog,
    private http: HttpClient
  ) {
    // Get logged user info
    this.sharedProp.userLogged = this.sharedFunctions.getUserInfo();
    this.patientId = this.sharedProp.userLogged._id;

    //Clear action bar (reset from other pages like Study Results):
    this.sharedProp.actionSetter({
      content_title       : '',
      content_icon        : '',
      add_button          : false,
      filters_form        : false
    });
  }

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.loading = true;

    // Query appointments filtered by patient ID
    const params: any = {
      'filter[patient._id]': this.patientId,
      'filter[status]': true,
      'sort[start]': -1,
      'proj[patient]': 1,
      'proj[start]': 1,
      'proj[end]': 1,
      'proj[procedure]': 1,
      'proj[imaging]': 1,
      'proj[slot]': 1,
      'proj[status]': 1,
      'proj[flow_state]': 1,
      'proj[urgency]': 1,
      'proj[private_health]': 1,
      'proj[contact]': 1
    };

    this.sharedFunctions.find('appointments', params, (res: any) => {
      this.loading = false;
      if (res.success === true && res.data) {
        this.appointments = res.data;
      } else {
        this.appointments = [];
      }
    });
  }

  getStatusLabel(appointment: any): string {
    if (!appointment.status) return 'Cancelled';

    switch (appointment.flow_state) {
      case 'A01': return 'Scheduled';
      case 'A02': return 'Checked In';
      case 'A03': return 'In Progress';
      case 'A04': return 'Completed';
      case 'A05': return 'Reported';
      default: return 'Scheduled';
    }
  }

  getStatusClass(appointment: any): string {
    if (!appointment.status) return 'status-cancelled';

    switch (appointment.flow_state) {
      case 'A04':
      case 'A05': return 'status-completed';
      case 'A02':
      case 'A03': return 'status-in-progress';
      default: return 'status-scheduled';
    }
  }

  formatDate(appointment: any): string {
    if (!appointment?.start) return '-';
    const date = new Date(appointment.start);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatTime(appointment: any): string {
    if (!appointment?.start || !appointment?.end) return '-';
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    const startTime = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const endTime = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${startTime} - ${endTime}`;
  }

  getProcedureName(appointment: any): string {
    return appointment.procedure?.name || 'Medical Imaging';
  }

  // Check if appointment can be edited (rescheduled)
  canEdit(appointment: any): boolean {
    // Can only edit if scheduled (A01) and in the future
    if (!appointment.status || appointment.flow_state !== 'A01') return false;

    const appointmentDate = new Date(appointment.start);
    const now = new Date();
    return appointmentDate > now;
  }

  // Check if appointment can be deleted (cancelled)
  canDelete(appointment: any): boolean {
    // Same rules as edit - can only delete future scheduled appointments
    return this.canEdit(appointment);
  }

  // Navigate to reschedule flow
  editAppointment(appointment: any): void {
    // Store appointment data for rescheduling in sessionStorage
    sessionStorage.setItem('rescheduleAppointment', JSON.stringify(appointment));
    // Navigate to booking flow with reschedule mode
    this.router.navigate(['/patient-portal/booking/slot'], {
      queryParams: { reschedule: appointment._id }
    });
  }

  // Delete (cancel) appointment with confirmation dialog
  deleteAppointment(appointment: any): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Cancel Appointment',
        message: `Are you sure you want to cancel your appointment for ${this.getProcedureName(appointment)} on ${this.formatDate(appointment)}?`,
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Keep It'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const data = {
          status: false
        };

        this.sharedFunctions.save('update', 'appointments', appointment._id, data, ['status'], (res: any) => {
          if (res.success) {
            //Send cancellation notification:
            this.sendNotification('appointment_cancelled', appointment);

            this.sharedFunctions.sendMessage('Appointment cancelled successfully');
            this.loadAppointments();
          } else {
            this.sharedFunctions.sendMessage('Failed to cancel appointment');
          }
        });
      }
    });
  }

  // Send notification to patient via notification-service
  private sendNotification(type: string, appointment: any): void {
    //Format date and time:
    const appointmentDate = new Date(appointment.start);
    const dateStr = appointmentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const notificationPayload = {
      patientId: this.patientId,
      type: type,
      appointmentId: appointment._id,
      data: {
        procedure: this.getProcedureName(appointment),
        date: dateStr,
        time: timeStr,
        location: appointment.imaging?.service?.name || 'See portal for details'
      }
    };

    const notificationUrl = environment.notificationServiceUrl || 'http://localhost:3004';
    this.http.post(`${notificationUrl}/api/notify`, notificationPayload).subscribe({
      next: () => console.log('Cancellation notification sent successfully'),
      error: (err) => console.warn('Failed to send cancellation notification:', err.message)
    });
  }
}
