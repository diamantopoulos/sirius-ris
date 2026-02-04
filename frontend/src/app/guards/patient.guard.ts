import { Injectable } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router, CanActivate } from '@angular/router';                                  // Router and Guard CanActivate
import { UsersAuthService } from '@auth/services/users-auth.service';                   // Users Auth Service
import { SharedPropertiesService } from '@shared/services/shared-properties.service';   // Shared Properties
import { SharedFunctionsService } from '@shared/services/shared-functions.service';     // Shared Functions
//--------------------------------------------------------------------------------------------------------------------//

@Injectable({
  providedIn: 'root'
})
export class PatientGuard implements CanActivate {

  //Inject services to the constructor:
  constructor(
    private userAuth: UsersAuthService,
    private router: Router,
    public sharedProp: SharedPropertiesService,
    private sharedFunctions: SharedFunctionsService
  ) { }

  canActivate(): boolean {
    //Check authentication:
    if (!this.userAuth.userIsLogged()) {
      this.router.navigate(['/signin']);
      return false;
    }

    //Refresh isLogged value for display or not the toolbar and sidebar:
    this.sharedProp.checkIsLogged();

    //Get user information to check role:
    const userInfo = this.sharedFunctions.getUserInfo();

    //Check if user has Patient role (role 9):
    if (!userInfo || !userInfo.permissions || userInfo.permissions.length === 0 || userInfo.permissions[0].role !== 9) {
      //Redirect non-patients to start page:
      this.router.navigate(['/start']);
      return false;
    }

    //In case the authentication is correct and user is a patient, let pass (continue):
    return true;
  }

}
