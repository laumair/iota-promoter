import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-async',
    template: `
    <div [ngSwitch]="waitFor">
    <app-spinner *ngSwitchDefault></app-spinner>
    <ng-content *ngSwitchCase="true"></ng-content>
    </div>
    `
})
export class AsyncComponent {
     @Input() waitFor: boolean;
 }
