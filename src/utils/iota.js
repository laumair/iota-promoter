const IOTA = require('iota.lib.js');
const config = require('../../config');

const iota = new IOTA({ provider: config.IRI_HOST });

module.exports = {
  iota,
};
