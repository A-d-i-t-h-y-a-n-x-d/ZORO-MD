const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const events = require("telegram/events");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION_STRING || "");

if (!apiId || !apiHash || !process.env.TELEGRAM_SESSION_STRING) {
    console.error('❌ TELEGRAM_API_ID, TELEGRAM_API_HASH, or TELEGRAM_SESSION_STRING is missing!');
    process.exit(1);
}

const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

// Fixed Target Chat ID
const TARGET_CHAT_ID = "-1003901583807";

// Store active sockets per user: chatId -> socket instance
const activeSockets = new Map();

// Custom Premium Emojis
const em = {
    waLink: '<tg-emoji emoji-id="5334998226636390258">💬</tg-emoji>',
    phone: '<tg-emoji emoji-id="5935864147051811401">📱</tg-emoji>',
    settings: '<tg-emoji emoji-id="6220014823963363136">⚙️</tg-emoji>',
    pairingSuccess: '<tg-emoji emoji-id="5251386049585768540">🔑</tg-emoji>',
    generalFeature: '<tg-emoji emoji-id="6296218646284863141">✨</tg-emoji>',
    errorFormat: '<tg-emoji emoji-id="5251437048027442994">❌</tg-emoji>',
    connected: '<tg-emoji emoji-id="5936253382757979660">🟢</tg-emoji>',
    blueTick: '<tg-emoji emoji-id="5436053316715424756">☑️</tg-emoji>',
    indiaFlag: '🇮🇳'
};

// Helper: Clean up existing user socket & session files
const cleanupUserSession = (chatId) => {
    if (activeSockets.has(chatId)) {
        try {
            activeSockets.get(chatId).end(undefined);
        } catch (e) {}
        activeSockets.delete(chatId);
    }

    const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
    if (fs.existsSync(userSessionDir)) {
        fs.rmSync(userSessionDir, { recursive: true, force: true });
    }
};

