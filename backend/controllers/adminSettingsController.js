const { pool } = require('../config/db');

exports.getSettings = async (req, res) => {
    try {
        // Fetch all configurable parameters that affect user dashboard behavior
        const result = await pool.query(`
            SELECT setting_key, setting_value 
            FROM settings 
            WHERE setting_key LIKE 'min_withdrawal_%' 
               OR setting_key LIKE 'max_withdrawal_%' 
               OR setting_key IN ('activation_fee', 'announcement_text', 'maintenance_mode', 'spin_wheel_config')`);
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Wheel Configuration
exports.getSpinConfig = async (req, res) => {
    try {
        const result = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'spin_wheel_config'");
        if (result.rows.length > 0) {
            const config = JSON.parse(result.rows[0].setting_value);
            res.json({ success: true, config });
        } else {
            res.json({ success: false, message: 'No config found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Wheel Configuration
exports.updateSpinConfig = async (req, res) => {
    const { labels, values } = req.body;
    try {
        const configString = JSON.stringify({ labels, values });
        await pool.query("INSERT INTO settings (setting_key, setting_value) VALUES ('spin_wheel_config', $1) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1", [configString]);
        res.json({ success: true, message: 'Spin configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    const { settings } = req.body;
    try {
        const keys = Object.keys(settings);
        for (const key of keys) {
            await pool.query(
                "INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2",
                [key, settings[key].toString()]
            );
        }
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};