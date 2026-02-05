import { Component, OnInit, ViewChild } from '@angular/core';

//--------------------------------------------------------------------------------------------------------------------//
// IMPORTS:
//--------------------------------------------------------------------------------------------------------------------//
import { Router, ActivatedRoute } from '@angular/router';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { PatientBookingService } from '@modules/patient-portal/services/patient-booking.service';
import { I18nService } from '@shared/services/i18n.service';
import { FullCalendarComponent, CalendarOptions } from '@fullcalendar/angular';
import allLocales from '@fullcalendar/core/locales-all';
import { map, mergeMap } from 'rxjs/operators';
import { regexObjectId } from '@env/environment';
//--------------------------------------------------------------------------------------------------------------------//

@Component({
  selector: 'app-select-slot-patient',
  templateUrl: './select-slot-patient.component.html',
  styleUrls: ['./select-slot-patient.component.css']
})
export class SelectSlotPatientComponent implements OnInit {
  //Min and max dates:
  public minDate: Date = new Date();
  public maxDate: Date = new Date();

  //Set references objects:
  public currentModality      : any;

  //Set params objects:
  private slotsParams               : any;
  private appointmentsParams        : any;
  private appointmentsDraftsParams  : any;

  //Set selected elements:
  public selectedEquipment    : any  | undefined;
  public selectedStart        : Date | undefined;
  public selectedEnd          : Date | undefined;
  public selectedSlot         : any  | undefined;

  //Reschedule mode:
  public isRescheduleMode     : boolean = false;
  public rescheduleAppointmentId: string | null = null;
  public rescheduleAppointment: any = null;
  public loadingReschedule    : boolean = false;

  //References the #calendar (FullCalendar):
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  //Set FullCalendar Default options:
  public calendarOptions: CalendarOptions = this.sharedProp.mainSettings.FullCalendarOptions;

  //Initializate Calendar Resources:
  public calendarResources: any = [];

  //Inject services, components and router to the constructor:
  constructor(
    private router              : Router,
    private route               : ActivatedRoute,
    public sharedProp           : SharedPropertiesService,
    public sharedFunctions      : SharedFunctionsService,
    public patientBookingService: PatientBookingService,
    private i18n                : I18nService
  ) {
    //Get Logged User Information:
    this.sharedProp.userLogged = this.sharedFunctions.getUserInfo();
  }

  //--------------------------------------------------------------------------------------------------------------------//
  // LOAD RESCHEDULE APPOINTMENT:
  //--------------------------------------------------------------------------------------------------------------------//
  loadRescheduleAppointment(): void {
    this.loadingReschedule = true;

    // Try to get appointment data from sessionStorage first
    const storedAppointment = sessionStorage.getItem('rescheduleAppointment');
    if (storedAppointment) {
      this.rescheduleAppointment = JSON.parse(storedAppointment);
      this.setupRescheduleData();
    } else if (this.rescheduleAppointmentId) {
      // Fetch from API if not in sessionStorage
      const params = {
        'filter[_id]': this.rescheduleAppointmentId,
        'proj[procedure]': 1,
        'proj[imaging]': 1,
        'proj[start]': 1,
        'proj[end]': 1
      };
      this.sharedFunctions.find('appointments', params, (res: any) => {
        if (res.success && res.data && res.data.length > 0) {
          this.rescheduleAppointment = res.data[0];
          this.setupRescheduleData();
        } else {
          this.loadingReschedule = false;
        }
      });
    } else {
      this.loadingReschedule = false;
    }
  }

  setupRescheduleData(): void {
    if (this.rescheduleAppointment) {
      // Set current imaging from the appointment
      this.sharedProp.current_imaging = this.rescheduleAppointment.imaging;
      // Set current procedure from the appointment
      this.sharedProp.current_procedure = this.rescheduleAppointment.procedure;
      // Set modality from procedure if available (needed for template condition)
      if (this.rescheduleAppointment.procedure?.fk_modality) {
        this.sharedProp.current_modality = this.rescheduleAppointment.procedure.fk_modality;
      } else {
        // Set a placeholder to satisfy template condition
        this.sharedProp.current_modality = { _id: 'reschedule' };
      }

      this.loadingReschedule = false;
      // Now initialize the calendar
      this.initializeCalendar();
    }
  }

