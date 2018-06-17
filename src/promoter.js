const IOTA = require('iota.lib.js');
const promisify = require('pify');
const curl = require('curl.lib.js');
const Errors = require('./utils/errors');
const Store = require('./store');
const config = require('../config');
const logger = require('./utils/logger');
const { isAboveMaxDepth } = require('./utils/helpers');

const iota = new IOTA({ provider: config.IRI_HOST });

curl.overrideAttachToTangle(iota);

const api = {
  promoteTransaction: promisify(iota.api.promoteTransaction).bind(iota.api),
  getLatestInclusion: promisify(iota.api.getLatestInclusion).bind(iota.api),
  findTransactionObjects: promisify(iota.api.findTransactionObjects).bind(iota.api),
  replayBundle: promisify(iota.api.replayBundle).bind(iota.api),
};

function getConsistentTailTransaction(tailTransactions, index) {
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
}

function startPromoting(bundles, attempt = 0) {
  const promote = hash => api.promoteTransaction(
    hash,
    3,
    14,
    [{
      address: 'U'.repeat(81),
      value: 0,
      message: '',
      tag: '',
    }],
    { interrupt: false, delay: 0 },
  );

  const currentBundle = bundles[0];
  let tailTransactions = [];

  if (currentBundle) {
    logger.info(`About to promote transaction with bundle hash ${currentBundle}`);

    api.findTransactionObjects({ bundles: [currentBundle] })
      .then((transactionObjects) => {
        const extractTailTransactions = tx => tx.currentIndex === 0;
        tailTransactions = transactionObjects.filter(extractTailTransactions);

        return api.getLatestInclusion(tailTransactions.map(tx => tx.hash));
      }).then((states) => {
        if (states.some(state => state)) {
          throw new Error(Errors.TRANSACTION_ALREADY_CONFIRMED);
        }

        logger.info(`Finding a promotable tail transaction for bundle with hash ${currentBundle}`);
        return getConsistentTailTransaction(tailTransactions, 0);
      }).then((promotableTailTransaction) => {
        if (promotableTailTransaction) {
          logger.info(`Promoting transaction with bundle hash ${currentBundle}`);
          return promote(promotableTailTransaction.hash);
        }

        logger.info(`Replaying transaction with bundle hash ${currentBundle}`);
        return api.replayBundle(
          tailTransactions[tailTransactions.length - 1].hash,
          3,
          14,
        ).then((replayedTransactionObjects) => {
          logger.info(`Bundle with hash ${currentBundle} replayed.`);
          const tailTransaction = replayedTransactionObjects.find(tx => tx.currentIndex === 0);

          return promote(tailTransaction.hash);
        });
      })
      .then(() => {
        logger.info(`Bundle with hash ${currentBundle} promoted.`);

        const clone = bundles.slice();

        clone.shift();
        clone.push(currentBundle);

        return Store.set('bundles', clone);
      })
      .then(updatedBundles => {
        setTimeout(() => startPromoting(updatedBundles), 1000);
      })
      .catch(error => {
        const { message } = error;

        if (message === Errors.TRANSACTION_ALREADY_CONFIRMED) {
          logger.success(`Bundle with hash ${currentBundle} already confirmed.`);
          Promise.all([
            Store.delete('bundles', currentBundle),
            Store.update('confirmed', currentBundle),
          ]).then(result => {
            const [updatedBundles] = result;
            startPromoting(updatedBundles);
          });
        } else {
          logger.error(`An error has occurred promoting transaction with bundle hash ${currentBundle}`);
          logger.error(message);

          if (attempt === 2) {
            const clone = bundles.slice();

            clone.shift();
            clone.push(currentBundle);

            Store.set('bundles', clone).then(updatedBundles => {
              startPromoting(updatedBundles);
            });
          } else {
            attempt += 1; // eslint-disable-line no-param-reassign
            startPromoting(bundles, attempt);
          }
        }
      });
  } else {
    Store.get('bundles').then(newBundles => startPromoting(newBundles));
  }
}

Store.get('bundles').then(bundles => startPromoting(bundles)).catch(logger.error);
