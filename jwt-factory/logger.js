const winston = require("winston");
const expressWinston = require("express-winston");

module.exports = {
  logger: winston.createLogger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.simple(), winston.format.timestamp()),
  }),
  expressWinstonLogger: expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.simple(), winston.format.timestamp()),
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}}",
    expressFormat: true,
    colorize: false,
    ignoreRoute: function (req, res) {
      return false;
    },
  }),
};
