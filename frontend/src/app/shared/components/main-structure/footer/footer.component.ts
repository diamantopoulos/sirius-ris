import { Component, OnInit } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { AppStatusService } from '@shared/services/app-status.service';   // App Status Service (versions and status)
import { environment } from '@env/environment';                           // Enviroments
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {
  //Set component properties:
  public sirius_db_version        : string = 'unknown';
  public sirius_backend_version   : string = 'unknown';
  public sirius_frontend_version  : string = 'unknown';
  public medislot_version         : string = '';

  //Inject services to the constructor:
  constructor(
    public appStatus: AppStatusService
  ){
    //Set Frontend Version from environment:
    this.sirius_frontend_version = environment.version;

    //Get App Status info:
    this.appStatus.getAppStatus(res => {
      //Set current versions:
      this.sirius_db_version = res.sirius_db.version;
      this.sirius_backend_version = res.sirius_backend.version;
    });

    //Get MediSlot booking-agent version:
    this.fetchMediSlotVersion();
  }

  ngOnInit(): void {}

  //Fetch MediSlot version from booking-agent health endpoint:
  private fetchMediSlotVersion(): void {
    fetch(`${environment.bookingAgentUrl}/health`)
      .then(res => res.json())
      .then(data => {
        if (data.version) {
          this.medislot_version = data.version;
        }
      })
      .catch(err => {
        console.warn('Could not fetch MediSlot version:', err);
      });
  }

}
