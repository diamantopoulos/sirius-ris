import { Component, OnInit } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router } from '@angular/router';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { I18nService } from '@shared/services/i18n.service';
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-patient-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class PatientHomeComponent implements OnInit {
  //Inject services to the constructor:
  constructor(
    private router          : Router,
    public sharedProp       : SharedPropertiesService,
    public sharedFunctions  : SharedFunctionsService,
    private i18n            : I18nService
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
  }

  ngOnInit(): void {}

  //Navigate to my appointments:
  goToMyAppointments(): void {
    this.router.navigate(['/patient-portal/appointments']);
  }

  //Navigate to my calendar:
  goToMyCalendar(): void {
    this.router.navigate(['/patient-portal/calendar']);
  }

  //Navigate to chat booking:
  goToChatBooking(): void {
    this.router.navigate(['/patient-portal/chat']);
  }

  //Navigate to calendar booking:
  goToCalendarBooking(): void {
    this.router.navigate(['/patient-portal/booking']);
  }
}
