const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 8000;
const NODE_SERVER_URL = `http://127.0.0.1:${PORT}`;

if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing!');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);

// Premium Animated Custom Emoji Helper Function
const emoji = (id, symbol = "⚡") => `<tg-emoji emoji-id="${id}">${symbol}</tg-emoji>`;

// ==========================================
// 🛠️ GITHUB DETAILS CONFIGURATION
// ==========================================
const GITHUB_OWNER = "Aadhixd777";
const GITHUB_REPO = "ZORO-MD";

// Store verified users temporarily in memory
const verifiedUsers = new Map();

// Function to check GitHub Star via API
async function checkGitHubStar(username) {
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/stargazers/${username}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Node.js-Telegram-Bot' }
        });
        if (response.status === 204) {
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

// Command: /start
bot.start((ctx) => {
    const welcomeText = 
        `${emoji("5233354831984353090", "📱")} <b>ZORO MD WHATSAPP PAIRCODE GENERATOR</b> ${emoji("5251733667058840414", "✔️")}\n\n` +
        `Welcome to Aadhixd ${emoji("5233354831984353090", "📱")} WhatsApp Paircode Generator!\n\n` +
        `${emoji("5346181118884331907", "⚠️")} <b>Step 1: Verify GitHub Star</b>\n` +
        `Before pairing, you must Star our repository:\n` +
        `👉 <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}">https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}</a>\n\n` +
        `${emoji("5251671733630431622", "⚠️")} <b>Step 2: Send your GitHub Username:</b>\n` +
        `<code>/verify your_github_username</code>\n\n` +
        `Powered by Aadhixd System ${emoji("5251386049585768540", "✔")}\n\n` +
        `${emoji("5364310996179503764", "📸")} Developer Support\n` +
        `Official Telegram ${emoji("5251733667058840414", "✔️")}`;

    ctx.replyWithHTML(welcomeText, {
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
            [Markup.button.url("Star & Fork Repository", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)],
            [Markup.button.url("Developer Support", "https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==")],
            [Markup.button.url("Official Telegram", "https://t.me/Aadhixdofc")]
        ])
    });
});

// Command: /verify <github_username>
bot.command('verify', async (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        return ctx.replyWithHTML(`⚠️ Please provide your GitHub username!\n\nUsage: <code>/verify your_github_username</code>`);
    }

    const githubUsername = args[1].trim();
    const waitMsg = await ctx.reply(`🔍 Checking GitHub status for <b>${githubUsername}</b>... Please wait.`, { parse_mode: 'HTML' });

    const isStarred = await checkGitHubStar(githubUsername);

    if (isStarred) {
        verifiedUsers.set(ctx.from.id, githubUsername);

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            null,
            `${emoji("5251685816828194329", "✅")} <b>Verification Successful!</b>\n\n` +
            `Thank you for starring <code>${GITHUB_REPO}</code>! Your pairing section is now active ${emoji("5251733667058840414", "✔️")}.\n\n` +
            `${emoji("4969971262546772590", "📲")} Now you can generate your WhatsApp pairing code using:\n` +
            `<code>/pair your_phone_number</code>\n\n` +
            `Example: <code>/pair 918136880986</code>`,
            { parse_mode: 'HTML' }
        );
    } else {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            null,
            `❌ <b>Verification Failed!</b>\n\n` +
            `We couldn't find a star from <b>${githubUsername}</b> on <code>${GITHUB_OWNER}/${GITHUB_REPO}</code>.\n\n` +
            `Please Star the repository first and try again by sending:\n` +
            `<code>/verify ${githubUsername}</code>`,
            { 
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.url("⭐ Star Repository Now", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)]
                ])
            }
        );
    }
});

// Command: /pair <number>
bot.command('pair', async (ctx) => {
    if (!verifiedUsers.has(ctx.from.id)) {
        return ctx.replyWithHTML(
            `⚠️ <b>Access Denied!</b>\n\n` +
            `You haven't verified your GitHub star yet. You must star our repository to unlock the pairing section.\n\n` +
            `<b>How to unlock:</b>\n` +
            `1. Star our repo: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}\n` +
            `2. Send your GitHub username: <code>/verify your_github_username</code>`,
            Markup.inlineKeyboard([
                [Markup.button.url("Star Repository", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)]
            ])
        );
    }

    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        const warnText = `⚠️ Please provide your phone number!\nUsage: <code>/pair 918136880986</code>`;
        return ctx.replyWithHTML(warnText);
    }

    const phoneNumber = args[1].replace(/[^0-9]/g, '');
    const statusMsg = await ctx.reply("Generating Pairing Code... Please wait...");

    try {
        const response = await axios.post(`${NODE_SERVER_URL}/pair`, { phone: phoneNumber }, { timeout: 30000 });
        const data = response.data;

        if (data && data.status) {
            const rawCode = data.code;
            const cleanCode = rawCode.replace(/-/g, '');

            const successText = 
                `${emoji("5233354831984353090", "📱")} <b>AADHIXD PAIRCODE GENERATED</b>\n\n` +
                `YOUR CODE: <code>${rawCode}</code>\n\n` +
                `Steps to link:\n` +
                `1. Open ${emoji("5233354831984353090", "📱")} WhatsApp > Settings > Linked Devices.\n` +
                `2. Tap Link a Device > Link with phone number.\n` +
                `3. Enter the pairing code above.\n\n` +
                `Bot will auto activate after verification!\n\n` +
                `${emoji("5364310996179503764", "📸")} Developer Support`;

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                successText,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.switchToCurrentChat(`📋 Pair Code: ${rawCode}`, cleanCode)],
                        [Markup.button.url("Developer Support", "https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==")]
                    ])
                }
            );
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Error: ${data.error || 'Failed to get code'}`);
        }
    } catch (err) {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Server Error: ${err.message}`);
    }
});

bot.launch().then(() => {
    console.log("🤖 Telegram Pairing Bot started successfully...");
}).catch((err) => {
    console.error("❌ Telegraf Bot Launch Error:", err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
