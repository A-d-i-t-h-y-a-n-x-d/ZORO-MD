const { Telegraf, Markup } = require('telegraf');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers
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
const activeSockets = new Map();

// Helper: Clean up existing user socket & session files
const cleanupUserSession = (chatId) => {
    if (activeSockets.has(chatId)) {
        try {
            const socket = activeSockets.get(chatId);
            socket.ev.removeAllListeners();
            socket.end(undefined);
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

    const waitMsg = await ctx.reply(`⏳ Initializing fast connection...\n📱 Phone Number: ${phoneNumber}\n⏳ Generating Pairing Code...`);

    try {
        const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
        if (!fs.existsSync(userSessionDir)) {
            fs.mkdirSync(userSessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
        const { version } = await fetchLatestBaileysVersion();

        // 🚀 INSTANT PAIRING OPTIMIZED WASOCKET CONFIGURATION
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'), // Fast handshake profile
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false, // Saves time by skipping old chat history sync
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: false
        });

        activeSockets.set(chatId, sock);

        sock.ev.on('creds.update', async () => {
            await saveCreds();
        });

        let codeRequested = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            // Generate Pairing Code
            if (!state.creds.registered && !codeRequested) {
                codeRequested = true;

                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(phoneNumber);
                        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                        try { 
                            await ctx.telegram.deleteMessage(chatId, waitMsg.message_id); 
                        } catch (e) {}

                        // Base Text Template (For Message Entities)
                        const rawText = 
                            `┏━━ 💬 WHATSAPP LINKING 🇮🇳 🟢 ━━┓\n\n` +
                            `│ 📱 Phone Number: ${phoneNumber} ☑️\n` +
                            `│ ⚙️ Settings: Configured\n` +
                            `│ 🔑 Pairing Code: ${formattedCode}\n\n` +
                            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                            `📌 Instructions: ✨\n` +
                            `1️⃣ Open WhatsApp on your phone\n` +
                            `2️⃣ Go to Settings > Linked Devices\n` +
                            `3️⃣ Tap Link a Device -> Link with phone number instead\n` +
                            `4️⃣ Enter the code above to connect!`;

                        // 💎 Premium Custom Emoji Mapping via Telegram Entities API
                        const customEntities = [
                            { offset: 4, length: 2, type: 'custom_emoji', custom_emoji_id: '5334998226636390258' },
                            { offset: 25, length: 2, type: 'custom_emoji', custom_emoji_id: '5936253382757979660' },
                            { offset: 38, length: 2, type: 'custom_emoji', custom_emoji_id: '5935864147051811401' },
                            { offset: 53 + phoneNumber.length, length: 2, type: 'custom_emoji', custom_emoji_id: '5436053316715424756' },
                            { offset: 58 + phoneNumber.length, length: 2, type: 'custom_emoji', custom_emoji_id: '6220014823963363136' },
                            { offset: 83 + phoneNumber.length, length: 2, type: 'custom_emoji', custom_emoji_id: '5251386049585768540' },
                            { offset: 161 + phoneNumber.length + formattedCode.length, length: 2, type: 'custom_emoji', custom_emoji_id: '6296218646284863141' }
                        ];

                        const cleanCode = String(formattedCode).replace(/[^a-zA-Z0-9]/g, '');

                        // Send Message with Premium Emojis (No Document Error!)
                        await ctx.telegram.sendMessage(chatId, rawText, {
                            entities: customEntities,
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
                        await ctx.reply(`❌ Error generating pairing code. Please try again.`);
                    }
                }, 1000);
            }

            // ⚡ Instant Connection Success Handling
            if (connection === 'open') {
                try {
                    const mainSessionDir = path.join(__dirname, 'session');
                    if (!fs.existsSync(mainSessionDir)) {
                        fs.mkdirSync(mainSessionDir, { recursive: true });
                    }
                    fs.cpSync(userSessionDir, mainSessionDir, { recursive: true, force: true });
                    console.log(`✅ Session saved instantly for user ${chatId}`);
                } catch (cpErr) {
                    console.error('❌ Failed to copy session:', cpErr);
                }

                await ctx.reply(`🎉 CONNECTED SUCCESSFULLY!\n\nYour WhatsApp has been successfully linked!`);
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
    console.log('🤖 Fast Linker Telegram Bot started successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
