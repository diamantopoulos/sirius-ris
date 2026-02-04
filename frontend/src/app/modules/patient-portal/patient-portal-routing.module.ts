import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from '@modules/patient-portal/components/chat/chat.component';
import { RegisterComponent } from '@modules/patient-portal/components/register/register.component';

const routes: Routes = [
  { path: '', component: ChatComponent },
  { path: 'register', component: RegisterComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientPortalRoutingModule { }
