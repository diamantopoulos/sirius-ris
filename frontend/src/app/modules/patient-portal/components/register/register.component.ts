import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SharedPropertiesService } from '@shared/services/shared-properties.service';
import { SharedFunctionsService } from '@shared/services/shared-functions.service';
import { I18nService } from '@shared/services/i18n.service';
import { ISO_3166, objectKeys } from '@env/environment';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  error = '';
  success = false;

  // Use same data as signin form
  public country_codes: any = ISO_3166;
  public documentTypesKeys: string[] = objectKeys.documentTypesKeys;
  public getKeys: any;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    public sharedProp: SharedPropertiesService,
    private sharedFunctions: SharedFunctionsService,
    public i18n: I18nService
  ) {
    this.getKeys = this.sharedFunctions.getKeys;
    // Get defaults from app settings if available
    const defaultCountry = this.sharedProp.mainSettings?.appSettings?.default_country || '858';
    const defaultDocType = this.sharedProp.mainSettings?.appSettings?.default_doc_type || '1';

    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      surname: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      doc_country_code: [defaultCountry, Validators.required],
      doc_type: [defaultDocType, Validators.required],
      document: ['', [Validators.required, Validators.minLength(5)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      birth_date: ['', Validators.required],
      gender: ['1', Validators.required]  // Use numeric like sirius-ris (1=M, 2=F)
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    const formValue = this.registerForm.value;
    if (formValue.password !== formValue.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;
    this.error = '';

    // Create patient registration payload
    // This will be handled by chat-service or a dedicated registration endpoint
    const payload = {
      person: {
        name: formValue.name,
        surname: formValue.surname,
        email: formValue.email,
        phone: formValue.phone,
        doc_country_code: formValue.doc_country_code,
        doc_type: formValue.doc_type,
        document: formValue.document,
        birth_date: formValue.birth_date,
        gender: formValue.gender
      },
      user: {
        password: formValue.password,
        role: 9  // Patient role
      }
    };

    // POST to chat-service registration endpoint
    this.http.post('http://localhost:3003/api/register', payload).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        // Redirect to signin after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/signin']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }
}
