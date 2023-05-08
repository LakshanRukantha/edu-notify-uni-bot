const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const app = express();
const schedule = require("node-schedule");
const logger = require("./src/utils/logger");

//Variables declaration
const token = process.env.TELEGRAM_TOKEN;
const port = process.env.PORT || 4000;
const db_connection_string = process.env.MONGODB_CONNECTION_STRING;
const adminId = Number(process.env.ADMIN_ID);

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
async function start() {
  try {
    await mongoose.connect(db_connection_string, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "userData",
    });
    logger.info("✅ Connected to the Database");
  } catch (err) {
    logger.error("❌ Database connection failure!");
  }
}

start();

// Define a schema for user registration
const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      unique: true,
      required: true,
    },
    username: {
      type: String,
    },
    name: {
      type: String,
      required: true,
    },
    birthday: {
      type: Date,
      required: true,
    },
    degreeCode: {
      type: String,
      required: true,
    },
    uniName: {
      type: String,
      required: true,
    },
    degreeName: {
      type: String,
      required: true,
    },
    group: {
      type: String,
      required: true,
    },
    notify: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);

//Define schema for timetable update
const degreeSchema = new mongoose.Schema({
  degreeCode: {
    type: String,
    required: true,
  },
  degreeName: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  semester: {
    type: Number,
    required: true,
  },
  timetableUrl: {
    type: String,
    required: true,
  },
});

// Create a model based on the schema
const User =
  mongoose.models.User || mongoose.model("User", userSchema, "users");
//In this 'users' create collection name

//Degree model
const Degree =
  mongoose.models.Degree || mongoose.model("Degree", degreeSchema, "degrees");

