import { Component, OnInit } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router } from '@angular/router';
import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { PatientBookingService } from '@modules/patient-portal/services/patient-booking.service';
import { I18nService } from '@shared/services/i18n.service';
import { regexObjectId } from '@env/environment';
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-select-procedure-patient',
  templateUrl: './select-procedure-patient.component.html',
  styleUrls: ['./select-procedure-patient.component.css']
})
export class SelectProcedurePatientComponent implements OnInit {
  //Set references objects:
  public availableOrganizations : any;
  public availableBranches      : any;
  public availableServices      : any;
  public availableCategories    : any;
  public fkProceduresIN         : string[] = [];
  public availableProcedures    : any;

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
    //Set Reactive Form (First time):
    this.setReactiveForm({
      domain            : ['', [Validators.required]],
      id_category       : new FormControl({ value: '', disabled: true }, Validators.required),
      fk_procedure      : new FormControl({ value: '', disabled: true }, Validators.required)
    });
  }

  ngOnInit(): void {
    //Find references:
    this.findReferences();
  }

  //--------------------------------------------------------------------------------------------------------------------//
  // SET BRANCH (Service selection handler):
  //--------------------------------------------------------------------------------------------------------------------//
  setBranch(organization: any, branch: any, service: any, modality: string): void {
    //Check names and _ids:
    if(
      organization._id !== undefined && regexObjectId.test(organization._id) && organization.short_name !== undefined && organization.short_name !== '' &&
      branch._id !== undefined && regexObjectId.test(branch._id) && branch.short_name !== undefined && branch.short_name !== '' &&
      service._id !== undefined && regexObjectId.test(service._id) && service.name !== undefined && service.name !== '' &&
      modality !== undefined && modality !== '' && regexObjectId.test(modality)
    ){
      //Set current imaging:
      this.sharedProp.current_imaging = {
        organization: organization,
        branch: branch,
        service: service
      };

      //Set current modality:
      this.sharedProp.current_modality = modality;
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON CHANGE SERVICE:
  //--------------------------------------------------------------------------------------------------------------------//
  onChangeService(): void{
    //Check modality and organization and branch _ids:
    if(
      this.sharedProp.current_imaging?.organization?._id !== undefined && regexObjectId.test(this.sharedProp.current_imaging.organization._id) &&
      this.sharedProp.current_imaging?.branch?._id !== undefined && regexObjectId.test(this.sharedProp.current_imaging.branch._id) &&
      this.sharedProp.current_modality !== '' && regexObjectId.test(this.sharedProp.current_modality)
    ){
      //Set params:
      const params = {
        'filter[and][domain.organization]': this.sharedProp.current_imaging.organization._id,
        'filter[and][domain.branch]': this.sharedProp.current_imaging.branch._id,
        'filter[and][procedures.fk_modality]': this.sharedProp.current_modality
      };

      //Set available categories:
      this.sharedFunctions.find('procedure_categories', params, (res) => {
        //Check data:
        if(res.data.length > 0){
          //Set available categories:
          this.availableCategories = res.data;

          //Enable category input:
          this.form.controls['id_category'].enable();

        } else {
          //Disable inputs:
          this.form.controls['id_category'].disable();
          this.form.controls['fk_procedure'].disable();

          //Clear inputs:
          this.form.controls['id_category'].setValue([]);
          this.form.controls['fk_procedure'].setValue([]);

          //Send message:
          this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.NO_CATEGORY_WARNING'));
        }
      });
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // SET PROCEDURES IN:
  //--------------------------------------------------------------------------------------------------------------------//
  setProceduresIN(fk_procedures: string[]): void {
    //Set fkProceduresIN:
    if(fk_procedures.length >= 1){
      this.fkProceduresIN = fk_procedures;
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON CHANGE CATEGORY:
  //--------------------------------------------------------------------------------------------------------------------//
  onChangeCategory(): void {
    //Check modality and organization and branch _ids:
    if(
      this.sharedProp.current_imaging?.organization?._id !== undefined && regexObjectId.test(this.sharedProp.current_imaging.organization._id) &&
      this.sharedProp.current_imaging?.branch?._id !== undefined && regexObjectId.test(this.sharedProp.current_imaging.branch._id) &&
      this.sharedProp.current_modality !== '' && regexObjectId.test(this.sharedProp.current_modality)
    ){
      //Set params:
      let params : any = {
        'filter[and][domain.organization]': this.sharedProp.current_imaging.organization._id,
        'filter[and][domain.branch]': this.sharedProp.current_imaging.branch._id,
        'filter[and][fk_modality]': this.sharedProp.current_modality,
        'filter[and][status]': true
      };

      //Set procedures filter key:
      if(this.fkProceduresIN.length == 1){
        params['filter[and][_id]'] = this.fkProceduresIN[0];
      } else {
        params['filter[in][_id]'] = this.fkProceduresIN;
      }

      //Set available procedures:
      this.sharedFunctions.find('procedures', params, (res) => {
        //Check data:
        if(res.data.length > 0){
          //Set available procedures:
          this.availableProcedures = res.data;

          //Enable procedure input:
          this.form.controls['fk_procedure'].enable();

        } else {
          //Disable procedure input:
          this.form.controls['fk_procedure'].disable();

          //Clear procedure input:
          this.form.controls['fk_procedure'].setValue([]);

          //Send message:
          this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.NO_PROCEDURE_WARNING'));
        }
      });
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON SUBMIT:
  //--------------------------------------------------------------------------------------------------------------------//
  async onSubmit(){
    //Validate fields:
    if(this.form.valid){
      //Check fk_procedure:
      if(this.form.value.fk_procedure !== undefined && regexObjectId.test(this.form.value.fk_procedure)){

        //Find all properties of procedure in available procedures:
        await Promise.all(Object.keys(this.availableProcedures).map((key) => {
          if(this.availableProcedures[key]._id == this.form.value.fk_procedure){
            //Set current procedure in shared properties:
            this.sharedProp.current_procedure = {
              '_id'                 : this.availableProcedures[key]._id,
              'name'                : this.availableProcedures[key].name,
              'equipments'          : this.availableProcedures[key].equipments,
              'informed_consent'    : this.availableProcedures[key].informed_consent,
              'preparation'         : this.availableProcedures[key].preparation,
              'procedure_template'  : this.availableProcedures[key].procedure_template,
              'reporting_delay'     : this.availableProcedures[key].reporting_delay
            }
          }
        }));

        //Redirect to select slot step:
        this.router.navigate(['/patient-portal/booking/slot']);
      } else {
        //Send message:
        this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.INVALID_PROCEDURE_WARNING'));
      }
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // FIND REFERENCES:
  //--------------------------------------------------------------------------------------------------------------------//
  findReferences(){
    //Initialize params:
    const params = { 'filter[status]': true };

    //Find organizations:
    this.sharedFunctions.find('organizations', params, (res) => {
      this.availableOrganizations = res.data;
    });

    //Find branches:
    this.sharedFunctions.find('branches', params, (res) => {
      this.availableBranches = res.data;
    });

    //Find services:
    this.sharedFunctions.find('services', params, (res) => {
      this.availableServices = res.data;
    });
  }
  //--------------------------------------------------------------------------------------------------------------------//
}
