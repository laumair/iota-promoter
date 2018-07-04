const _ = require('lodash');
const promisify = require('pify');
const logger = require('../../utils/logger');
const Bundle = require('../../models/bundle');
const { iota } = require('../../utils/iota');
const Errors = require('../../utils/errors');

exports.fetchBundles = (req, res) => {
  logger.info(`Request received for getting bundles from IP: ${req.connection.remoteAddress} at time: ${Date.now()}`);
  Bundle.find({}, (err, bundles) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.jsonp(bundles);
    }
  });
};

exports.addBundle = (req, res) => {
  const bundleHash = req.params.bundle;
  logger.info(`Request received for adding bundle with hash ${bundleHash} from IP: ${req.connection.remoteAddress} at time: ${Date.now()}`);

  const api = {
    getLatestInclusion: promisify(iota.api.getLatestInclusion).bind(iota.api),
    findTransactionObjects: promisify(iota.api.findTransactionObjects).bind(iota.api),
  };

  Bundle.find({}).then(bundles => {
    if (_.includes(_.map(bundles, value => value.bundle), bundleHash)) {
      throw new Error(Errors.TRANSACTION_ALREADY_ENQUEUED);
    }

    return api.findTransactionObjects({ bundles: [bundleHash] });
  }).then(txs => {
    if (_.isEmpty(txs)) {
      throw new Error(Errors.NO_TRANSACTIONS_FOUND);
    }

    const isZeroValue = _.every(txs, tx => tx.value === 0);

    if (isZeroValue) {
      throw new Error(Errors.ZERO_VALUE_TRANSACTION);
    }

    const tails = _.filter(txs, tx => tx.currentIndex === 0);
    return api.getLatestInclusion(_.map(tails, tx => tx.hash));
  }).then(states => {
    const isConfirmed = _.some(states, state => state);

    if (isConfirmed) {
      throw new Error(Errors.TRANSACTION_ALREADY_CONFIRMED);
    }

    return Bundle.create({ bundle: bundleHash });
  })
    .then((bundle) => res.jsonp(bundle))
    .catch(error => {
      return res.status(400).send(error.message);
    });
};

exports.removeBundle = (req, res) => {
  logger.info(`Request received for removing bundle ${req.params.bundle} from IP: ${req.connection.remoteAddress} at time: ${Date.now()}`);
  Bundle.remove({ bundle: req.params.bundle }, (err, numRemoved) => {
    if (err) {
      res.status(500).send(err);
    } else if (numRemoved === 0) {
      res.status(404).send(`Could not find bundle with hash ${req.params.bundle}`);
    } else {
      res.jsonp(req.params.bundle);
    }
  });
};

exports.increasePromotionCount = (req, res) => {
  logger.info(`Request received for increasing promotion count for bundle ${req.params.bundle} from IP: ${req.connection.remoteAddress} at time: ${Date.now()}`);
  Bundle.findOne({ bundle: req.params.bundle }, (err, bundle) => {
    if (err) {
      res.status(404).send(err);
    } else {
      if (bundle) {
        bundle.promotionCount += 1;

        bundle.save((err) => {
          if (err) {
            res.status(404).send(err);
          } else {
            res.jsonp(req.params.bundle);
          }
        });
      } else {
        res.sendStatus(404);
      }
    }
  });
};
