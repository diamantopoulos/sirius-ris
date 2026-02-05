import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientHomeComponent } from '@modules/patient-portal/components/home/home.component';
import { ChatComponent } from '@modules/patient-portal/components/chat/chat.component';
import { RegisterComponent } from '@modules/patient-portal/components/register/register.component';
import { BookingComponent } from '@modules/patient-portal/components/booking/booking.component';
import { SelectProcedurePatientComponent } from '@modules/patient-portal/components/select-procedure-patient/select-procedure-patient.component';
import { SelectSlotPatientComponent } from '@modules/patient-portal/components/select-slot-patient/select-slot-patient.component';
import { ConfirmBookingComponent } from '@modules/patient-portal/components/confirm-booking/confirm-booking.component';
import { MyAppointmentsComponent } from '@modules/patient-portal/components/my-appointments/my-appointments.component';
import { MyCalendarComponent } from '@modules/patient-portal/components/my-calendar/my-calendar.component';
import { SettingsComponent } from '@modules/patient-portal/components/settings/settings.component';
import { PatientGuard } from '@guards/patient.guard';

const routes: Routes = [
  { path: '', component: PatientHomeComponent, canActivate: [PatientGuard] },
  { path: 'chat', component: ChatComponent, canActivate: [PatientGuard] },
  { path: 'appointments', component: MyAppointmentsComponent, canActivate: [PatientGuard] },
  { path: 'calendar', component: MyCalendarComponent, canActivate: [PatientGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [PatientGuard] },
  { path: 'register', component: RegisterComponent },  // Public - no guard
  {
    path: 'booking',
    component: BookingComponent,
    canActivate: [PatientGuard],
    children: [
      { path: '', redirectTo: 'procedure', pathMatch: 'full' },
      { path: 'procedure', component: SelectProcedurePatientComponent },
      { path: 'slot', component: SelectSlotPatientComponent },
      { path: 'confirm', component: ConfirmBookingComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientPortalRoutingModule { }
