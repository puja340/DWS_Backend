// update/email.controller.js  (or verify-email/email.controller.js)

const bcrypt = require('bcrypt');
const transporter = require('../config/mail');   // ← Use your existing mail transporter

const sendEmailChangeOTP = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        const { newEmail, currentPassword } = req.body;

        if (!newEmail || !currentPassword) {
            return res.status(400).json({
                success: false,
                message: "New email and current password are required"
            });
        }

        const User = require('../models/User');
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const existingUser = await User.findOne({ where: { email: newEmail } });
        if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({
                success: false,
                message: "This email is already in use"
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Correct loading of EmailOtp model
        const sequelize = require('../config/database');
        const EmailOtpFactory = require('./email.model');
        const EmailOtp = EmailOtpFactory(sequelize, require('sequelize').DataTypes);

        await EmailOtp.create({
            user_id: userId,
            new_email: newEmail,
            otp: otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000)
        });

        // Send email using your transporter
        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: newEmail,
            subject: 'Your OTP for Email Change',
            text: `Your OTP for changing email is: ${otp}. This OTP is valid for 10 minutes.`,
            html: `
                <h3>Email Change Request</h3>
                <p>Your OTP is: <strong>${otp}</strong></p>
                <p>This OTP is valid for 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            `
        });

        console.log(`[OTP] OTP for user ${userId} to change email to ${newEmail} is: ${otp}`);

        return res.json({
            success: true,
            message: "OTP sent to your new email address. Please check your inbox."
        });

    } catch (err) {
        console.error("Error in sendEmailChangeOTP:", err);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const verifyEmailOTP = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required"
            });
        }

        // Correct way to load EmailOtp model
        const sequelize = require('../config/database');
        const EmailOtpFactory = require('./email.model');
        const EmailOtp = EmailOtpFactory(sequelize, require('sequelize').DataTypes);

        const otpRecord = await EmailOtp.findOne({
            where: {
                user_id: userId,
                otp: otp,
            }
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        if (new Date() > otpRecord.expires_at) {
            await otpRecord.destroy();
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        const User = require('../models/User');
        const user = await User.findByPk(userId);

        // Update email
        await user.update({ email: otpRecord.new_email });

        // Delete used OTP
        await otpRecord.destroy();

        return res.json({
            success: true,
            message: "Email updated successfully",
            data: {
                email: otpRecord.new_email,
                name: user.name
            }
        });

    } catch (err) {
        console.error("Error in verifyEmailOTP:", err);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    sendEmailChangeOTP,
    verifyEmailOTP
};