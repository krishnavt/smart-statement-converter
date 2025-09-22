// Vercel entrypoint that imports express
const express = require('express');
const app = require('./api/vercel-server.js');

module.exports = app;