const express = require('express');
const cors = require('cors');
const routes = require('../routes');


const app = express();

app.options('*', cors())
// mount all routes on /api path
app.use('/api/v1', routes);

module.exports = app;
