const http = require('http');
const app = require('./libs/express');
const mongoose = require('./libs/mongoose');

const server = http.createServer(app);
const init = { connectMongoose: next => mongoose.connect(next) };

init.connectMongoose((err) => {
  if (err) {
    throw new Error(err);
  }

  server.listen(process.env.PORT || 3000, () => {
    console.log('Server started at: http://127.0.0.1:3000'); // eslint-disable-line no-console
  });
});
