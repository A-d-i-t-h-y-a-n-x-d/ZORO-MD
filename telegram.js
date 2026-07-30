const { Telegraf, Markup } = require('telegraf');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env!');
    process.exit(1);
}

const bot = new Telegraf(botToken);
const activeSockets = new Map();

const cleanupUserSession = (chatId) => {
    if (activeSockets.has(chatId)) {
        try {
            activeSockets.get(chatId).end(undefined);
        } catch (e) {}
        activeSockets.delete(chatId);
    }

    const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
    if (fs.existsSync(userSessionDir)) {
        try {
            fs.rmSync(userSessionDir, { recursive: true, force: true });
        } catch (e) {}
    }
};

// Advanced Premium Emoji Helper using Direct Telegram Entities (No DOCUMENT_INVALID errors)
bot.start(async (ctx) => {
    try {
        const text = "✈️ ☑️ WELCOME TO AADHI-XD LINKER\n\n" +
                     "Link your WhatsApp account securely with our bot.\n\n" +
                     "👉 Please send your WhatsApp number with country code (e.g., 918136880986) to generate your pairing code.";

        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            entities: [
                { offset: 0, length: 2, type: 'custom_emoji', custom_emoji_id: '5361809444901000291' }, // TG Logo
                { offset: 3, length: 2, type: 'custom_emoji', custom_emoji_id: '5436053316715424756' }, // Blue Tick
                { offset: 6, length: 26, type: 'bold' },
                { offset: 120, length: 12, type: 'code' }
            ],
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🚀 GET PAIRING CODE', 'get_started')],
                [Markup.button.url('🌐 DEVELOPER / SUPPORT', 'https://t.me/Aadhixdofc')]
            ])
        });
    } catch (err) {
        console.error('Error in /start:', err.message);
    }
});

bot.action('get_started', async (ctx) => {
    try {
        await ctx.answerCbQuery('Starting process...');
        const text = "🟢 Please type and send your WhatsApp number now with country code:";
        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            entities: [
                { offset: 0, length: 2, type: 'custom_emoji', custom_emoji_id: '5465432023062868212' },
                { offset: 3, length: text.length - 3, type: 'bold' }
            ]
        });
    } catch (err) {
        console.error('Error in get_started:', err.message);
    }
});

bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text.trim();
        const chatId = ctx.chat.id;

        if (text.startsWith('/')) return;

        const phoneNumber = text.replace(/[^0-9]/g, '');
        if (phoneNumber.length < 10) {
            return ctx.reply("❌ Invalid phone number! Please send a valid WhatsApp number with country code.");
        }

        cleanupUserSession(chatId);

        const waitMsg = await ctx.reply(`⏳ Initializing Socket...\n🟢 Phone Number: ${phoneNumber}\n⏳ Generating Pairing Code... Please wait.`, { parse_mode: 'HTML' });

        const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
        if (!fs.existsSync(userSessionDir)) {
            fs.mkdirSync(userSessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
        const { version } = await fetchLatestBaileysVersion();

        // Ultra-fast connection & instant session code generation
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'fatal' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
            },
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            fireInitQueries: false, 
            downloadHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            shouldSyncHistoryMessage: () => false
        });

        activeSockets.set(chatId, sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                try {
                    console.log(`✅ Session instantly linked for user ${chatId}`);

                    const mainSessionDir = path.join(__dirname, 'session');
                    if (!fs.existsSync(mainSessionDir)) {
                        fs.mkdirSync(mainSessionDir, { recursive: true });
                    }
                    fs.cpSync(userSessionDir, mainSessionDir, { recursive: true, force: true });

                    const successText = "🎉 PAIRING SUCCESSFUL! 🟢\n\n" +
                                        "Your WhatsApp has been instantly linked and connected to the bot! ☑️";

                    await ctx.telegram.sendMessage(chatId, successText, {
                        entities: [
                            { offset: 0, length: 23, type: 'bold' },
                            { offset: 83, length: 2, type: 'custom_emoji', custom_emoji_id: '5436053316715424756' }
                        ]
                    });

                } catch (cpErr) {
                    console.error('❌ Failed to save session:', cpErr);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== 401) {
                    console.log(`Connection closed for ${chatId}, cleaning up...`);
                }
            }
        });

        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                    try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

                    const textMessage = 
                        `┏━━ 🟢 AADHI XD LINKING ━━┓\n\n` +
                        `│ 📱 Phone Number: ${phoneNumber}\n` +
                        `│ ⚙️ Settings: Configured\n` +
                        `│ 🔑 Pairing Code: ${formattedCode}\n\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `📌 Instructions: ✨\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Go to Settings > Linked Devices\n` +
                        `3️⃣ Tap Link a Device -> Link with phone number instead\n` +
                        `4️⃣ Enter the code above to connect!`;

                    const cleanCode = String(formattedCode).replace(/[^a-zA-Z0-9]/g, '');

                    await ctx.telegram.sendMessage(chatId, textMessage, {
                        entities: [
                            { offset: 4, length: 2, type: 'custom_emoji', custom_emoji_id: '5465432023062868212' },
                            { offset: 7, length: 16, type: 'bold' }
                        ],
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(`📋 Copy Code: ${formattedCode}`, `copy_${cleanCode}`)],
                            [Markup.button.callback('🔄 Change Number', 'get_started')]
                        ])
                    });

                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    cleanupUserSession(chatId);
                    await ctx.reply("❌ Failed to get pairing code. Please try again.");
                }
            }, 1500);
        }

    } catch (err) {
        console.error('An unexpected error occurred:', err);
        cleanupUserSession(chatId);
        await ctx.reply("❌ An unexpected error occurred.");
    }
});

bot.action(/^copy_(.+)$/, async (ctx) => {
    try {
        const code = ctx.match[1];
        await ctx.answerCbQuery(`📋 Code: ${code}`, { show_alert: true });
    } catch (e) {}
});

// Global Safety Catch
bot.catch((err, ctx) => {
    console.error(`Unhandled error for ${ctx.updateType}:`, err.message);
});

bot.launch().then(() => {
    console.log('🤖 Telegram Bot API Module started successfully!');
}).catch((err) => {
    console.error('❌ Failed to launch Telegram Bot:', err.message);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
