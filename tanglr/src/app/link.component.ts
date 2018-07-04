import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'app-link',
    template: `
        <a (click)="onClick()">{{ children }}</a>
  `,
    styles: [`
    a {
        cursor: pointer;
        color: #2CA13C;
    }
    a:hover {
        color: #8EC952;
    }
 `],
})

export class LinkComponent {
    @Input() children: string;
    @Output() to: EventEmitter<any> = new EventEmitter();

    onClick(): void {
        this.to.emit(this.children);
    }
}
