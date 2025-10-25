import winston from "winston";
import "winston-daily-rotate-file";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "white",
};

const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true, colors }),
  winston.format.printf(
    (info) => `[${info.timestamp}] [${info.level}]: ${info.message}`
  )
);

const transports = [
  new winston.transports.DailyRotateFile({
    level: "info",
    filename: "logs/application-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    format: winston.format.json(),
  }),
  new winston.transports.Console({
    level: "debug",
    format,
  }),
];

const logger = winston.createLogger({
  levels,
  transports,
});

export default logger;
