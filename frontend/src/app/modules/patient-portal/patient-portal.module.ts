import { NgModule, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { PatientPortalRoutingModule } from '@modules/patient-portal/patient-portal-routing.module';
import { AppInitializer } from '@app/app-initializer';
import { SharedModule } from '@shared/shared.module';
import { SharedMaterialModule } from '@shared/shared-material.module';

// FullCalendar
import { FullCalendarModule } from '@fullcalendar/angular';

// Components
import { PatientHomeComponent } from '@modules/patient-portal/components/home/home.component';
import { ChatComponent } from '@modules/patient-portal/components/chat/chat.component';
import { RegisterComponent } from '@modules/patient-portal/components/register/register.component';
import { BookingComponent } from '@modules/patient-portal/components/booking/booking.component';
import { SelectProcedurePatientComponent } from '@modules/patient-portal/components/select-procedure-patient/select-procedure-patient.component';
import { SelectSlotPatientComponent } from '@modules/patient-portal/components/select-slot-patient/select-slot-patient.component';
import { ConfirmBookingComponent } from '@modules/patient-portal/components/confirm-booking/confirm-booking.component';

// Services
import { WebsocketService } from '@modules/patient-portal/services/websocket.service';
import { ChatService } from '@modules/patient-portal/services/chat.service';
import { PatientBookingService } from '@modules/patient-portal/services/patient-booking.service';

@NgModule({
  declarations: [
    PatientHomeComponent,
    ChatComponent,
    RegisterComponent,
    BookingComponent,
    SelectProcedurePatientComponent,
    SelectSlotPatientComponent,
    ConfirmBookingComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PatientPortalRoutingModule,
    SharedModule,
    SharedMaterialModule,
    FullCalendarModule
  ],
  providers: [
    WebsocketService,
    ChatService,
    PatientBookingService,
    // If you enter this module directly having an authentication file in the browser, it is necessary to
    // initialize the app from the module (For example: entry from a marker of a specific component):
    AppInitializer,
    { provide: APP_INITIALIZER, useFactory: (appInitializer: AppInitializer) => appInitializer.initializeApp(), multi: true, deps: [AppInitializer] }
  ]
})
export class PatientPortalModule { }
