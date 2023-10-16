const express = require('express');
const http = require('http');
const { logger, expressWinstonLogger } = require('./logger')
const app = express();


app.use(expressWinstonLogger);
app.use(express.json());

const port = process.env.PORT ?? 3000;

app.get('/data', (req,res) => {
  
  res.json({
    "this": "is",
    "some": "response",
    "data": "for you",
    "from": "the first backend"
  })
});

app.get('/data2', (req,res) => {
  res.json({
   "dataFrom": "second service"
  })
});


http.createServer(app)
  .listen(port, () => {
    console.log(`Backend running on ${port}`);
  });