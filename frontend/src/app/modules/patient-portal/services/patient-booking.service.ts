import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router } from '@angular/router';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { I18nService } from '@shared/services/i18n.service';
import { environment } from '@env/environment';
//--------------------------------------------------------------------------------------------------------------------//

@Injectable({
  providedIn: 'root'
})
export class PatientBookingService {
  //Set references objects:
  public availableOrganizations : any;
  public availableBranches      : any;
  public availableServices      : any;
  public availableCategories    : any;
  public availableProcedures    : any;

  //Inject services to the constructor:
  constructor(
    private router          : Router,
    private http            : HttpClient,
    public sharedProp       : SharedPropertiesService,
    private sharedFunctions : SharedFunctionsService,
    public i18n             : I18nService
  ) { }

  //--------------------------------------------------------------------------------------------------------------------//
  // FIND REFERENCES:
  //--------------------------------------------------------------------------------------------------------------------//
  findReferences(params: any = {}){
    //Find organizations:
    this.sharedFunctions.find('organizations', params, (res) => {
      this.availableOrganizations = res.data;
    });

    //Find branches:
    this.sharedFunctions.find('branches', params, (res) => {
      this.availableBranches = res.data;
    });

    //Find services:
    this.sharedFunctions.find('services', params, (res) => {
      this.availableServices = res.data;
    });
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // SAVE PATIENT APPOINTMENT:
  //--------------------------------------------------------------------------------------------------------------------//
  savePatientAppointment(callback = (res: any) => {}){
    //Get logged user info:
    const userLogged = this.sharedFunctions.getUserInfo();

    //Build appointment data (minimal for patient self-service):
    const appointmentSaveData: any = {
      imaging: {
        organization  : this.sharedProp.current_imaging.organization._id,
        branch        : this.sharedProp.current_imaging.branch._id,
        service       : this.sharedProp.current_imaging.service._id
      },
      fk_patient      : userLogged.user_id,
      start           : this.sharedProp.current_datetime.start + '.000Z',
      end             : this.sharedProp.current_datetime.end + '.000Z',
      flow_state      : 'A01',  // Coordinated
      fk_slot         : this.sharedProp.current_slot,
      fk_procedure    : this.sharedProp.current_procedure._id,
      urgency         : false,  // Patients cannot set urgency
      outpatient      : true,   // Patient self-service always outpatient
      status          : true,   // Active appointment

      // Default referring to same organization
      referring: {
        organization: this.sharedProp.current_imaging.organization._id
      },

      // Default reporting to same as imaging
      reporting: {
        organization  : this.sharedProp.current_imaging.organization._id,
        branch        : this.sharedProp.current_imaging.branch._id,
        service       : this.sharedProp.current_imaging.service._id
      },

      // Minimal contrast info
      contrast: {
        use_contrast: false
      },

      // Contact and health info from form
      contact: this.sharedProp.current_contact || '',
      private_health: {
        // Required numeric fields from form
        height: this.sharedProp.current_private_health?.height || 0,
        weight: this.sharedProp.current_private_health?.weight || 0,

        // Required boolean fields
        diabetes: false,
        hypertension: false,
        epoc: false,
        smoking: false,
        malnutrition: false,
        obesity: false,
        hiv: false,
        renal_insufficiency: false,
        heart_failure: false,
        ischemic_heart_disease: false,
        valvulopathy: false,
        arrhythmia: false,
        cancer: false,
        dementia: false,
        claustrophobia: false,
        asthma: false,
        hyperthyroidism: false,
        hypothyroidism: false,
        pregnancy: false,

        // Optional string fields (min 3 chars required)
        medication: 'N/A',
        allergies: 'N/A',
        other: 'N/A',

        // Required nested objects
        implants: {
          cochlear_implant: false,
          cardiac_stent: false,
          metal_prostheses: false,
          metal_shards: false,
          pacemaker: false,
          other: 'N/A'
        },
        covid19: {
          had_covid: false,
          vaccinated: false,
          details: 'N/A'
        }
      },

      // Report before based on procedure delay
      report_before: this.calculateReportBefore()
    };

    //Save appointment:
    this.sharedFunctions.save('insert', 'appointments', '', appointmentSaveData, [], (res) => {
      //Delete appointment draft if successful:
      if(res.success === true && this.sharedProp.current_appointment_draft){
        this.sharedFunctions.delete('single', 'appointments_drafts', this.sharedProp.current_appointment_draft);
      }

      //Send notification if successful:
      if(res.success === true){
        this.sendBookingNotification(res.data, 'appointment_booked');
      }

      //Execute callback:
      callback(res);
    });
  }

  //--------------------------------------------------------------------------------------------------------------------//
  // SEND BOOKING NOTIFICATION:
  // Sends notification to patient via notification-service (Telegram, email, etc.)
  //--------------------------------------------------------------------------------------------------------------------//
  private sendBookingNotification(appointmentData: any, type: string): void {
    const userLogged = this.sharedFunctions.getUserInfo();

    //Format date and time from appointment datetime:
    const appointmentDate = new Date(this.sharedProp.current_datetime?.start + '.000Z');
    const dateStr = appointmentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    //Build notification payload (matching notification-service expected format):
    const notificationPayload = {
      patientId: userLogged.user_id,
      type: type,
      appointmentId: appointmentData._id,
      data: {
        procedure: this.sharedProp.current_procedure?.name || 'Appointment',
        date: dateStr,
        time: timeStr,
        location: this.sharedProp.current_imaging?.service?.name || 'See portal for details'
      }
    };

    //Send notification (fire and forget - don't block on result):
    const notificationUrl = environment.notificationServiceUrl || 'http://localhost:3004';
    this.http.post(`${notificationUrl}/api/notify`, notificationPayload).subscribe({
      next: () => console.log('Notification sent successfully'),
      error: (err) => console.warn('Failed to send notification:', err.message)
    });
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // CALCULATE REPORT BEFORE DATE:
  //--------------------------------------------------------------------------------------------------------------------//
  private calculateReportBefore(): string {
    let reportBefore = new Date(this.sharedProp.current_datetime.start);

    //Add reporting delay if defined in procedure:
    if(this.sharedProp.current_procedure?.reporting_delay){
      reportBefore.setDate(reportBefore.getDate() + this.sharedProp.current_procedure.reporting_delay);
    }

    return reportBefore.toISOString();
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // RESET BOOKING STATE:
  //--------------------------------------------------------------------------------------------------------------------//
  resetBookingState(){
    this.sharedProp.current_imaging = undefined;
    this.sharedProp.current_modality = '';
    this.sharedProp.current_procedure = undefined;
    this.sharedProp.current_slot = undefined;
    this.sharedProp.current_datetime = undefined;
    this.sharedProp.current_equipment = undefined;
    this.sharedProp.current_appointment_draft = undefined;
    this.sharedProp.current_contact = undefined;
    this.sharedProp.current_private_health = undefined;
  }
  //--------------------------------------------------------------------------------------------------------------------//
}
