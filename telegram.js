const { Telegraf } = require('telegraf');
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

bot.start((ctx) => {
    ctx.reply(`_Welcome to AADHI-XD WhatsApp Linker Bot!_\n\nPlease send your WhatsApp number with country code (e.g., \`918714387286\`) to generate your custom pairing code.`);
});

bot.on('text', async (ctx) => {
    let phoneNumber = ctx.text.trim().replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.reply(`*Invalid number! Please send a valid WhatsApp number (e.g., 918136880986).`);
    }
    ctx.reply(`⏳ Generating Aadi-Xd Pairing Code for *` + (phoneNumber) + `*... Please wait.`);
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

        if (!sock.creds.registered) {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    let formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                    let last4 = formattedCode.slice(-4);
                    let finalCode = 'AAD1-' + (last4);
                    
                    await ctx.reply(`*AADHI-XD OFFICIAL LINKING SYSTEM*\n*YOUR PAIRING CODE:\n\`\`\`\`\`${finalCode}\`\`\`\`\`\n*Instructions:\n1. Open WhatsApp on your phone\n2. Go to Settings > Linked Devices\n3. Tap Link a Device -> Link with phone number instead\n4. Enter code: \`\`\`\`\`${finalCode}\`\`\`\`\` to connect!`, { parse_mode: 'Markdown' });
                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    ctx.reply('*Error generating pairing code. Please try again.');
                }
            }, 3000);
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') {
                ctx.reply('*Success!* Your WhatsApp has been successfully linked to Aadi-Xd Bot!');
            }
        });

    } catch (err) {
        console.error('An unexpected error occurred.', err);
        ctx.reply('*An unexpected error occurred.');
    }
});

bot.launch();
console.log('Robot Linker Bot started successfully!');
