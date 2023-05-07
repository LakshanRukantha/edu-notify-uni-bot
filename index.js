const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const logger = require("./src/utils/logger");

//Variables declaration
const token = process.env.TELEGRAM_TOKEN;
const port = process.env.PORT || 4000;
const db_connection_string = process.env.MONGODB_CONNECTION_STRING;

//Instances declaration
const bot = new TelegramBot(token, { polling: true });

//Server web request for check if it is running
app.get("/", (req, res) => {
  res.status(200).send({
    message: "Welcome to EduNotify Backend Server 👋",
    description: "Your gateway to university timetables! 🎓🤖",
  });
});

//DB Connection
mongoose
  .connect(db_connection_string, {
    //options
  })
  .then(() => {
    logger.info(`✅ Connected to the Database`);
  })
  .catch((err) => {
    logger.error(`❌ Database connection faliure!`);
  });

//Bot connection status
bot.onText(/\/status/, async (msg, match) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "✅ Up and running.");
});

//Server listning
app.listen(port, () => {
  logger.info(`🚀 Server is running on port: ${port}`);
});
