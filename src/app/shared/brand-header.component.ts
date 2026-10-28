import { Component } from '@angular/core';

@Component({
  selector: 'app-brand-header',
  standalone: true,
  templateUrl: './brand-header.component.html',
  styleUrls: ['./brand-header.component.scss'],
})
export class BrandHeaderComponent {
  readonly logoSrc = 'assets/NEYA_logo_transparent.png';
  readonly appName = 'NEYA';
}
