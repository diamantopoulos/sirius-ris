import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { FullCalendarComponent, CalendarOptions } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AppointmentDetailsDialogComponent } from '../appointment-details-dialog/appointment-details-dialog.component';

@Component({
  selector: 'app-my-calendar',
  templateUrl: './my-calendar.component.html',
  styleUrls: ['./my-calendar.component.css']
})
export class MyCalendarComponent implements OnInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  public loading: boolean = true;
  public patientId: string = '';
  public calendarEvents: any[] = [];

  public calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    weekends: true,
    editable: false,
    selectable: false,
    selectMirror: false,
    events: [],
    eventClick: this.handleEventClick.bind(this),
    height: 'auto',
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: 'short'
    }
  };

  constructor(
    public sharedProp: SharedPropertiesService,
    public sharedFunctions: SharedFunctionsService,
    private dialog: MatDialog
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

    const params: any = {
      'filter[patient._id]': this.patientId,
      'filter[status]': true,
      'proj[patient]': 1,
      'proj[start]': 1,
      'proj[end]': 1,
      'proj[procedure]': 1,
      'proj[imaging]': 1,
      'proj[status]': 1,
      'proj[flow_state]': 1
    };

    this.sharedFunctions.find('appointments', params, (res: any) => {
      this.loading = false;
      if (res.success === true && res.data) {
        this.calendarEvents = this.transformToCalendarEvents(res.data);
        this.calendarOptions = {
          ...this.calendarOptions,
          events: this.calendarEvents
        };
      }
    });
  }

  transformToCalendarEvents(appointments: any[]): any[] {
    return appointments.map(apt => {
      if (!apt.start) return null;

      // Determine color based on status
      let backgroundColor = '#1976d2'; // scheduled - blue
      let borderColor = '#1565c0';

      if (!apt.status) {
        backgroundColor = '#d32f2f'; // cancelled - red
        borderColor = '#c62828';
      } else if (apt.flow_state === 'A04' || apt.flow_state === 'A05') {
        backgroundColor = '#388e3c'; // completed - green
        borderColor = '#2e7d32';
      } else if (apt.flow_state === 'A02' || apt.flow_state === 'A03') {
        backgroundColor = '#f57c00'; // in progress - orange
        borderColor = '#ef6c00';
      }

      return {
        id: apt._id,
        title: apt.procedure?.name || 'Medical Imaging',
        start: apt.start,
        end: apt.end,
        backgroundColor: backgroundColor,
        borderColor: borderColor,
        extendedProps: {
          appointment: apt,
          status: this.getStatusLabel(apt),
          location: apt.imaging?.branch?.short_name || ''
        }
      };
    }).filter(event => event !== null);
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

  handleEventClick(clickInfo: any): void {
    const apt = clickInfo.event.extendedProps.appointment;

    // Determine status class for styling
    let statusClass = 'scheduled';
    if (!apt.status) {
      statusClass = 'cancelled';
    } else if (apt.flow_state === 'A04' || apt.flow_state === 'A05') {
      statusClass = 'completed';
    } else if (apt.flow_state === 'A02' || apt.flow_state === 'A03') {
      statusClass = 'in-progress';
    }

    // Open dialog with appointment details
    this.dialog.open(AppointmentDetailsDialogComponent, {
      data: {
        procedure: apt.procedure?.name || 'Medical Imaging',
        start: apt.start,
        end: apt.end,
        status: clickInfo.event.extendedProps.status,
        statusClass: statusClass,
        location: apt.imaging?.branch?.short_name || 'Main Clinic'
      },
      width: '400px'
    });
  }
}
