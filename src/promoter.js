const _ = require('lodash');
const curl = require('curl.lib.js');
const promisify = require('pify');
const axios = require('axios');
const Errors = require('./utils/errors');
const logger = require('./utils/logger');
const { isAboveMaxDepth } = require('./utils/helpers');
const { iota } = require('./utils/iota');
const config = require('../config');

const DEPTH = 4;
const MIN_WEIGHT_MAGNITUDE = 14;

curl.overrideAttachToTangle(iota);

const api = {
  promoteTransaction: promisify(iota.api.promoteTransaction).bind(iota.api),
  getLatestInclusion: promisify(iota.api.getLatestInclusion).bind(iota.api),
  findTransactionObjects: promisify(iota.api.findTransactionObjects).bind(iota.api),
  replayBundle: promisify(iota.api.replayBundle).bind(iota.api),
};

axios.defaults.baseURL = config.API_URL;

const requestForUnconfirmedBundles = () => axios.get('/bundles');
const requestForBundleRemoval = bundle => axios.delete(`/bundles/${bundle}`);
const increasePromotionCount = bundle => axios.patch(`/bundles/${bundle}`);

const getConsistentTailTransaction = (tailTransactions, index) => {
  let tailsAboveMaxDepth = [];

  if (index === 0) {
    tailsAboveMaxDepth = tailTransactions
      .filter(tx => isAboveMaxDepth(tx.attachmentTimestamp))
      .sort((a, b) => b.attachmentTimestamp - a.attachmentTimestamp);
  }

  if (!tailsAboveMaxDepth[index]) {
    return Promise.resolve(false);
  }

  const thisTailTransaction = tailsAboveMaxDepth[index];

  return iota.api
    .isPromotable(thisTailTransaction.hash)
    .then((isConsistent) => {
      if (isConsistent && isAboveMaxDepth(thisTailTransaction.attachmentTimestamp)) {
        return thisTailTransaction;
      }

      index += 1; // eslint-disable-line no-param-reassign
      return getConsistentTailTransaction(tailsAboveMaxDepth, index);
    })
    .catch(() => false);
};

const _promote = hash => api.promoteTransaction(
  hash,
  DEPTH,
  MIN_WEIGHT_MAGNITUDE,
  [{
    address: 'U'.repeat(81),
    value: 0,
    message: '',
    tag: iota.utils.toTrytes('UMAIRPROMOTER'),
  }],
  { interrupt: false, delay: 0 },
);

const _replay = hash => api.replayBundle(
  hash,
  DEPTH,
  MIN_WEIGHT_MAGNITUDE,
);

const store = {
  activeIndex: 0,
  bundles: [],
};

const service = {
  requestBundles() {
    logger.info('Requesting bundles from storage instance');

    requestForUnconfirmedBundles()
      .then(({ data }) => {
        logger.success(`Received ${_.size(data)} bundles for promotion.`);

        store.bundles = _.map(_.orderBy(data, 'receivedAt', ['asc']), bundleMeta => bundleMeta.bundle);
        this.startPromotion();
      }).catch(error => {
        logger.error('An error has occurred fetching bundles from storage instance.');
        logger.error(error.message);

        setTimeout(() => this.startPromotion(), 5000);
      });
  },
  startPromotion() {
    return promoteTransactions(); // eslint-disable-line no-use-before-define
  },
};

