const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

// Initialize Africa's Talking SDK with environment variables
const credentials = {
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox', // Default to sandbox if not specified
};
const AfricasTalking = require('africastalking')(credentials);

// Initialize services you'll use
const sms = AfricasTalking.SMS;

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory database for demo purposes
let transactions = [];
let users = {
  "+233123456789": {
    name: "Emmanuel Acheampong",
    balance: {
      local: 2500,
      USD: 250,
      EUR: 225,
    },
    country: "Ghana",
  },
  "+234987654321": {
    name: "Toluwalase Oyebamiji",
    balance: {
      local: 45000,
      USD: 120,
      EUR: 100,
    },
    country: "Nigeria",
  },
};

// Exchange rates
const exchangeRates = {
  Ghana: { code: "GHS", rate: 5.8 },
  Nigeria: { code: "NGN", rate: 900 },
  Kenya: { code: "KES", rate: 130 },
  "South Africa": { code: "ZAR", rate: 18 },
  Uganda: { code: "UGX", rate: 3700 },
  Tanzania: { code: "TZS", rate: 2500 },
  Rwanda: { code: "RWF", rate: 1200 },
  Ethiopia: { code: "ETB", rate: 57 }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Admin API routes
app.get("/api/transactions", (req, res) => {
  res.json(transactions);
});

app.get("/api/users", (req, res) => {
  res.json(users);
});

app.get("/api/exchange-rates", (req, res) => {
  res.json(exchangeRates);
});

// Function to send SMS notification
const sendTransactionSMS = async (phoneNumber, message) => {
  try {
    const result = await sms.send({
      to: [phoneNumber],
      message: message
    });
    console.log('SMS sent:', result);
    return result;
  } catch (error) {
    console.error('SMS sending failed:', error);
    return error;
  }
};

// USSD endpoint
app.post("/api/ussd", (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = "";

    if (text === "") {
      response = `CON Welcome to cross-border payments
          1. Send Money
          2. Receive Money
          3. Check Balance
          4. Exchange Rates`;
    } else if (text === "1") {
      response = `CON Enter recipient phone number`;
    } else if (text.startsWith("1*") && !text.includes("*", 2)) {
      response = `CON Select recipient's country:
          1. Ghana
          2. Nigeria
          3. Kenya
          4. South Africa
          5. Uganda
          6. Tanzania
          7. Rwanda
          8. Ethiopia`;
    } else if (text.startsWith("1*") && text.split("*").length === 3) {
      response = `CON Enter amount to send:`;
    } else if (text.startsWith("1*") && text.split("*").length === 4) {
      const segments = text.split("*");
      const recipientPhone = segments[1];
      const countryCode = segments[2];
      const amount = segments[3];

      let country = "";
      switch (countryCode) {
        case "1":
          country = "Ghana";
          break;
        case "2":
          country = "Nigeria";
          break;
        case "3":
          country = "Kenya";
          break;
        case "4":
          country = "South Africa";
          break;
        case "5":
          country = "Uganda";
          break;
        case "6":
          country = "Tanzania";
          break;
        case "7":
          country = "Rwanda";
          break;
        case "8":
          country = "Ethiopia";
          break;
        default:
          break;
      }
      const localAmount = amount * exchangeRates[country].rate;

      response = `CON Confirm sending ${amount} USD to ${recipientPhone} in ${country}:
          1. Confirm
          2. Cancel`;
    } else if (
      text.startsWith("1*") &&
      text.split("*").length === 5 &&
      text.endsWith("1")
    ) {
      const segments = text.split("*");
      const recipientPhone = segments[1];
      const countryCode = segments[2];
      const amount = parseFloat(segments[3]);

      let country = "";
      switch (countryCode) {
        case "1":
          country = "Ghana";
          break;
        case "2":
          country = "Nigeria";
          break;
        case "3":
          country = "Kenya";
          break;
        case "4":
          country = "South Africa";
          break;
        case "5":
          country = "Uganda";
          break;
        case "6":
          country = "Tanzania";
          break;
        case "7":
          country = "Rwanda";
          break;
        case "8":
          country = "Ethiopia";
          break;
      }

      const transaction = {
          id: Date.now(),
          sender: phoneNumber,
          recipient: recipientPhone,
          amount,
          currency: 'USD',
          localAmount: amount * exchangeRates[country].rate,
          localCurrency: exchangeRates[country].code,
          timestamp: new Date().toISOString(),
          status: 'completed'
      };

      transactions.push(transaction);

      // Send SMS notification to both sender and recipient
      const senderMessage = `Your cross-border payment of $${amount} to ${recipientPhone} has been processed. Reference: ${transaction.id}`;
      const recipientMessage = `You have received $${amount} (${transaction.localAmount} ${transaction.localCurrency}) from ${phoneNumber}. Reference: ${transaction.id}`;
      
      // Send SMS asynchronously (don't await)
      sendTransactionSMS(phoneNumber, senderMessage);
      sendTransactionSMS(recipientPhone, recipientMessage);

      response = `END Your cross-border payment of $${amount} to ${recipientPhone} has been processed. Reference: ${transaction.id}`;
    } else if (text.startsWith('1*') && text.split('*').length === 5 && text.endsWith('2')) {
      response = `END Transaction cancelled.`;
    } else if (text === '2') {
      response = `END To receive money, share your phone number (${phoneNumber}) with the sender. You will be notified when money is sent to you.`;
    } else if (text === '3') {
      if (users[phoneNumber]) {
        const balance = users[phoneNumber].balance;
        response = `END Your current balance is:
        Local Currency: ${balance.local}
        USD: ${balance.USD}
        EUR: ${balance.EUR}`;
      } else {
        response = `END User not found. Please register for an account.`;
      }
    } else if (text === '4') {
      response = `END Current Exchange Rates:
      1 USD = ${exchangeRates['Ghana'].rate} GHS
      1 USD = ${exchangeRates['Nigeria'].rate} NGN
      1 USD = ${exchangeRates['Kenya'].rate} KES
      1 USD = ${exchangeRates['South Africa'].rate} ZAR
      1 USD = ${exchangeRates['Uganda'].rate} UGX
      1 USD = ${exchangeRates['Tanzania'].rate} TZS
      1 USD = ${exchangeRates['Rwanda'].rate} RWF
      1 USD = ${exchangeRates['Ethiopia'].rate} ETB`;
    } else {
      response = `END Invalid option selected.`;
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(response);
  } catch (error) {
    console.error("USSD Error:", error);
    res.set('Content-Type', 'text/plain');
    res.send("END An error occurred. Please try again later.");
  }
});

// Check for required environment variables at startup
if (!process.env.AFRICASTALKING_API_KEY) {
  console.error("ERROR: AFRICASTALKING_API_KEY is not set in environment variables");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using Africa's Talking credentials for: ${credentials.username}`);
});