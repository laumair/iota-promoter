const mongoose = require('mongoose');
const config = require('../../config');

/* eslint-disable no-use-before-define */
const mongo = {
  connect,
  db: null,
};

/* eslint-enable no-use-before-define */
/* eslint-disable no-console */

function connect(next) {
  if (!mongo.db) {
    mongoose.connect(config.MONGO_URL);

    mongoose.connection.on('connected', () => {
      console.log(`Mongoose default connection opened with ${config.MONGO_URL}`);
      return next();
    });

    mongoose.connection.on('error', (err) => {
      console.log(`Mongoose default connection error:  ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose default connection disconnected');
    });
  } else {
    console.log('Mongoose already connected!');
    next();
  }
}

module.exports = mongo;
