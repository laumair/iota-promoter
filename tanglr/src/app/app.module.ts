import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';

import { AppRoutingModule } from './app-routing.module';
import { FetchService } from './fetch.service';

import { AppComponent } from './app.component';
import { LandingComponent } from './landing.component';
import { AsyncComponent } from './async.component';
import { CubeSpinnerComponent } from './spinners/cube-spinner.component';
import { CircleSpinnerComponent } from './spinners/circle-spinner.component';
import { LinkComponent } from './link.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingComponent,
    AsyncComponent,
    CubeSpinnerComponent,
    CircleSpinnerComponent,
    LinkComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    AppRoutingModule
  ],
  providers: [FetchService],
  bootstrap: [AppComponent]
})
export class AppModule { }
