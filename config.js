module.exports = {
  IRI_HOST: process.env.IRI_HOST || 'http://iota-node.eastus.cloudapp.azure.com',
  ZMQ_HOST: process.env.ZMQ_HOST || 'tcp://iota-node.eastus.cloudapp.azure.com:5556',
  MONGO_URL: 'mongodb://localhost/tanglr',
  API_URL: process.env.API_URL || 'http://localhost:3000/api/v1',
};
