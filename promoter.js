const IOTA = require('iota.lib.js');
const { isAboveMaxDepth, updateAtPath, union, getProvider } = require('./helpers');
const config = require('./config');

class Promoter {
    constructor(provider, bundles, failed, confirmed, shouldPromoteAll) {
        if (!provider) {
            throw new Error('Missing provider for iota node.');
        }

        if (!Array.isArray(bundles)) {
            throw new Error('Incorrect bundles provided.');
        }

        if (!bundles.length) {
            throw new Error('No bundles to process.');
        }

        if (!shouldPromoteAll && !failed.length) {
            throw new Error('No failed bundles to process.');
        }

        this.bundles = bundles;
        this.iota = new IOTA({ provider });

        this.failed = failed || [];
        this.confirmed = confirmed || [];
        this.shouldPromoteAllUnconfirmed = shouldPromoteAll;
    }

    initialize() {
        const head = this.shouldPromoteAllUnconfirmed ? this.bundles[0] : this.failed[0];

        return this._prepare(head, 0); // index --> Logging purposes
    }

    updateFailedBundles(bundle) {
        // Update local copy for failed bundle hashes
        this.failed = union(this.failed, [bundle]);

        // Update file.
        updateAtPath(config.FAILED_REATTACHS_PATH, this.failed);
    }

    updateConfirmedBundles(bundle) {
        // Update local copy for confirmed bundle hashes
        this.confirmed = union(this.confirmed, [bundle]);

        // Write to file.
        updateAtPath(config.CONFIRMED_PATH, this.confirmed);
    }

    filterAndUpdateUnconfirmedBundles(bundle) {
        // Remove from unconfirmed
        this.bundles = this.bundles.filter(item => item !== bundle);

        // Write to file.
        updateAtPath(config.UNCONFIMED_BUNDLES_PATH, this.bundles);
    }

    _shouldNotProcessNext(index) {
        if (this.shouldPromoteAllUnconfirmed) {
            return !this.bundles.length || index === this.bundles.length - 1;
        }

        return !this.failed.length || index === this.failed.length - 1;
    }

    _getFirstConsistentTail(tails, idx) {
        if (!tails[idx]) {
            return Promise.resolve(false);
        }

        return this.iota.api
            .isPromotable(tails[idx].hash)
            .then(state => {
                if (state && isAboveMaxDepth(tails[idx].attachmentTimestamp)) {
                    return tails[idx];
                }

                idx += 1;
                return this._getFirstConsistentTail(tails, idx);
            })
            .catch(() => false);
    }

    _processNext(index) {
        let shouldNotProcessNext = this._shouldNotProcessNext(index);

        if (shouldNotProcessNext) {
            console.info('Processed last bundle. Will update local');
            updateAtPath(config.FAILED_REATTACHS_PATH, this.failed);
            updateAtPath(config.UNCONFIMED_BUNDLES_PATH, this.bundles);
            updateAtPath(config.CONFIRMED_PATH, this.confirmed);
        } else {
            const nextHead = this.shouldPromoteAllUnconfirmed ? this.bundles[index + 1] : this.failed[index + 1];

            // Well don't want to bombard a single node
            const newProvider = getProvider(config.NODES);
            this.iota.changeNode({ provider: newProvider });
            console.info(`About to start processing bundle with index ${index + 1}`);
            this._prepare(nextHead, index + 1);
        }
    }

    _promote(bundle, index, tail, callback) {
        const spamTransfer = [{ address: 'U'.repeat(81), value: 0, message: '', tag: '' }];

        console.info(`Starting promotion for bundle ${bundle} at index ${index}`);
        this.iota.api.promoteTransaction(tail.hash, 4, 14, spamTransfer, { interrupt: false, delay: 0 }, err => {
            if (err) {
                if (err.message.indexOf('Inconsistent subtangle') > -1) {
                    console.error(`Failed to promote ${bundle} at index ${index}. Will reattach`);

                    this.iota.api.replayBundle(tail.hash, 3, 14, err => {
                        if (err) {
                            console.error(`Reattachment error for bundle ${bundle} at index ${index}`);
                            this.updateFailedBundles(bundle);

                            callback(index);
                        } else {
                            callback(index);
                        }
                    });
                } else {
                    console.error(`Unknown error while promoting ${bundle} at index ${index}. Will not reattach`);

                    this.updateFailedBundles(bundle);
                    callback(index);
                }
            } else {
                callback(index);
            }
        });
    }

    _prepare(bundle, index) {
        console.info(`Fetching transaction objects for bundle ${bundle} at index ${index}`);

        return this.iota.api.findTransactionObjects({ bundles: [bundle] }, (err, txs) => {
           if (err) {
               console.error(`Error fetching transaction objects for bundle ${bundle} at index ${index}`);

               this.updateFailedBundles(bundle);
               this._processNext(index);
           } else {
               const tails = txs.filter(tx => tx.currentIndex === 0);

               this.iota.api.getLatestInclusion(tails.map(t => t.hash), (err, states) => {
                  if (err) {
                      console.error(`Error fetching inclusion states for bundle ${bundle} at index ${index}`);

                      this.updateFailedBundles(bundle);
                      this._processNext(index);
                  } else {
                      if (tails.some((t, idx) => states[idx])) {
                          console.info(`Found transaction already confirmed for bundle ${bundle} at index ${index}`);

                          this.updateConfirmedBundles(bundle);
                          this.filterAndUpdateUnconfirmedBundles(bundle);

                          this._processNext(index);
                      } else {
                          this._getFirstConsistentTail(tails, 0).then(consistentTail => {
                              if (!consistentTail) {
                                  console.warn(`Could not find any consistent tail for bundle ${bundle} at index ${index}`);
                                  const tailAtHead = tails.length ? tails[0] : null;

                                  if (tailAtHead) {
                                      console.info(`Will replay for bundle ${bundle} at index ${index}`);

                                      this.iota.api.replayBundle(tailAtHead.hash, 3, 14, err => {
                                          if (err) {
                                              console.error(`Reattachment error for bundle ${bundle} at index ${index}`);
                                              console.error(`Error message for reattachment failure, ${err.message}`);

                                              this.updateFailedBundles(bundle);
                                              this._processNext(index);
                                          } else {
                                              console.info(`Successfully make a reattachment for bundle ${bundle} at ${index}`);
                                              this._processNext(index);
                                          }
                                      });
                                  } else {
                                      console.error(`No tail found for bundle ${bundle} at index ${index}`);

                                      this.updateFailedBundles(bundle);
                                      this._processNext(index);
                                  }
                              } else {
                                  this._promote(bundle, index, consistentTail, this._processNext);
                              }
                          });
                      }
                  }
               });
           }
        });
    }
}

exports.Promoter = Promoter;
