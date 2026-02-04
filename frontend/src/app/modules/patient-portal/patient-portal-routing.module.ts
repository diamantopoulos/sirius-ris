import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from '@modules/patient-portal/components/chat/chat.component';
import { RegisterComponent } from '@modules/patient-portal/components/register/register.component';
import { PatientGuard } from '@guards/patient.guard';

const routes: Routes = [
  { path: '', component: ChatComponent, canActivate: [PatientGuard] },
  { path: 'register', component: RegisterComponent },  // Public - no guard
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientPortalRoutingModule { }
