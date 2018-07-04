const _ = require('lodash');
const IOTA = require('iota.lib.js');
const zmq = require('zeromq');
const mongoose = require('./libs/mongoose');
const config = require('../config');
const logger = require('./utils/logger');
const Bundle = require('./models/bundle');

const BATCH_SIZE = 100;
const init = { connectMongoose: next => mongoose.connect(next) };
const iota = new IOTA();
let processingBatch = false;
let bundles = {};

const insert = (docs, cb) => {
  const bundlesToStore = [];
  const bundlesToRemove = [];

  const bundleHashes = _.keys(docs);
  const sizeOfBundles = _.size(bundleHashes);

  _.each(bundleHashes, (bundle, index) => {
    const hasAllTxs = _.size(docs[bundle]) - 1 === _.get(_.maxBy(docs[bundle], 'lastIndex'), 'lastIndex') ||
      _.every(docs[bundle], (tx) => tx.currentIndex === tx.lastIndex);
    const isValueTx = _.some(docs[bundle], (tx) => tx.value !== 0);

    if (hasAllTxs) {
      if (isValueTx) {
        bundlesToStore.push({ bundle });

        // Also add them here to remove from cache
        bundlesToRemove.push(bundle);
      } else {
        bundlesToRemove.push(bundle);
      }
    }

    if (index === sizeOfBundles - 1) {
      Bundle.find({ bundle: { $in: _.map(bundlesToStore, (value) => value.bundle) } }, (err, existingBundles) => {
        if (err) {
          cb(err);
        } else {
          const existingBundleHashes = _.map(existingBundles, (value) => value.bundle);
          const uniqueBundles = _.filter(bundlesToStore, (value) => !_.includes(existingBundleHashes, value.bundle));

          Bundle.create(uniqueBundles, (error) => {
            if (error) {
              cb(error);
            } else {
              cb(null, { bundlesToRemove, bundlesToStore });
            }
          });
        }
      });
    }
  });
};

init.connectMongoose((err) => {
  if (err) {
    throw new Error(err);
  }

  const sock = zmq.socket('sub');
  sock.connect(config.ZMQ_HOST);
  sock.subscribe('tx');

  sock.on('message', topic => {
    const message = topic.toString();

    if (message.includes('tx_trytes')) {
      const trytes = message.split(' ')[1];
      const tx = iota.utils.transactionObject(trytes);

      bundles[tx.bundle] = [...bundles[tx.bundle] || [], tx];

      const bundleHashes = _.keys(bundles);
      logger.info(`Total cached bundles: ${bundleHashes.length}`);

      if (
        bundleHashes.length &&
        bundleHashes.length % BATCH_SIZE === 0 &&
        !processingBatch
      ) {
        processingBatch = true;
        const batch = bundleHashes.slice(0, BATCH_SIZE);

        insert(_.pick(bundles, batch), (err, { bundlesToRemove, bundlesToStore }) => {
          if (err) {
            logger.error('An error occurred');
            processingBatch = false;
          } else {
            logger.success(`Successfully added a batch of ${bundlesToStore.length} bundles`);
            logger.warn(`Removing ${bundlesToRemove.length} bundles from cache`);
            bundles = _.omit(bundles, bundlesToRemove);
            processingBatch = false;
          }
        });
      }
    }
  });
});