(async () => {
    await client.connect();
    console.log('🤖 GramJS Linker Module started successfully with User Session!');

    // Handle Start & Incoming Messages
    client.addEventHandler(async (event) => {
        const message = event.message;
        if (!message || !message.text) return;

        const chatId = TARGET_CHAT_ID;
        const text = message.text.trim();

        // Handle /start command
        if (text === '/start') {
            try {
                await client.sendMessage(chatId, {
                    message: `${em.generalFeature} <b>WELCOME TO AADHI-XD LINKER</b> ${em.generalFeature}\n\n` +
                             `Link your WhatsApp account securely with our advanced bot.\n\n` +
                             `👉 <b>Please send your WhatsApp number with country code</b> (e.g., <code>918136880986</code>) to generate your pairing code.`,
                    parseMode: 'html',
                    buttons: client.buildReplyMarkup([
                        [{ text: '🚀 GET PAIRING CODE', data: Buffer.from('get_started') }],
                        [{ text: '🌐 DEVELOPER / SUPPORT', url: 'https://t.me/Aadhixdofc' }]
                    ])
                });
            } catch (err) {
                console.error('Error sending start message:', err.message);
            }
            return;
        }

        // Handle Phone Number Input
        if (!text.startsWith('/')) {
            const phoneNumber = text.replace(/[^0-9]/g, '');
            if (phoneNumber.length < 10) {
                try {
                    await client.sendMessage(chatId, {
                        message: `${em.errorFormat} <b>Invalid phone number!</b> Please send a valid WhatsApp number with country code (e.g., <code>918714387286</code>).`,
                        parseMode: 'html'
                    });
                } catch (err) {
                    console.error('Error sending invalid number error:', err.message);
                }
                return;
            }

            const sessionKey = chatId;
            cleanupUserSession(sessionKey);

            let waitMsg;
            try {
                waitMsg = await client.sendMessage(chatId, {
                    message: `⏳ <b>Settings:</b> Initializing Baileys Socket...\n${em.phone} <b>Phone Number:</b> <code>${phoneNumber}</code>\n⏳ Generating Pairing Code... Please wait.`,
                    parseMode: 'html'
                });
            } catch (err) {
                console.error('Error sending wait message:', err.message);
                return;
            }

            try {
                const userSessionDir = path.join(__dirname, 'sessions', `user_${sessionKey}`);
                if (!fs.existsSync(userSessionDir)) {
                    fs.mkdirSync(userSessionDir, { recursive: true });
                }

                const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
                const { version } = await fetchLatestBaileysVersion();

                const sock = makeWASocket({
                    version,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false,
                    browser: ["Ubuntu", "Chrome", "20.0.04"],
                    auth: {
                        creds: state.creds,
                        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                    }
                });

                activeSockets.set(sessionKey, sock);

                sock.ev.on('creds.update', saveCreds);

                sock.ev.on('connection.update', async (update) => {
                    const { connection } = update;

                    if (connection === 'open') {
                        try {
                            const mainSessionDir = path.join(__dirname, 'session');
                            if (!fs.existsSync(mainSessionDir)) {
                                fs.mkdirSync(mainSessionDir, { recursive: true });
                            }
                            fs.cpSync(userSessionDir, mainSessionDir, { recursive: true, force: true });
                            console.log(`✅ Session copied to main ./session folder for user ${sessionKey}`);
                        } catch (cpErr) {
                            console.error('❌ Failed to copy session to main folder:', cpErr);
                        }

                        await client.sendMessage(chatId, {
                            message: `🎉 <b>${em.connected} CONNECTED SUCCESSFULLY!</b> ${em.blueTick}\n` +
                                     `Your WhatsApp has been successfully linked! Modules extracting & starting bot... ${em.blueTick}`,
                            parseMode: 'html'
                        });
                    }
                });

                if (!state.creds.registered) {
                    setTimeout(async () => {
                        try {
                            const code = await sock.requestPairingCode(phoneNumber);
                            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                            if (waitMsg) {
                                try { await waitMsg.delete({ revoke: true }); } catch (e) {}
                            }

                            const textMessage = 
                                `┏━━ ${em.waLink} <b>WHATSAPP LINKING</b> ${em.indiaFlag} ${em.connected} ━━┓\n\n` +
                                `│ ${em.phone} <b>Phone Number:</b> <code>${phoneNumber}</code> ${em.blueTick}\n` +
                                `│ ${em.settings} <b>Settings:</b> Configured\n` +
                                `│ ${em.pairingSuccess} <b>Pairing Code:</b> <code>${formattedCode}</code>\n\n` +
                                `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                                `📌 <b>Instructions:</b> ${em.generalFeature}\n` +
                                `1️⃣ Open WhatsApp on your phone\n` +
                                `2️⃣ Go to <b>Settings > Linked Devices</b>\n` +
                                `3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n` +
                                `4️⃣ Enter the code above to connect!`;

                            const cleanCode = String(formattedCode).replace(/[^a-zA-Z0-9]/g, '');

                            await client.sendMessage(chatId, {
                                message: textMessage,
                                parseMode: 'html',
                                buttons: client.buildReplyMarkup([
                                    [{ text: `📋 Copy Code: ${formattedCode}`, data: Buffer.from(`copy_${cleanCode}`) }],
                                    [{ text: '🔄 Change Number', data: Buffer.from('get_started') }]
                                ])
                            });

                        } catch (err) {
                            console.error('Error generating pairing code:', err);
                            cleanupUserSession(sessionKey);
                            await client.sendMessage(chatId, {
                                message: `${em.errorFormat} <b>Error generating pairing code. Please try again with a valid number.</b>`,
                                parseMode: 'html'
                            });
                        }
                    }, 3000);
                }

            } catch (err) {
                console.error('An unexpected error occurred:', err);
                cleanupUserSession(sessionKey);
                await client.sendMessage(chatId, {
                    message: `${em.errorFormat} <b>An unexpected error occurred.</b>`,
                    parseMode: 'html'
                });
            }
        }
    }, new events.NewMessage({}));

    // Handle Button Clicks (Callback Queries)
    client.addEventHandler(async (event) => {
        const query = event.query;
        if (!query) return;

        const data = query.data ? query.data.toString() : '';
        const chatId = TARGET_CHAT_ID;

        if (data === 'get_started') {
            await query.answer({ message: "Starting process..." });
            await client.sendMessage(chatId, {
                message: `${em.phone} <b>Please type and send your WhatsApp number now with country code:</b>`,
                parseMode: 'html'
            });
        } else if (data.startsWith('copy_')) {
            const actualCode = data.replace('copy_', '');
            await query.answer({ message: `📋 Code: ${actualCode}`, alert: true });
        }
    }, new events.Raw({ types: [Api.UpdateBotCallbackQuery, Api.UpdateInlineBotCallbackQuery] }));

})();
