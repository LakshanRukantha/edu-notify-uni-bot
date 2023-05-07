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
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "userData", //This create database name
  })
  .then(() => {
    logger.info(`✅ Connected to the Database`);
  })
  .catch((err) => {
    logger.error(`❌ Database connection faliure!`);
  });

// Define a schema for user registration
const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

// Create a model based on the schema
const User = mongoose.model("User", userSchema, "users"); //In this 'users' create collection name

//Bot connection status
bot.onText(/\/status/, async (msg, match) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "✅ Up and running.");
});

//Register user
bot.onText(/\/register/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = new User({
    telegramId: chatId.toString(),
    name: msg.chat.first_name + " " + msg.chat.last_name,
  });
  try {
    await user.save();
    bot.sendMessage(
      chatId,
      "You have been registered for daily notifications."
    );
  } catch (err) {
    bot.sendMessage(
      chatId,
      "You are already registered for daily notifications."
    );
  }
});

//Server listning
app.listen(port, () => {
  logger.info(`🚀 Server is running on port: ${port}`);
});
