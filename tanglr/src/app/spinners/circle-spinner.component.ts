import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-spinner-circle',
  template: `
    <div class="loader" [ngStyle]="{'color': color, 'font-size': fontSize}"></div>
   `,
    styleUrls: ['./circle-spinner.component.css']
})

export class CircleSpinnerComponent {
  @Input() color: string;
  @Input() fontSize: string;
}
