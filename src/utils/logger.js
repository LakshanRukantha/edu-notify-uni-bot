const { createLogger, format, transports } = require("winston");

const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
  transports: [
    new transports.File({
      filename: "src/logs/combined.log",
      level: "error",
      format: combine(
        format.json(),
        timestamp({ format: "🕑 DD-MM-YYYY hh:mm:ss -" }),
        logFormat
      ),
    }),
    new transports.Http({
      level: "warn",
      format: combine(
        format.json(),
        timestamp({ format: "🕑 DD-MM-YYYY hh:mm:ss -" }),
        logFormat
      ),
    }),
    new transports.Console({
      level: "debug",
      format: combine(
        format((info) => ({ ...info, level: info.level.toUpperCase() }))(),
        colorize(),
        timestamp({ format: "🕑 DD-MM-YYYY hh:mm:ss -" }),
        logFormat
      ),
    }),
  ],
});

module.exports = logger;
