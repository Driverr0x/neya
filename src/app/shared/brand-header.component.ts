import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, volumeHighOutline, volumeMuteOutline, wifiOutline } from 'ionicons/icons';
import { AudioGuideService } from '../pages/core/audio-guide.service';
import { StoreService } from '../pages/core/store.service';

@Component({
  selector: 'app-brand-header',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './brand-header.component.html',
  styleUrls: ['./brand-header.component.scss'],
})
export class BrandHeaderComponent {
  readonly audio = inject(AudioGuideService);
  readonly store = inject(StoreService);
  readonly logoSrc = 'assets/NEYA_logo_transparent.png';
  readonly appName = 'NEYA';

  constructor() {
    addIcons({ cloudOfflineOutline, volumeHighOutline, volumeMuteOutline, wifiOutline });
  }
}