const sheduleNotify = async () => {
  // Schedule a daily check at 12:00 AM
  schedule.scheduleJob("0 0 0 * * *", async () => {
    // 0 0 0 * * * daily
    const today = new Date();
    const todayMonth = today.getUTCMonth() + 1;
    const todayDay = today.getUTCDate();
    logger.info(`Shedule message is executed`);
    try {
      const users = await User.find({
        $expr: {
          $and: [
            { $eq: [{ $month: "$birthday" }, todayMonth] },
            { $eq: [{ $dayOfMonth: "$birthday" }, todayDay] },
          ],
        },
      });

      if (users?.length === 0) {
        logger.log("No users have a birthday today");
        return;
      }

      const line = "------------------------------------------";
      let message = "\n\nDev testing: {lakshan}\n\nToday birthdays:\n\n";
      var currentdate = new Date();
      var datetime =
        "Execution Time: " +
        currentdate.getDate() +
        "/" +
        (currentdate.getMonth() + 1) +
        "/" +
        currentdate.getFullYear() +
        " @ " +
        currentdate.getHours() +
        ":" +
        currentdate.getMinutes() +
        ":" +
        currentdate.getSeconds();
      users.forEach((user) => {
        const newDate = new Date(
          user.birthday.setDate(user.birthday.getDate() - 1)
        );
        const longDateString = newDate.toLocaleDateString("en-US", {
          // weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        message += `${line}\n`;
        message += `Name: ${user.name}\nBirthday: ${longDateString}`;
        message += `\n${line}\n\n`;
      });

      message += `Wishing all our users born today a very happy birthday! 🎉🎂🎁🎈\n\n${datetime}`;

      // Send the message to all registered users
      const allUsers = await User.find({ notify: true });
      const promises = allUsers.map(async (user) => {
        return await bot
          .sendMessage(user.telegramId, message)
          .catch((error) => {
            logger.error(
              `Error sending message to user ${user.name}: ${error.message}`
            );
          });
      });

      await Promise.all(promises);
    } catch (error) {
      logger.error(`Error retrieving users from database: ${error.message}`);
    }
  });
};

//sheduleNotify();

const authenticate = async (msg) => {
  const { id: telegramId } = msg.chat;

  // Check if the user is registered
  const user = await User.findOne({ telegramId });
  if (!user || !user.notify) {
    bot.sendMessage(
      msg.chat.id,
      "🚫 Permission denided.\n😕 You are not registered."
    );
    return false;
  }

  return true;
};

//Bot connection status
bot.onText(/\/status/, async (msg, match) => {
  if (await authenticate(msg)) {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "✅ Up and running.");
  }
});

//Register user
bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user is already registered
  const user = await User.findOne({ telegramId: chatId });
  if (user) {
    if (!user.notify) {
      user.notify = true;
      await user.save();
      bot.sendMessage(chatId, "✅ You have been registered successfully.");
    } else {
      bot.sendMessage(chatId, "😉 You are already registered.");
    }
    return;
  }

  // Prompt the user for their birthday
  let birthday;
  while (true) {
    bot.sendMessage(chatId, "What is your birthday (MM/DD/YYYY)?");

    // Listen for the user's response
    const response = await new Promise((resolve) =>
      bot.once("message", resolve)
    );
    const text = response.text;

    // Validate the user's birthday
    const birthdayRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!birthdayRegex.test(text)) {
      bot.sendMessage(
        chatId,
        "❌ Invalid birthday format. Please try again (MM/DD/YYYY)."
      );
      continue;
    }

    birthday = new Date(text);
    if (isNaN(birthday.getTime())) {
      bot.sendMessage(chatId, "❌ Invalid date. Please try again.");
      continue;
    }

    break;
  }

  // Prompt the user for their degree code
  let degreeCode, degreeName, university, group;
  while (true) {
    let message = `Degree codes: \n\nSE-UGC (Software Engineering - UGC)\nSE-PLY  (Software Engineering - Plymouth)\n\nGroup codes: \n\nA1 (A1 Group)\nA2 (A2 Group)\nB1 (B2 Group)\n`;
    bot.sendMessage(
      chatId,
      `${message}\n\nWhat is your degree code? (ex: SE-UGC-B1): `
    );

    // Listen for the user's response
    const response = await new Promise((resolve) =>
      bot.once("message", resolve)
    );
    const text = response.text;

    let errMessage = "❌ Oops! Something went wrong. \n\n";
    const formattedDegreeCode = text.toUpperCase().replace(/[^A-Z0-9-]/g, "");

    const uniCheck = () => {
      if (formattedDegreeCode.match("UGC")) {
        university = "NSBM Green University";
        return true;
      } else if (formattedDegreeCode.match("PLY")) {
        university = "Plymouth University";
        return true;
      } else if (formattedDegreeCode.match("VU")) {
        university = "Victoria University";
        return true;
      } else {
        errMessage +=
          "❌ University not found in the current list. Please contact @lakshanrukantha to add your university to the bot's database.\n";
        return false;
      }
    };
    const degreeCheck = () => {
      if (formattedDegreeCode.match("SE")) {
        degreeName = "Software Engineering";
        return true;
      } else if (formattedDegreeCode.match("CS")) {
        degreeName = "Computer Science";
        return true;
      } else {
        errMessage +=
          "❌ Sorry, we couldn't find your degree in our current list. Please contact @lakshanrukantha to add your degree to the bot's database.\n";
        return false;
      }
    };

    if (
      formattedDegreeCode.length >= 5 &&
      formattedDegreeCode.length <= 11 &&
      uniCheck() &&
      degreeCheck()
    ) {
      degreeCode = formattedDegreeCode;

      group = degreeCode.slice(-2);
      break;
    } else {
      errMessage += "❌ Invalid degree code. Please try again.";
      bot.sendMessage(chatId, errMessage);
    }
  }

  const newDate = new Date(birthday.setDate(birthday.getDate() + 1));

  // Save the user's information to the database
  const newUser = new User({
    telegramId: chatId.toString(),
    username: msg.chat.username || null,
    name: msg.chat.first_name + " " + msg.chat.last_name,
    birthday: newDate,
    degreeCode: degreeCode,
    uniName: university,
    degreeName: degreeName,
    group: group,
    notify: true,
  });
  await newUser.save();

  // Send a confirmation message to the user
  bot.sendMessage(chatId, "✅ You have been registered successfully.");
});

