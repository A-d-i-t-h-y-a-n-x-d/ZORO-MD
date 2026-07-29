const { Telegraf, Markup } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN is missing in environment variables');
    return;
}

const bot = new Telegraf(BOT_TOKEN);

// Start command
bot.start((ctx) => {
    ctx.reply(
        `✨ <b>WELCOME TO AADHI-XD LINKER</b> ✨\n\n` +
        `Link your WhatsApp account securely with our advanced bot.\n\n` +
        `👉 <b>Please send your WhatsApp number with country code</b> (e.g., <code>918136880986</code>) to generate your pairing code.`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`🚀 GET PAIRING CODE`, 'get_started')],
                [Markup.button.url(`🌐 DEVELOPER / SUPPORT`, 'https://t.me/Aadhixdofc')]
            ])
        }
    );
});

bot.action('get_started', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(`📱 <b>Please type and send your WhatsApp number now with country code:</b>`, { parse_mode: 'HTML' });
});

// Handling Number and Pairing Code Generation
bot.on('text', async (ctx) => {
    let text = ctx.text.trim();
    if (text.startsWith('/')) return;

    let phoneNumber = text.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.reply(`❌ <b>Invalid phone number!</b> Please send a valid WhatsApp number with country code (e.g., <code>918714387286</code>).`, { parse_mode: 'HTML' });
    }

    const waitMsg = await ctx.reply(`⏳ <b>⚙️ Settings:</b> Initializing Baileys Socket...\n📱 <b>Phone Number:</b> <code>${phoneNumber}</code>\n⏳ Generating Pairing Code... Please wait.`, { parse_mode: 'HTML' });

    try {
        const sessionDir = path.join(__dirname, 'session');
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
            }
        });

        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    // Original pairing code generated in the background for WhatsApp linking
                    let realPairingCode = await sock.requestPairingCode(phoneNumber);
                    
                    // Custom display code with 'AADHI-' prefix for viewers
                    let cleanCode = realPairingCode ? realPairingCode.replace(/[^0-9A-Z]/gi, '') : '12345678';
                    let lastChars = cleanCode.slice(-4);
                    let customDisplayCode = `AADHI-${lastChars}`;
                    
                    try { await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id); } catch(e) {}

                    await ctx.reply(
                        `┏━━ 💬 <b>WHATSAPP LINKING</b> 🇮🇳 🟢 ━━┓\n\n` +
                        `│ 📱 <b>Phone Number:</b> <code>${phoneNumber}</code>\n` +
                        `│ ⚙️ <b>Settings:</b> Configured\n` +
                        `│ 🔑 <b>Pairing Code:</b> <code>${customDisplayCode}</code>\n\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `📌 <b>Instructions:</b>\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Go to <b>Settings > Linked Devices</b>\n` +
                        `3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n` +
                        `4️⃣ Enter the code above to connect!`,
                        {
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback(`📋 Copy Code: ${customDisplayCode}`, `copy_${realPairingCode}`)],
                                [Markup.button.callback('🔄 Change Number', 'get_started')]
                            ])
                        }
                    );
                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    ctx.reply(`❌ <b>Error generating pairing code. Please try again with a valid number.</b>`, { parse_mode: 'HTML' });
                }
            }, 3000);
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') {
                ctx.reply(`🎉 <b>☑️ CONNECTED SUCCESSFULLY!</b>\nYour WhatsApp has been successfully linked with the bot! ☑️`, { parse_mode: 'HTML' });
            }
        });

    } catch (err) {
        console.error('An unexpected error occurred.', err);
        ctx.reply(`❌ <b>An unexpected error occurred.</b>`, { parse_mode: 'HTML' });
    }
});

// Copy button handler that supplies the original linking code
bot.action(/^copy_(.+)$/, async (ctx) => {
    let actualCode = ctx.match[1];
    await ctx.answerCbQuery(`📋 Original Code Copied: ${actualCode}\n(Use this code in WhatsApp to link!)`, { show_alert: true });
});

bot.launch();
console.log('🤖 AADHI-XD Linker Bot started successfully with verification tick!');
