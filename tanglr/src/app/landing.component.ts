import { Component, OnInit } from '@angular/core';
import { FetchService } from './fetch.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {
  public bundles = [];
  public hasFetchedBundles = false;
  public requestedBundleHash = '';
  public isSubmittingForPromotion = false;
  public submissionFeedback = '';
  public bundlesFetchResponseFeedback = '';

  constructor(
    private fetchService: FetchService,
  ) { }

  ngOnInit() {
    this.fetch();
  }

  private fetch() {
    if (this.bundlesFetchResponseFeedback) {
      this.bundlesFetchResponseFeedback = '';
    }

    this.fetchService.fetchBundles().subscribe(
      (data) => {
        this.hasFetchedBundles = true;
        this.bundles = data;

        if (!this.bundles.length) {
          this.bundlesFetchResponseFeedback = 'Looks like no transactions are queued for promotion.' +
            ' Submit your bundle hash to add your transaction for promotion.';
        }
        },
      () => {
        this.hasFetchedBundles = true;
        this.bundlesFetchResponseFeedback = 'Something went wrong while fetching enqueued transactions for promotion. Try refreshing.';
      }
    );
  }

  add(formValues: any) {
    const requestedBundleHash = formValues.requestedBundleHash.trim();

    if (
      requestedBundleHash.length === 81 &&
      requestedBundleHash.match(/^[A-Z9]+$/) &&
      requestedBundleHash !== '9'.repeat(81)
    ) {
      this.isSubmittingForPromotion = true;
      this.submissionFeedback = '';

      this.fetchService.addBundle(formValues.requestedBundleHash).subscribe(
        (newBundleMeta) => {
          this.bundles.push(newBundleMeta);
          this.isSubmittingForPromotion = false;
          this.requestedBundleHash = '';
          this.submissionFeedback = 'Successfully added your bundle hash for promotion.';
        },
        (err) => {
          this.isSubmittingForPromotion = false;
          this.submissionFeedback = err;
        });
    } else {
      this.submissionFeedback = 'Invalid bundle hash provided.';
    }
  }

  navigate(to: string): void {
    window.open(`https://www.thetangle.org/bundle/${to}`, '_blank');
  }
}
