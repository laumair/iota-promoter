const zmq = require('zeromq');
const IOTA = require('iota.lib.js');
const config = require('../config');
const Store = require('./store');
const logger = require('./utils/logger');

const iota = new IOTA();
const sock = zmq.socket('sub');

sock.connect(config.ZMQ_HOST);
sock.subscribe('tx');

sock.on('message', topic => {
  const message = topic.toString();

  if (message.includes('tx_trytes')) {
    const trytes = message.substring(message.indexOf('tx_trytes') + 10);
    const transactionObject = iota.utils.transactionObject(trytes);

    logger.info(`Adding new bundle with hash ${transactionObject.bundle}`);

    Store.update('bundles', transactionObject.bundle).then(() => {
      logger.info(`Storage updated with bundle hash ${transactionObject.bundle}`);
    });
  }
});
