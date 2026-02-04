import { Component, OnInit } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { PatientBookingService } from '@modules/patient-portal/services/patient-booking.service';
import { I18nService } from '@shared/services/i18n.service';
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-confirm-booking',
  templateUrl: './confirm-booking.component.html',
  styleUrls: ['./confirm-booking.component.css']
})
export class ConfirmBookingComponent implements OnInit {
  //Submission state:
  public isSubmitting: boolean = false;

  //Define Formgroup (Reactive form handling):
  public form!: FormGroup;

  //Set Reactive form:
  private setReactiveForm(fields: any): void{
    this.form = this.formBuilder.group(fields);
  }

  //Inject services, components and router to the constructor:
  constructor(
    private router              : Router,
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
    //Check if slot was selected:
    if(!this.sharedProp.current_datetime || !this.sharedProp.current_slot){
      //Redirect back to slot selection:
      this.router.navigate(['/patient-portal/booking/slot']);
      return;
    }

    //Pre-fill contact from patient data if available:
    if(this.sharedProp.current_patient?.person?.contact){
      this.form.controls['contact'].setValue(this.sharedProp.current_patient.person.contact);
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

      //Save appointment:
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
    //Delete current draft before going back:
    if(this.sharedProp.current_appointment_draft){
      this.sharedFunctions.delete('single', 'appointments_drafts', this.sharedProp.current_appointment_draft);
      this.sharedProp.current_appointment_draft = undefined;
    }
    this.router.navigate(['/patient-portal/booking/slot']);
  }
  //--------------------------------------------------------------------------------------------------------------------//
}
