const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }

});

transporter.verify((error, success) => {
  if (error) {
    console.error("Mail server connection failed:", error);
  } else {
    console.log("Mail server is ready to send messages");
  }
});


module.exports = transporter;
