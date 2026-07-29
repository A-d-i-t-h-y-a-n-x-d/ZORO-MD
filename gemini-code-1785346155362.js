const { Telegraf, Markup } = require('telegraf');
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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in environment variables');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Store active sockets per user
const activeSockets = new Map();

// Helper: Custom Emoji Generator Function (DOCUMENT_INVALID എറർ വരാതിരിക്കാൻ)
const buildCustomEmojiText = (emojiId, fallbackChar) => {
    return {
        text: fallbackChar,
        entity: {
            offset: 0,
            length: fallbackChar.length,
            type: 'custom_emoji',
            custom_emoji_id: emojiId
        }
    };
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

bot.start((ctx) => {
    ctx.reply(
        `✨ WELCOME TO AADHI-XD LINKER ✨\n\n` +
        `Link your WhatsApp account securely with our advanced bot.\n\n` +
        `👉 Please send your WhatsApp number with country code (e.g., 918136880986) to generate your pairing code.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🚀 GET PAIRING CODE', 'get_started')],
            [Markup.button.url('🌐 DEVELOPER / SUPPORT', 'https://t.me/Aadhixdofc')]
        ])
    );
});

bot.action('get_started', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(`📱 Please type and send your WhatsApp number now with country code:`);
});

bot.on('text', async (ctx) => {
    const text = ctx.text.trim();
    if (text.startsWith('/')) return;

    const phoneNumber = text.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.reply(`❌ Invalid phone number! Please send a valid WhatsApp number with country code.`);
    }

    const chatId = ctx.chat.id;
    cleanupUserSession(chatId);

    const waitMsg = await ctx.reply(`⏳ Settings: Initializing Baileys Socket...\n📱 Phone Number: ${phoneNumber}\n⏳ Generating Pairing Code... Please wait.`);

    try {
        const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
        if (!fs.existsSync(userSessionDir)) {
            fs.mkdirSync(userSessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Mac OS", "Chrome", "121.0.6167.85"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        activeSockets.set(chatId, sock);
        sock.ev.on('creds.update', saveCreds);

        let codeRequested = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (!state.creds.registered && !codeRequested) {
                codeRequested = true;

                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(phoneNumber);
                        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                        try { 
                            await ctx.telegram.deleteMessage(chatId, waitMsg.message_id); 
                        } catch (e) {}

                        // Safe HTML Formatting for Custom Emojis without Telegram 400 Bad Request
                        const finalMessage = 
                            `┏━━ <tg-emoji emoji-id="5334998226636390258">💬</tg-emoji> <b>WHATSAPP LINKING</b> 🇮🇳 <tg-emoji emoji-id="5936253382757979660">🟢</tg-emoji> ━━┓\n\n` +
                            `│ <tg-emoji emoji-id="5935864147051811401">📱</tg-emoji> <b>Phone Number:</b> <code>${phoneNumber}</code> <tg-emoji emoji-id="5436053316715424756">☑️</tg-emoji>\n` +
                            `│ <tg-emoji emoji-id="6220014823963363136">⚙️</tg-emoji> <b>Settings:</b> Configured\n` +
                            `│ <tg-emoji emoji-id="5251386049585768540">🔑</tg-emoji> <b>Pairing Code:</b> <code>${formattedCode}</code>\n\n` +
                            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                            `📌 <b>Instructions:</b> <tg-emoji emoji-id="6296218646284863141">✨</tg-emoji>\n` +
                            `1️⃣ Open WhatsApp on your phone\n` +
                            `2️⃣ Go to <b>Settings > Linked Devices</b>\n` +
                            `3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n` +
                            `4️⃣ Enter the code above to connect!`;

                        const cleanCode = String(formattedCode).replace(/[^a-zA-Z0-9]/g, '');

                        // Extra fallback parameter in extra object to bypass invalid document error
                        await ctx.telegram.sendMessage(chatId, finalMessage, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: `📋 Copy Code: ${formattedCode}`, callback_data: `copy_${cleanCode}` }],
                                    [{ text: '🔄 Change Number', callback_data: 'get_started' }]
                                ]
                            }
                        });

                    } catch (err) {
                        console.error('Error generating pairing code:', err);
                        cleanupUserSession(chatId);
                        await ctx.reply(`❌ Error generating pairing code. Please try again with a valid number.`);
                    }
                }, 3000);
            }

            if (connection === 'open') {
                try {
                    const mainSessionDir = path.join(__dirname, 'session');
                    if (!fs.existsSync(mainSessionDir)) {
                        fs.mkdirSync(mainSessionDir, { recursive: true });
                    }
                    fs.cpSync(userSessionDir, mainSessionDir, { recursive: true, force: true });
                    console.log(`✅ Session copied to main ./session folder for user ${chatId}`);
                } catch (cpErr) {
                    console.error('❌ Failed to copy session to main folder:', cpErr);
                }

                await ctx.reply(`🎉 CONNECTED SUCCESSFULLY! Your WhatsApp has been successfully linked!`);
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    cleanupUserSession(chatId);
                }
            }
        });

    } catch (err) {
        console.error('An unexpected error occurred:', err);
        cleanupUserSession(chatId);
        await ctx.reply(`❌ An unexpected error occurred.`);
    }
});

bot.action(/^copy_(.+)$/, async (ctx) => {
    const actualCode = ctx.match[1];
    await ctx.answerCbQuery(`📋 Code: ${actualCode}`, { show_alert: true });
});

bot.launch().then(() => {
    console.log('🤖 AADHI-XD Linker Telegram Module started successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));