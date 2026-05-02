const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
        return res.status(400).json({ message: "Email dan password harus diisi" });
    }

    try {
        // Cari user berdasarkan email
        const user = await User.findOne({
            where: { email },
            attributes: ['id', 'name', 'role', 'password']
        });

        // Cek jika user tidak ditemukan atau password belum di-hash dengan benar
        if (!user || user.password.length < 8) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        // Verifikasi password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        // Buat JWT dan Refresh Token secara paralel
        const [accessToken, refreshToken] = await Promise.all([
            generateAccessToken(user),
            generateRefreshToken(user)
        ]);

        // Simpan refresh token di cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
        });

        // Kirim response dengan accessToken
        res.status(200).json({
            message: "Login berhasil",
            accessToken,
            user: {
                id: user.id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan pada server", error: error.message });
    }
};

// Refresh token controller
exports.refreshToken = async (req, res) => {
    const token = req.cookies.refreshToken;

    if (!token) return res.status(401).json({ message: "Refresh token not found" });

    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findByPk(decoded.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        const newAccessToken = generateAccessToken(user);
        res.json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(403).json({ message: "Invalid refresh token", error: error.message });
    }
};

// Get user profile controller
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            name: user.name,
            nip: user.nip,
            email: user.email
        });
    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update profile controller
exports.updateProfile = async (req, res) => {
    const { name, email, password, showPassword } = req.body;

    try {
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update user data
        if (name) user.name = name;
        if (email) user.email = email;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        res.json({
            message: "Profile updated successfully",
            email: email,
            name: name,
            password: showPassword ? password : "********",
        });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};