const promoteTransactions = (
  activeBundle,
  attempt = 0,
) => {
  let tailTransactions = [];

  const { bundles, activeIndex } = store;
  const bundleToPromote = bundles[activeIndex];

  if (bundleToPromote) {
    logger.info(`About to promote transaction with bundle hash ${bundleToPromote}`);

    api.findTransactionObjects({ bundles: [bundleToPromote] })
      .then(transactionObjects => {
        if (_.every(transactionObjects, tx => tx.value === 0)) {
          throw new Error(Errors.ZERO_VALUE_TRANSACTION);
        }

        const extractTailTransactions = tx => tx.currentIndex === 0;
        tailTransactions = _.filter(transactionObjects, extractTailTransactions);

        return api.getLatestInclusion(_.map(tailTransactions, tx => tx.hash));
      }).then(states => {
        const isConfirmed = state => state;

        if (_.some(states, isConfirmed)) {
          throw new Error(Errors.TRANSACTION_ALREADY_CONFIRMED);
        }

        logger.info(`Finding a promotable tail transaction for bundle with hash ${bundleToPromote}`);
        return getConsistentTailTransaction(tailTransactions, 0);
      })
      .then(promotableTailTransaction => {
        if (promotableTailTransaction) {
          logger.success(`Found a promotable transaction with hash ${promotableTailTransaction.hash}`);
          logger.info(`Promoting transaction with bundle hash ${bundleToPromote}`);

          return _promote(promotableTailTransaction.hash);
        }

        logger.info(`Replaying transaction with bundle hash ${bundleToPromote}`);

        return _replay(tailTransactions[tailTransactions.length - 1].hash)
          .then(replayedTransactionObjects => {
            logger.success(`Bundle with hash ${bundleToPromote} replayed.`);

            const tailTransaction = _.find(replayedTransactionObjects, { currentIndex: 0 });

            return _promote(tailTransaction.hash);
          });
      })
      .then(() => {
        logger.success(`Bundle with hash ${bundleToPromote} successfully promoted.`);

        // Increase active index
        store.activeIndex += 1;
        // Inform storage instance about successful promotion
        increasePromotionCount(bundleToPromote)
          .then(promoteTransactions)
          .catch(promoteTransactions);
      })
      .catch(error => {
        const { message } = error;

        if (message === Errors.TRANSACTION_ALREADY_CONFIRMED) {
          logger.success(`Bundle with hash ${bundleToPromote} already confirmed.`);

          // Inform storage instance to remove this bundle
          requestForBundleRemoval(bundleToPromote)
            .then(() => {
              // Remove active bundle
              store.bundles.splice(store.activeIndex, 1);
              promoteTransactions();
            })
            .catch(() => {
              // In case there is an error informing storage instance
              // Just remove from local queue and move on
              store.bundles.splice(store.activeIndex, 1);
              promoteTransactions();
            });
        } else if (message === Errors.ZERO_VALUE_TRANSACTION) {
          logger.warn(`Bundle with hash ${bundleToPromote} is zero value`);
          logger.info(`Will delete bundle with hash ${bundleToPromote} from storage`);

          // Inform storage instance to remove this bundle
          requestForBundleRemoval(bundleToPromote)
            .then(() => {
              // Remove active bundle
              store.bundles.splice(store.activeIndex, 1);
              promoteTransactions();
            })
            .catch(() => {
              // In case there is an error informing storage instance
              // Just remove from local queue and move on
              store.bundles.splice(store.activeIndex, 1);
              promoteTransactions();
            });
        } else if (_.includes(message, Errors.TRANSACTION_TOO_OLD)) {
          logger.warn('Reference transaction is too old.');

          logger.info(`Replaying transaction with bundle hash ${bundleToPromote}`);
          _replay(tailTransactions[tailTransactions.length - 1].hash)
            .then(() => {
              logger.success(`Bundle with hash ${bundleToPromote} replayed.`);

              // Start promotion with the active bundle
              promoteTransactions(bundleToPromote);
            });
        } else {
          logger.error(`An error has occurred promoting transaction with bundle hash ${bundleToPromote}`);
          logger.error(message);

          if (attempt === 2) {
            store.activeIndex += 1;
            promoteTransactions(bundleToPromote);
          } else {
            attempt += 1; // eslint-disable-line no-param-reassign
            promoteTransactions(bundleToPromote, attempt);
          }
        }
      });
  } else {
    logger.warn('Cannot promote any transactions at the moment.');

    logger.info(`Total enqueued bundles: ${_.size(store.bundles)}`);
    logger.info(`Active Index: ${store.activeIndex}`);

    setTimeout(() => {
      store.activeIndex = 0;

      service.requestBundles();
    }, 5000);
  }
};

// Initialize by requesting bundles from storage instance
service.requestBundles();