  initializeCalendar(): void {
    //Set min and max dates (Datepicker):
    const dateRangeLimit = this.sharedFunctions.setDateRangeLimit(new Date());
    this.minDate = dateRangeLimit.minDate;
    this.maxDate = dateRangeLimit.maxDate;

    //Set FullCalendar Language:
    this.calendarOptions['locales'] = allLocales;
    this.calendarOptions['locale'] = this.calendarOptions.locale;

    //Set FullCalendar min and max date:
    this.calendarOptions['validRange'] = {
      start: this.minDate,
      end: this.maxDate
    };

    //Set FullCalendar Custom Buttons:
    this.calendarOptions['customButtons'] = {
      datepicker: {
        text: this.i18n.instant('PATIENT_PORTAL.BOOKING.DATEPICKER_BUTTON'),
        click: () => {
          this.openDatePicker();
        }
      },
      view_day: {
        text: this.i18n.instant('PATIENT_PORTAL.BOOKING.VIEW_DAY_BUTTON'),
        click: () => {
          this.calendarComponent.getApi().changeView('resourceTimeGridDay');
        }
      },
      view_week: {
        text: this.i18n.instant('PATIENT_PORTAL.BOOKING.VIEW_WEEK_BUTTON'),
        click: () => {
          this.calendarComponent.getApi().changeView('resourceTimeGridWeek');
        }
      },
    };

    //Remove urgency buttons from header:
    let headerToolbar: any = this.calendarOptions.headerToolbar?.valueOf();
    if(headerToolbar){
      headerToolbar['end'] = '';
      this.calendarOptions.headerToolbar = headerToolbar;
    }

    //Bind dateClick event:
    this.calendarOptions.dateClick = this.onClickSlot.bind(this);

    //Find references:
    this.findReferences();

    //Fix FullCalendar bug first Render:
    this.sharedFunctions.fixFullCalendarRender();

    //Find slots:
    this.findSlots(false, true);
  }
  //--------------------------------------------------------------------------------------------------------------------//

  ngOnInit(): void {
    // Check for reschedule mode from snapshot first (synchronous, more reliable)
    const rescheduleId = this.route.snapshot.queryParams['reschedule'];
    if (rescheduleId) {
      this.isRescheduleMode = true;
      this.rescheduleAppointmentId = rescheduleId;
      this.loadRescheduleAppointment();
      return; // Calendar will be initialized after appointment data is loaded
    }

    //Check if procedure was selected (only for new bookings):
    if(!this.sharedProp.current_imaging || !this.sharedProp.current_procedure){
      //Redirect back to procedure selection:
      this.router.navigate(['/patient-portal/booking/procedure']);
      return;
    }

    // Initialize calendar for normal booking flow
    this.initializeCalendar();
  }

