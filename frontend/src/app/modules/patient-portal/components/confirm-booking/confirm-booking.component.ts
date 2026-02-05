import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { PatientBookingService } from '@modules/patient-portal/services/patient-booking.service';
import { I18nService } from '@shared/services/i18n.service';
import { environment } from '@env/environment';
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-confirm-booking',
  templateUrl: './confirm-booking.component.html',
  styleUrls: ['./confirm-booking.component.css']
})
export class ConfirmBookingComponent implements OnInit {
  //Submission state:
  public isSubmitting: boolean = false;

  //Reschedule mode:
  public isRescheduleMode: boolean = false;
  public rescheduleAppointmentId: string | null = null;

  //Define Formgroup (Reactive form handling):
  public form!: FormGroup;

  //Set Reactive form:
  private setReactiveForm(fields: any): void{
    this.form = this.formBuilder.group(fields);
  }

  //Inject services, components and router to the constructor:
  constructor(
    private router              : Router,
    private http                : HttpClient,
    public formBuilder          : FormBuilder,
    public sharedProp           : SharedPropertiesService,
    public sharedFunctions      : SharedFunctionsService,
    public patientBookingService: PatientBookingService,
    private i18n                : I18nService
  ) {
    //Get Logged User Information:
    this.sharedProp.userLogged = this.sharedFunctions.getUserInfo();

    //Set Reactive Form:
    this.setReactiveForm({
      contact           : [ '', [Validators.required, Validators.minLength(8)] ],
      height            : [ '', [Validators.required, Validators.min(30), Validators.max(250)] ],
      weight            : [ '', [Validators.required, Validators.min(1), Validators.max(500)] ],
      accept_terms      : [ false, [Validators.requiredTrue] ]
    });
  }

  ngOnInit(): void {
    //Check for reschedule mode:
    this.rescheduleAppointmentId = sessionStorage.getItem('rescheduleAppointmentId');
    this.isRescheduleMode = !!this.rescheduleAppointmentId;

    //Check if slot was selected:
    if(!this.sharedProp.current_datetime || !this.sharedProp.current_slot){
      //Redirect back to slot selection:
      this.router.navigate(['/patient-portal/booking/slot']);
      return;
    }

    //Pre-fill form for reschedule mode with existing appointment data:
    if (this.isRescheduleMode) {
      const storedAppointment = sessionStorage.getItem('rescheduleAppointment');
      if (storedAppointment) {
        const appointment = JSON.parse(storedAppointment);

        //Pre-fill contact:
        if (appointment.contact) {
          this.form.controls['contact'].setValue(appointment.contact);
        } else if (this.sharedProp.current_patient?.person?.contact) {
          this.form.controls['contact'].setValue(this.sharedProp.current_patient.person.contact);
        }

        //Pre-fill height and weight from private_health:
        if (appointment.private_health) {
          if (appointment.private_health.height) {
            this.form.controls['height'].setValue(appointment.private_health.height);
          }
          if (appointment.private_health.weight) {
            this.form.controls['weight'].setValue(appointment.private_health.weight);
          }
        }

        //Pre-check terms for reschedule (they already accepted before):
        this.form.controls['accept_terms'].setValue(true);
      }
    } else {
      //Pre-fill contact from patient data if available (new booking):
      if(this.sharedProp.current_patient?.person?.contact){
        this.form.controls['contact'].setValue(this.sharedProp.current_patient.person.contact);
      }
    }
  }

  //--------------------------------------------------------------------------------------------------------------------//
  // ON SUBMIT:
  //--------------------------------------------------------------------------------------------------------------------//
  onSubmit(){
    //Validate fields:
    if(this.form.valid && !this.isSubmitting){
      this.isSubmitting = true;

      //Store form data in shared properties:
      this.sharedProp.current_contact = this.form.value.contact;
      this.sharedProp.current_private_health = {
        height: this.form.value.height,
        weight: this.form.value.weight
      };

      //Handle reschedule mode - update existing appointment:
      if (this.isRescheduleMode && this.rescheduleAppointmentId) {
        const updateData: any = {
          start: this.sharedProp.current_datetime.start + '.000Z',
          end: this.sharedProp.current_datetime.end + '.000Z',
          fk_slot: this.sharedProp.current_slot,
          private_health: this.sharedProp.current_private_health
        };

        this.sharedFunctions.save('update', 'appointments', this.rescheduleAppointmentId, updateData, ['start', 'end', 'fk_slot', 'private_health'], (res: any) => {
          this.isSubmitting = false;

          if (res.success === true) {
            //Send reschedule notification:
            this.sendNotification('appointment_rescheduled', this.rescheduleAppointmentId!);

            //Clear reschedule data from sessionStorage:
            sessionStorage.removeItem('rescheduleAppointment');
            sessionStorage.removeItem('rescheduleAppointmentId');

            //Show success message:
            this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.RESCHEDULE_SUCCESS') || 'Appointment rescheduled successfully');

            //Reset booking state:
            this.patientBookingService.resetBookingState();

            //Navigate to appointments list:
            this.router.navigate(['/patient-portal/appointments']);
          } else {
            //Show error message:
            this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.RESCHEDULE_ERROR') || 'Failed to reschedule appointment');
          }
        });
        return;
      }

      //Save appointment (normal booking flow):
      this.patientBookingService.savePatientAppointment((res) => {
        this.isSubmitting = false;

        if(res.success === true){
          //Show success message:
          this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.SUCCESS_MESSAGE'));

          //Reset booking state:
          this.patientBookingService.resetBookingState();

          //Navigate to patient portal home:
          this.router.navigate(['/patient-portal']);
        } else {
          //Show error message:
          this.sharedFunctions.sendMessage(res.message || this.i18n.instant('PATIENT_PORTAL.BOOKING.ERROR_MESSAGE'));
        }
      });
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON BACK:
  //--------------------------------------------------------------------------------------------------------------------//
  onBack(){
    //Delete current draft before going back (only for normal booking, not reschedule):
    if(!this.isRescheduleMode && this.sharedProp.current_appointment_draft){
      this.sharedFunctions.delete('single', 'appointments_drafts', this.sharedProp.current_appointment_draft);
      this.sharedProp.current_appointment_draft = undefined;
    }

    //Navigate back to slot selection:
    if (this.isRescheduleMode && this.rescheduleAppointmentId) {
      this.router.navigate(['/patient-portal/booking/slot'], {
        queryParams: { reschedule: this.rescheduleAppointmentId }
      });
    } else {
      this.router.navigate(['/patient-portal/booking/slot']);
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // SEND NOTIFICATION:
  //--------------------------------------------------------------------------------------------------------------------//
  private sendNotification(type: string, appointmentId: string): void {
    const userLogged = this.sharedFunctions.getUserInfo();

    //Format date and time:
    const appointmentDate = new Date(this.sharedProp.current_datetime?.start + '.000Z');
    const dateStr = appointmentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const notificationPayload = {
      patientId: userLogged.user_id,
      type: type,
      appointmentId: appointmentId,
      data: {
        procedure: this.sharedProp.current_procedure?.name || 'Appointment',
        date: dateStr,
        time: timeStr,
        location: this.sharedProp.current_imaging?.service?.name || 'See portal for details'
      }
    };

    const notificationUrl = environment.notificationServiceUrl || 'http://localhost:3004';
    this.http.post(`${notificationUrl}/api/notify`, notificationPayload).subscribe({
      next: () => console.log('Notification sent successfully'),
      error: (err) => console.warn('Failed to send notification:', err.message)
    });
  }
  //--------------------------------------------------------------------------------------------------------------------//
}
