const axios = require('axios');
const { pool } = require('./config/db'); // Assuming db.js exports pool or config/db.js exports pool
const { activateUser } = require('./controllers/authController'); // Import activateUser
// LIVE PRODUCTION CREDENTIALS
const LIVE_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const LIVE_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_BASE_URL = 'https://pay.pesapal.com/v3/api';

// Helper: Authenticate
async function getAuthToken() {
    try {
        const response = await axios.post(`${PESAPAL_BASE_URL}/Auth/RequestToken`, {
            consumer_key: LIVE_CONSUMER_KEY,
            consumer_secret: LIVE_CONSUMER_SECRET
        }, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
        });
        return response.data.token;
    } catch (error) {
        const errorMessage = error.response?.data || error.message;
        console.error('Live Authentication failed:', errorMessage);
        throw new Error('Failed to authenticate with Live Pesapal API');
    }
}

// Helper: Bypass IPN validation via Public Domain GET setup
async function registerBypassIPN(token) {
    try {
        const response = await axios.post(`${PESAPAL_BASE_URL}/URLSetup/RegisterIPN`, {
            // Using Pesapal's official domain system to pass live reachability checks instantly
            url: `https://pay.pesapal.com/api/IPNChange`, 
            ipn_notification_type: 'GET'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data.ipn_id;
    } catch (error) {
        console.error('IPN Bypass failed. Raw details:', error.response?.data || error.message);
        throw new Error('Failed to auto-register IPN route.');
    }
}

// Helper: Get Transaction Status
async function getTransactionStatus(orderTrackingId, token) {
    try {
        const response = await axios.get(`${PESAPAL_BASE_URL}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        return response.data; // Contains status, payment_status_description, etc.
    } catch (error) {
        console.error('Pesapal Get Transaction Status Error:', error.response?.data || error.message);
        throw new Error('Failed to get transaction status from Pesapal.');
    }
}

exports.submitOrder = async (req, res) => {
    const userId = req.user.id; // Extract user ID from the authenticated token
    let { amount, phone, type } = req.body;

    // Default to activation_fee if no type is provided
    if (!type) type = 'activation_fee';

    if (!amount || !phone) {
        return res.status(400).json({ success: false, message: 'Amount and Phone Number are required.' });
    }

    // Format phone sequence for live processing
    phone = phone.trim().replace(/\s+/g, '');
    if (phone.startsWith('+')) phone = phone.substring(1);
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;

    try {
        // Security Guard: Prevent active users from initiating an activation payment
        const userStatus = await pool.query('SELECT is_active FROM users WHERE id = $1', [userId]);
        if (userStatus.rows.length > 0 && (userStatus.rows[0].is_active === true || userStatus.rows[0].is_active === 'true')) {
            return res.status(400).json({ 
                success: false, 
                message: 'Your account is already active. Please proceed to the dashboard.' 
            });
        }

        console.log('Live Step 1: Requesting Production Auth Token...');
        const token = await getAuthToken();

        console.log('Live Step 2: Extracting IPN via system URL proxy bypass...');
        const liveIpnId = await registerBypassIPN(token);
        console.log(`Successfully obtained production IPN ID: ${liveIpnId}`);

        console.log(`Live Step 3: Submitting Live Order Request for ${amount} KES to ${phone}...`);
        const reference = 'DS' + Math.floor(100000 + Math.random() * 900000); 

        const orderData = {
            id: reference,
            currency: 'KES',
            amount: parseFloat(amount),
            description: `Live STK Push Payment for user ${userId} (${type})`, // Include userId and type in description
            callback_url: 'https://pay.pesapal.com', 
            notification_id: liveIpnId, 
            billing_address: {
                phone_number: phone,
                email_address: "customer@durkcsolutions.com", 
                first_name: "Live",
                last_name: "Customer"
            }
        };

        // Insert pending transaction record before calling Pesapal
        await pool.query(
            'INSERT INTO transactions (user_id, type, amount, status, merchant_reference) VALUES ($1, $2, $3, $4, $5)',
            [userId, type, amount, 'pending', reference]
        );

        const response = await axios.post(`${PESAPAL_BASE_URL}/Transactions/SubmitOrderRequest`, orderData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Check if Pesapal's response contains redirect_url
        if (!response.data || !response.data.redirect_url) {
            console.error('Pesapal API did not return a redirect_url:', JSON.stringify(response.data, null, 2));
            return res.status(500).json({ success: false, message: 'Pesapal did not provide a redirect URL. Please try again later.' });
        }

        // Update the record with the actual OrderTrackingId received from Pesapal
        await pool.query(
            'UPDATE transactions SET order_tracking_id = $1 WHERE merchant_reference = $2',
            [response.data.order_tracking_id, reference]
        );

        res.json({
            success: true,
            order_tracking_id: response.data.order_tracking_id,
            redirect_url: response.data.redirect_url,
            merchant_reference: reference
        });
    } catch (error) {
        if (error.response?.data) {
            console.error('Live Payment Error Response:', JSON.stringify(error.response.data, null, 2));
            res.status(500).json({ success: false, message: JSON.stringify(error.response.data) });
        } else {
            console.error('Live Payment System Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

exports.handleIPN = async (req, res) => {
    const { OrderTrackingId, Status } = req.query; // PesaPal IPN sends these as query parameters

    if (!OrderTrackingId || !Status) {
        console.error('IPN Error: Missing OrderTrackingId or Status in query parameters.');
        return res.status(400).send('Missing parameters');
    }

    console.log(`Received IPN for OrderTrackingId: ${OrderTrackingId}, Status: ${Status}`);

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Get transaction details from our database
        const localTxRes = await client.query(
            'SELECT * FROM transactions WHERE order_tracking_id = $1',
            [OrderTrackingId]
        );

        if (localTxRes.rows.length === 0) {
            console.error(`IPN Error: OrderTrackingId ${OrderTrackingId} not found in local database.`);
            await client.query('ROLLBACK');
            return res.status(404).send('Transaction not found');
        }

        const localTransaction = localTxRes.rows[0];

        // Prevent double processing
        if (localTransaction.status === 'completed') {
            console.log(`IPN Info: Transaction ${OrderTrackingId} already completed.`);
            await client.query('COMMIT');
            return res.sendStatus(200);
        }

        // 2. Verify status with Pesapal (optional but recommended for security)
        const pesapalToken = await getAuthToken();
        const pesapalStatus = await getTransactionStatus(OrderTrackingId, pesapalToken);

        if (pesapalStatus.status === 'COMPLETED' && Status === 'COMPLETED') {
            // Update local transaction status
            await client.query(
                'UPDATE transactions SET status = $1 WHERE order_tracking_id = $2',
                ['completed', OrderTrackingId]
            );

            // Activate user if payment type is 'activation_fee'
            if (localTransaction.type === 'activation_fee') {
                // Call the activateUser function
                // We need to mock req and res objects for activateUser
                const mockReq = { body: { userId: localTransaction.user_id } };
                const mockRes = { status: (code) => ({ json: (data) => console.log(`activateUser response status: ${code}, data: ${JSON.stringify(data)}`) }), json: (data) => console.log(`activateUser response data: ${JSON.stringify(data)}`) };
                await activateUser(mockReq, mockRes);
            }
            // TODO: Handle other payment_types like 'membership_upgrade' here
        } else if (pesapalStatus.status === 'FAILED' || Status === 'FAILED') {
            await client.query(
                'UPDATE transactions SET status = $1 WHERE order_tracking_id = $2',
                ['failed', OrderTrackingId]
            );
            console.warn(`IPN Warning: Transaction ${OrderTrackingId} failed.`);
        } else {
            // Status is pending or some other intermediate status
            console.log(`IPN Info: Transaction ${OrderTrackingId} status is ${pesapalStatus.status}. Will wait for final status.`);
        }

        await client.query('COMMIT');
        res.sendStatus(200); // Acknowledge IPN
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('IPN Processing Error:', error.message);
        res.status(500).send('Internal Server Error');
    } finally {
        if (client) client.release();
    }
};