  //--------------------------------------------------------------------------------------------------------------------//
  // OPEN DATE PICKER:
  //--------------------------------------------------------------------------------------------------------------------//
  openDatePicker(){
    const $datepicker = document.getElementById('invisible-datepicker');
    $datepicker?.click();
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON CHANGE DATE:
  //--------------------------------------------------------------------------------------------------------------------//
  onChangeDate(event: any){
    this.calendarComponent.getApi().gotoDate(new Date(event.value));
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // FIND SLOTS:
  //--------------------------------------------------------------------------------------------------------------------//
  findSlots(urgency: boolean = false, first_search: boolean = false){
    //Check current imaging and current procedure:
    if(this.sharedProp.current_imaging !== undefined && this.sharedProp.current_procedure !== undefined){
      //Clear FullCalendar:
      if(first_search == false){
        this.calendarComponent.getApi().removeAllEvents();
        this.calendarOptions['resources'] = [];
        this.clearSelectedElements();
      }

      //Slot Background color (always green for patients - no urgent slots):
      let slotBackgroundColor = '#05ff9f49';

      //Set max date filter format:
      let minDateString = this.minDate.getFullYear() + '-' + this.minDate.toLocaleString("es-AR", { month: "2-digit" }) + '-' + this.minDate.toLocaleString("es-AR", { day: "2-digit" }) + 'T00:00:00.000Z';
      const maxDateString = this.maxDate.getFullYear() + '-12-31T00:00:00.000Z';

      //Set slots params (Background events) - Always non-urgent for patients:
      this.slotsParams = {
        'filter[and][domain.organization]': this.sharedProp.current_imaging.organization._id,
        'filter[and][domain.branch]': this.sharedProp.current_imaging.branch._id,
        'filter[and][domain.service]': this.sharedProp.current_imaging.service._id,
        'filter[and][start][$gte]': minDateString,
        'filter[and][end][$lte]': maxDateString,
        'filter[and][urgency]': false,  // Patients can only book non-urgent slots
        'proj[start]': 1,
        'proj[end]': 1,
        'proj[urgency]': 1,
        'proj[equipment._id]': 1,
        'proj[equipment.name]': 1
      };

      //Set appointments params (Events):
      this.appointmentsParams = {
        'filter[and][imaging.organization._id]': this.sharedProp.current_imaging.organization._id,
        'filter[and][imaging.branch._id]': this.sharedProp.current_imaging.branch._id,
        'filter[and][imaging.service._id]': this.sharedProp.current_imaging.service._id,
        'filter[and][flow_state]': 'A01',
        'filter[and][status]': true,
        'filter[and][start][$gte]': minDateString,
        'filter[and][end][$lte]': maxDateString,
        'proj[start]': 1,
        'proj[end]': 1,
        'proj[urgency]': 1,
        'proj[procedure.name]': 1,
        'proj[slot.equipment._id]': 1
      };

      //Set appointments drafts params:
      this.appointmentsDraftsParams = {
        'filter[and][imaging.organization._id]': this.sharedProp.current_imaging.organization._id,
        'filter[and][imaging.branch._id]': this.sharedProp.current_imaging.branch._id,
        'filter[and][imaging.service._id]': this.sharedProp.current_imaging.service._id,
        'filter[and][start][$gte]': minDateString,
        'filter[and][end][$lte]': maxDateString,
        'proj[start]': 1,
        'proj[end]': 1,
        'proj[urgency]': 1,
        'proj[procedure.name]': 1,
        'proj[slot.equipment._id]': 1
      };

      //Create slots observable:
      const obsSlots = this.sharedFunctions.findRxJS('slots', this.slotsParams).pipe(
        //Get equipments (resources) and slots (background events):
        map(async (res: any) => {
          if(res.data){
            if(res.data.length > 0){
              let registeredEquipments: string[] = [];

              await Promise.all(Object.keys(res.data).map(async (key) => {
                if(!registeredEquipments.includes(res.data[key].equipment._id)){
                  await Promise.all(Object.keys(this.sharedProp.current_procedure.equipments).map((keyProcedure) => {
                    if(res.data[key].equipment._id === this.sharedProp.current_procedure.equipments[keyProcedure].fk_equipment){
                      let currentResource = {
                        id: res.data[key].equipment._id,
                        title: res.data[key].equipment.name + ' | ' + this.sharedProp.current_procedure.equipments[keyProcedure].duration + ' min.'
                      };
                      this.calendarComponent.getApi().addResource(currentResource);
                      const resourceDuplicated = this.calendarResources.find(({ id } : any) => id === res.data[key].equipment._id);
                      if(first_search == true && resourceDuplicated == undefined){
                        this.calendarResources.push(currentResource);
                      }
                    }
                  }));
                }
                registeredEquipments.push(res.data[key].equipment._id);
                // Note: Removed slot._id filter to avoid URL too long (414) error
                // Appointments/drafts are already filtered by org/branch/service/date range
                this.calendarComponent.getApi().addEvent({
                  classNames: res.data[key]._id,
                  resourceId: res.data[key].equipment._id,
                  start: res.data[key].start.slice(0, -5),
                  end: res.data[key].end.slice(0, -5),
                  display: 'background',
                  backgroundColor: slotBackgroundColor
                });
              }));
            }
          }
          return res;
        }),

        // Continue to fetch appointments after processing slots
        mergeMap(() => this.sharedFunctions.findRxJS('appointments', this.appointmentsParams)),

        map(async (res: any) => {
          if(res.data){
            if(res.data.length > 0){
              await Promise.all(Object.keys(res.data).map((key) => {
                // Skip the appointment being rescheduled so its slot appears available
                if (this.isRescheduleMode && res.data[key]._id === this.rescheduleAppointmentId) {
                  return;
                }

                let backgroundColor = this.sharedProp.mainSettings.FullCalendarOptions.eventColor;
                let borderColor = this.sharedProp.mainSettings.FullCalendarOptions.eventBorderColor;
                let textColor = this.sharedProp.mainSettings.FullCalendarOptions.eventTextColor;

                if(res.data[key].urgency){
                  backgroundColor = '#f44336';
                  borderColor = '#f7594d';
                  textColor = '#fff';
                }

                this.calendarComponent.getApi().addEvent({
                  id: res.data[key]._id,
                  resourceId: res.data[key].slot.equipment._id,
                  title: this.i18n.instant('PATIENT_PORTAL.BOOKING.BOOKED_SLOT'),
                  start: res.data[key].start.slice(0, -5),
                  end: res.data[key].end.slice(0, -5),
                  backgroundColor: backgroundColor,
                  borderColor: borderColor,
                  textColor: textColor
                });
              }));
            }
          }
          return res;
        }),

        mergeMap(() => this.sharedFunctions.findRxJS('appointments_drafts', this.appointmentsDraftsParams)),

        map(async (res: any) => {
          if(res.data){
            if(res.data.length > 0){
              await Promise.all(Object.keys(res.data).map((key) => {
                this.calendarComponent.getApi().addEvent({
                  id: res.data[key]._id,
                  resourceId: res.data[key].slot.equipment._id,
                  title: this.i18n.instant('PATIENT_PORTAL.BOOKING.RESERVED_SLOT'),
                  start: res.data[key].start.slice(0, -5),
                  end: res.data[key].end.slice(0, -5),
                  backgroundColor: '#424242',
                  borderColor: '#4f4f4f',
                  textColor: '#fff'
                });
              }));
            }
          }
          return res;
        }),
      );

      obsSlots.subscribe();
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON DELETE:
  //--------------------------------------------------------------------------------------------------------------------//
  async onDelete(){
    let calendarEvents = this.calendarComponent.getApi().getEvents();
    await Promise.all(Object.keys(calendarEvents).map((keyEvents) => {
      if(calendarEvents[parseInt(keyEvents)]._def.publicId == 'tentative'){
        let tentative_event = this.calendarComponent.getApi().getEventById(calendarEvents[parseInt(keyEvents)]._def.publicId);
        tentative_event?.remove();
        this.clearSelectedElements();
      }
    }));
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON CLICK SLOT:
  //--------------------------------------------------------------------------------------------------------------------//
  async onClickSlot(arg: any){
    if(arg.jsEvent.target.classList.contains('fc-bg-event')) {
      let calendarEvents = this.calendarComponent.getApi().getEvents();
      let tentativeExist = false;
      await Promise.all(Object.keys(calendarEvents).map((keyEvents) => {
        if(calendarEvents[parseInt(keyEvents)]._def.publicId == 'tentative'){
          tentativeExist = true;
        }
      }));

      if(tentativeExist === false){
        let bgEventClassList = arg.jsEvent.target.classList;
        const slotResult = Object.values(bgEventClassList).filter((currentClass: any) => regexObjectId.test(currentClass))[0];

        if(slotResult !== undefined && slotResult !== '' && slotResult !== null){
          this.selectedSlot = slotResult;
        }

        let stringDate = arg.dateStr.slice(0, -6);
        this.selectedStart = new Date(stringDate + '.000Z');

        await Promise.all(Object.keys(this.sharedProp.current_procedure.equipments).map((key) => {
          if(this.sharedProp.current_procedure.equipments[key].fk_equipment == arg.resource._resource.id){
            this.selectedEquipment = this.sharedProp.current_procedure.equipments[key];
            this.selectedEnd = new Date(stringDate + '.000Z');
            this.selectedEnd.setMinutes(this.selectedEnd.getMinutes() + parseInt(this.sharedProp.current_procedure.equipments[key].duration, 10));
          }
        }));

        const formattedDateTime = this.sharedFunctions.datetimeFulCalendarFormater(this.selectedStart, this.selectedEnd);
        const isOverlapping = await this.isOverlapping(formattedDateTime, this.selectedEquipment.fk_equipment);

        if(isOverlapping) {
          let timeRequired = this.selectedEquipment.duration;
          this.clearSelectedElements();
          this.sharedFunctions.openDialog('overlap_events', timeRequired);
        } else {
          this.calendarComponent.getApi().addEvent({
            id: 'tentative',
            resourceId: arg.resource._resource.id,
            title: this.sharedProp.current_procedure.name,
            start: formattedDateTime.start,
            end: formattedDateTime.end,
            backgroundColor: '#b0bec5',
            borderColor: '#909da4',
            textColor: '#17191a'
          });
        }
      } else {
        this.sharedFunctions.openDialog('tentative_exist', 'stuff_data');
      }
    } else {
      this.sharedFunctions.openDialog('slot_select', 'stuff_data');
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON SUBMIT:
  //--------------------------------------------------------------------------------------------------------------------//
  onSubmit(){
    //Set current selections in shared properties:
    this.sharedProp.current_equipment = this.selectedEquipment;
    this.sharedProp.current_slot = this.selectedSlot;
    this.sharedProp.current_datetime = this.sharedFunctions.datetimeFulCalendarFormater(this.selectedStart, this.selectedEnd);
    this.sharedProp.current_modality = this.currentModality;
    this.sharedProp.current_urgency = false;  // Always false for patients

    // Handle reschedule mode - go to confirm page (don't create draft, just store reschedule info)
    if (this.isRescheduleMode && this.rescheduleAppointmentId) {
      // Store reschedule appointment ID for confirm page
      sessionStorage.setItem('rescheduleAppointmentId', this.rescheduleAppointmentId);
      // Navigate to confirm step
      this.router.navigate(['/patient-portal/booking/confirm']);
      return;
    }

    //Create appointment draft save data (normal booking flow):
    let appointmentsDraftsSaveData: any = {
      imaging : {
        organization  : this.sharedProp.current_imaging.organization._id,
        branch        : this.sharedProp.current_imaging.branch._id,
        service       : this.sharedProp.current_imaging.service._id,
      },
      start           : this.sharedProp.current_datetime.start + '.000Z',
      end             : this.sharedProp.current_datetime.end + '.000Z',
      fk_patient      : this.sharedProp.userLogged.user_id,
      fk_coordinator  : this.sharedProp.userLogged.user_id,  // Patient is their own coordinator
      fk_slot         : this.sharedProp.current_slot,
      fk_procedure    : this.sharedProp.current_procedure._id,
      urgency         : false,
    };

    //Save appointment draft in DB:
    this.sharedFunctions.save('insert', 'appointments_drafts', '', appointmentsDraftsSaveData, [], (res) => {
      if(res.success === true){
        this.sharedProp.current_appointment_draft = res.data._id;
        //Navigate to confirm step:
        this.router.navigate(['/patient-portal/booking/confirm']);
      } else {
        this.sharedFunctions.sendMessage(this.i18n.instant('PATIENT_PORTAL.BOOKING.DRAFT_SAVE_ERROR'));
      }
    });
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // ON BACK:
  //--------------------------------------------------------------------------------------------------------------------//
  onBack(){
    this.router.navigate(['/patient-portal/booking/procedure']);
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // FIND REFERENCES:
  //--------------------------------------------------------------------------------------------------------------------//
  findReferences(){
    let _id = undefined;
    if(this.sharedProp.current_modality !== undefined){
      if(regexObjectId.test(this.sharedProp.current_modality)){
        _id = this.sharedProp.current_modality;
      } else if(regexObjectId.test(this.sharedProp.current_modality._id)){
        _id = this.sharedProp.current_modality._id;
      }
    }

    if(_id !== undefined && this.sharedProp.current_modality !== undefined){
      const params = {
        'filter[_id]': _id,
        'filter[status]': true
      };
      this.sharedFunctions.find('modalities', params, (res) => {
        this.currentModality = res.data[0];
      });
    } else {
      this.clearSelectedElements();
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // IS OVERLAPPING:
  //--------------------------------------------------------------------------------------------------------------------//
  async isOverlapping(inputDateTime: any, inputResource: string){
    let isOverlap = false;
    let calendarEvents = this.calendarComponent.getApi().getEvents();

    await Promise.all(Object.keys(calendarEvents).map((key) => {
      if(calendarEvents[parseInt(key, 10)]._def.ui.display != 'background'){
        const currentResource: any = calendarEvents[parseInt(key, 10)]._def.resourceIds;
        const currentStart = calendarEvents[parseInt(key, 10)]._instance?.range.start;
        const currentEnd = calendarEvents[parseInt(key, 10)]._instance?.range.end;
        const currentDateTime = this.sharedFunctions.datetimeFulCalendarFormater(currentStart, currentEnd);

        if(currentResource[0] == inputResource){
          if(!(new Date(currentDateTime.start) >= new Date(inputDateTime.end) || new Date(currentDateTime.end) <= new Date(inputDateTime.start))){
            isOverlap = true;
          }
        }
      }
    }));

    return isOverlap;
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // CLEAR SELECTED ELEMENTS:
  //--------------------------------------------------------------------------------------------------------------------//
  clearSelectedElements(){
    this.selectedEquipment  = undefined;
    this.selectedStart      = undefined;
    this.selectedEnd        = undefined;
    this.selectedSlot       = undefined;
  }
  //--------------------------------------------------------------------------------------------------------------------//


  //--------------------------------------------------------------------------------------------------------------------//
  // SET RESOURCES:
  //--------------------------------------------------------------------------------------------------------------------//
  async setResources(resource_id: string){
    if(resource_id == 'ALL'){
      this.calendarOptions.resources = this.calendarResources;
    } else {
      this.calendarOptions.resources = [];
      await Promise.all(Object.keys(this.calendarResources).map((key) => {
        if(this.calendarResources[key].id == resource_id){
          this.calendarOptions.resources = [this.calendarResources[key]];
        }
      }));
    }
  }
  //--------------------------------------------------------------------------------------------------------------------//
}