bot.onText(/\/update/, async (msg) => {
  const chatId = msg.chat.id;

  if (await authenticate(msg)) {
    // Prompt the user for their degree code
    let degreeCode, degreeName, university, group;

    let message = `Degree codes: \n\nSE-UGC (Software Engineering - UGC)\nSE-PLY  (Software Engineering - Plymouth)\n\nGroup codes: \n\nA1 (A1 Group)\nA2 (A2 Group)\nB1 (B2 Group)\n`;
    bot.sendMessage(
      chatId,
      `${message}\n\nWhat is your degree code? (ex: SE-UGC-B1): `
    );

    // Listen for the user's response
    const response = await new Promise((resolve) => {
      bot.once("message", resolve);
    });
    const text = response.text;

    if (text.startsWith("/")) {
      bot.sendMessage(chatId, "❌ Invalid input. Please try again.");
    }

    let errMessage = "❌ Oops! Something went wrong. \n\n";
    const formattedDegreeCode = text.toUpperCase().replace(/[^A-Z0-9-]/g, "");

    const uniCheck = () => {
      if (formattedDegreeCode.match("UGC")) {
        university = "NSBM Green University";
        return true;
      } else if (formattedDegreeCode.match("PLY")) {
        university = "Plymouth University";
        return true;
      } else if (formattedDegreeCode.match("VU")) {
        university = "Victoria University";
        return true;
      } else {
        errMessage +=
          "❌ University not found in the current list. Please contact @lakshanrukantha to add your university to the bot's database.\n";
        return false;
      }
    };
    const degreeCheck = () => {
      if (formattedDegreeCode.match("SE")) {
        degreeName = "Software Engineering";
        return true;
      } else if (formattedDegreeCode.match("CS")) {
        degreeName = "Computer Science";
        return true;
      } else {
        errMessage +=
          "❌ Sorry, we couldn't find your degree in our current list. Please contact @lakshanrukantha to add your degree to the bot's database.\n";
        return false;
      }
    };

    if (
      formattedDegreeCode.length >= 5 &&
      formattedDegreeCode.length <= 11 &&
      uniCheck() &&
      degreeCheck()
    ) {
      degreeCode = formattedDegreeCode;

      group = degreeCode.slice(-2);
    } else {
      errMessage += "❌ Invalid degree code. Please try again.";
      bot.sendMessage(chatId, errMessage);
    }

    console.log(`${degreeCode} ${degreeName} ${university} ${group}`);

    if (degreeCode != undefined) {
      User.findOneAndUpdate(
        { telegramId: chatId },
        {
          $set: {
            uniName: university,
            degreeCode: degreeCode,
            degreeName: degreeName,
            group: group,
          },
        },
        { new: true }
      )
        .then((user) => {
          if (user) {
            bot.sendMessage(
              chatId,
              "✅ Your account information has been successfully updated in the database."
            );
          } else {
            bot.sendMessage(chatId, "❌ User not found!");
          }
        })
        .catch((err) => {
          logger.error(err);
          bot.sendMessage(
            chatId,
            "❌ An error occurred. Please try again later."
          );
        });
    }
  }
});

bot.onText(/\/unregister/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user is registered
  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user || !user.notify) {
      bot.sendMessage(chatId, "😕 You are not registered.");
      return;
    } else {
      // Update the user's notify field to false
      user.notify = false;
      await user.save();
      // Send a confirmation message to the user
      bot.sendMessage(chatId, "😥 You have been unregistered.");
    }
  } catch (err) {
    logger.error(err);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while unregistering. Please try again later."
    );
  }
});

//Get timetable
bot.onText(/\/timetable/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(chatId);
});

async function getAllUsers() {
  try {
    const users = await User.find({});
    return users;
  } catch (err) {
    logger.error(err);
  }
}

// Handle the /users command
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  if (await authenticate(msg)) {
    if (chatId === adminId) {
      // Call the getAllUsers function to retrieve the list of users
      const users = await getAllUsers();

      // Construct a message with the user names and ids
      let message = "Here's a list of all the users:\n\n";
      await Promise.all(
        users.map(async (user, index) => {
          const date = user.birthday;

          const longDateString = date.toLocaleDateString("en-US", {
            // weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          message += `User ${index + 1}:\nName: ${user.name}\nUsername: ${
            user.username
          }\nID: ${user.telegramId}\nBirthday: ${longDateString}\Degree: ${
            user.degreeCode
          }\n\n`;
        })
      );

      // Send the message back to the user
      bot.sendMessage(msg.chat.id, message);
    } else {
      bot.sendMessage(chatId, "🚫 You are not authorized to use this command.");
    }
  }
});

bot.onText(/\/account/, async (msg) => {
  const chatId = msg.chat.id;

  if (await authenticate(msg)) {
    try {
      const user = await User.findOne({ telegramId: chatId });

      const date = user.birthday;

      const longDateString = date.toLocaleDateString("en-US", {
        // weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      let message = "📋 Account Information:\n\n";
      message += `👤 Name: ${user.name}\n👨‍💻 Username: ${user.username}\n🆔 User ID: ${user.telegramId}\n🎂 Birthday: ${longDateString}\n🏫 University Name: ${user.uniName}\n🎓 Degree: ${user.degreeName}\n👻 Group: ${user.group}`;

      // Send the account data to the user
      bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(err);
      bot.sendMessage(chatId, "❌ An error occurred. Please try again later.");
    }
  }
});

//Server listning
app.listen(port, () => {
  logger.info(`🚀 Server is running on port: ${port}`);
});
