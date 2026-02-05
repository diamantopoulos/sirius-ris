import { Component, OnInit, OnDestroy } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router } from '@angular/router';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { PatientBookingService } from '@modules/patient-portal/services/patient-booking.service';
import { I18nService } from '@shared/services/i18n.service';
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-booking',
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css']
})
export class BookingComponent implements OnInit, OnDestroy {
  //Wizard steps:
  public steps = [
    { path: 'procedure', label: 'PATIENT_PORTAL.BOOKING.STEPS.PROCEDURE', icon: 'health_and_safety' },
    { path: 'slot', label: 'PATIENT_PORTAL.BOOKING.STEPS.SLOT', icon: 'event_available' },
    { path: 'confirm', label: 'PATIENT_PORTAL.BOOKING.STEPS.CONFIRM', icon: 'check_circle' }
  ];

  //Current step index:
  public currentStepIndex: number = 0;

  //Inject services, components and router to the constructor:
  constructor(
    private router              : Router,
    public sharedProp           : SharedPropertiesService,
    public sharedFunctions      : SharedFunctionsService,
    public patientBookingService: PatientBookingService,
    private i18n                : I18nService
  ) {
    //Get Logged User Information:
    this.sharedProp.userLogged = this.sharedFunctions.getUserInfo();

    //Clear action bar (reset from other pages like Study Results):
    this.sharedProp.actionSetter({
      content_title       : '',
      content_icon        : '',
      add_button          : false,
      filters_form        : false
    });

    //Set current patient from logged user (patients book for themselves):
    this.setCurrentPatient();
  }

  ngOnInit(): void {
    //Update step based on current route:
    this.updateCurrentStep();

    //Subscribe to router events to track step changes:
    this.router.events.subscribe(() => {
      this.updateCurrentStep();
    });
  }

  ngOnDestroy(): void {
    //Reset booking state when leaving the booking flow:
    this.patientBookingService.resetBookingState();
  }

  //--------------------------------------------------------------------------------------------------------------------//
  // SET CURRENT PATIENT:
  //--------------------------------------------------------------------------------------------------------------------//
  private setCurrentPatient(): void {
    //Patient is booking for themselves, so get their user info from JWT token:
    const userInfo = this.sharedFunctions.getUserInfo();

    //Set current patient from logged in user (using data available in JWT):
    if(userInfo && userInfo.user_id){
      //Construct minimal current_patient object from JWT data:
      //This avoids needing 'users' API permission for patients
      this.sharedProp.current_patient = {
        _id: userInfo.user_id,
        person: {
          _id: userInfo.person_id,
          name_01: userInfo.name,
          surname_01: userInfo.surname
        },
        status: true
      };
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // UPDATE CURRENT STEP:
  //--------------------------------------------------------------------------------------------------------------------//
  private updateCurrentStep(): void {
    const currentUrl = this.router.url;

    this.steps.forEach((step, index) => {
      if(currentUrl.includes(step.path)){
        this.currentStepIndex = index;
      }
    });
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // IS STEP COMPLETED:
  //--------------------------------------------------------------------------------------------------------------------//
  isStepCompleted(stepIndex: number): boolean {
    return stepIndex < this.currentStepIndex;
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // IS STEP ACTIVE:
  //--------------------------------------------------------------------------------------------------------------------//
  isStepActive(stepIndex: number): boolean {
    return stepIndex === this.currentStepIndex;
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON CANCEL:
  //--------------------------------------------------------------------------------------------------------------------//
  onCancel(): void {
    //Reset booking state:
    this.patientBookingService.resetBookingState();

    //Navigate back to patient portal home:
    this.router.navigate(['/patient-portal']);
  }
  //--------------------------------------------------------------------------------------------------------------------//
}
