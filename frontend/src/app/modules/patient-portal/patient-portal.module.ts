import { NgModule, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PatientPortalRoutingModule } from '@modules/patient-portal/patient-portal-routing.module';
import { AppInitializer } from '@app/app-initializer';
import { SharedModule } from '@shared/shared.module';
import { SharedMaterialModule } from '@shared/shared-material.module';

import { ChatComponent } from '@modules/patient-portal/components/chat/chat.component';
import { WebsocketService } from '@modules/patient-portal/services/websocket.service';
import { ChatService } from '@modules/patient-portal/services/chat.service';

@NgModule({
  declarations: [
    ChatComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    PatientPortalRoutingModule,
    SharedModule,
    SharedMaterialModule
  ],
  providers: [
    WebsocketService,
    ChatService,
    // If you enter this module directly having an authentication file in the browser, it is necessary to
    // initialize the app from the module (For example: entry from a marker of a specific component):
    AppInitializer,
    { provide: APP_INITIALIZER, useFactory: (appInitializer: AppInitializer) => appInitializer.initializeApp(), multi: true, deps: [AppInitializer] }
  ]
})
export class PatientPortalModule { }
