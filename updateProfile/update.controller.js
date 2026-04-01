const bcrypt = require('bcrypt');

const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        const { currentPassword, newPassword, confirmNewPassword, newName } = req.body;

        const User = require('../models/User');   // Direct require

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const bcrypt = require('bcrypt');

        // Verify current password
        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const updateData = {};

        // Update username if provided (important: column is 'username', not 'name')
        if (newName && newName.trim() !== '') {
            updateData.username = newName.trim();     // ← Changed to 'username'
        }

        // Update password if provided
        if (newPassword && newPassword.trim() !== '') {
            if (newPassword !== confirmNewPassword) {
                return res.status(400).json({
                    success: false,
                    message: "New password and confirm password do not match"
                });
            }

            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(newPassword, salt);
        }

        if (Object.keys(updateData).length > 0) {
            await user.update(updateData);
        }

        return res.json({
            success: true,
            message: "Profile updated successfully",
            data: {
                username: user.username,     // ← Changed to username
                email: user.email
            }
        });

    } catch (err) {
        console.error("Error in updateProfile:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

const updateEmail = async (req, res) => {
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

        const User = require('../models/User');   // Direct require

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const bcrypt = require('bcrypt');

        // 1. Verify current password
        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // 2. Check if new email is already taken by another user
        const existingUser = await User.findOne({ where: { email: newEmail } });
        if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({
                success: false,
                message: "This email is already in use by another account"
            });
        }

        // 3. Update email
        await user.update({ email: newEmail });

        return res.json({
            success: true,
            message: "Email updated successfully",
            data: {
                email: newEmail,
                name: user.name
            }
        });

    } catch (err) {
        console.error("Error in updateEmail:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

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

        // Verify current password
        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Check if new email is already taken
        const existingUser = await User.findOne({ where: { email: newEmail } });
        if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({
                success: false,
                message: "This email is already in use"
            });
        }

        // Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Save OTP in database
        const EmailOtp = require('./email_otp.model'); // We'll create this next
        await EmailOtp.create({
            user_id: userId,
            new_email: newEmail,
            otp: otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        // TODO: Send OTP via email service
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

        const EmailOtp = require('./email_otp.model');
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
    updateProfile,
    updateEmail,
    verifyEmailOTP,
    sendEmailChangeOTP
};

