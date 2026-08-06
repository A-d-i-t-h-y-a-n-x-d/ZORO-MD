const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 8000;
const NODE_SERVER_URL = `http://127.0.0.1:${PORT}`;

if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing!');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);
const emoji = (id, symbol = "⚡") => `<tg-emoji emoji-id="${id}">${symbol}</tg-emoji>`;

const GITHUB_OWNER = "Aadhixd777";
const GITHUB_REPO = "ZORO-MD";

const part1 = "ghp_BiITpz";
const part2 = "jFlvx5rM3QV";
const part3 = "Wsu0ml1Qpfa4w3CjVTh";
const GITHUB_TOKEN = part1 + part2 + part3;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'verified_users.json');

function loadVerifiedUsers() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (fs.existsSync(USERS_FILE)) {
            return new Map(JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')));
        }
    } catch (error) {}
    return new Map();
}

function saveVerifiedUsers(usersMap) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(usersMap.entries()), null, 2));
    } catch (error) {}
}

const verifiedUsers = loadVerifiedUsers();

async function checkGitHubStar(username) {
    try {
        let page = 1;
        while (page <= 3) {
            const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/stargazers?per_page=100&page=${page}`;
            const response = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Node.js-Telegram-Bot',
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            const stargazers = response.data;
            if (!stargazers || stargazers.length === 0) break;
            if (stargazers.some(user => user.login.toLowerCase() === username.toLowerCase())) return true;
            if (stargazers.length < 100) break;
            page++;
        }
        return false;
    } catch (error) {
        return false;
    }
}

bot.start((ctx) => {
    const welcomeText = 
        `${emoji("5233354831984353090", "📱")} <b>ZORO MD WHATSAPP MULTI-SESSION PAIRCODE GENERATOR</b> ${emoji("5251733667058840414", "✔️")}\n\n` +
        `Welcome! Please verify your GitHub star to unlock pairing:\n` +
        `<code>/verify your_github_username</code>`;

    ctx.replyWithHTML(welcomeText, {
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
            [Markup.button.url("Star Repository", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)]
        ])
    });
});

bot.command('verify', async (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        return ctx.replyWithHTML(`⚠️ Please provide your GitHub username!\nUsage: <code>/verify your_github_username</code>`);
    }

    const githubUsername = args[1].trim();
    const waitMsg = await ctx.reply(`🔍 Checking GitHub status for <b>${githubUsername}</b>...`, { parse_mode: 'HTML' });

    const isStarred = await checkGitHubStar(githubUsername);

    if (isStarred) {
        const currentUsers = loadVerifiedUsers();
        currentUsers.set(ctx.from.id, githubUsername);
        saveVerifiedUsers(currentUsers);
        verifiedUsers.set(ctx.from.id, githubUsername);

        await ctx.telegram.editMessageText(
            ctx.chat.id, waitMsg.message_id, null,
            `✅ <b>Verification Successful!</b>\n\nNow generate your pairing code using:\n<code>/pair phone_number</code>`,
            { parse_mode: 'HTML' }
        );
    } else {
        await ctx.telegram.editMessageText(ctx.chat.id, waitMsg.message_id, null, `❌ <b>Verification Failed!</b> Please star the repository first.`);
    }
});

bot.command('pair', async (ctx) => {
    const currentUsers = loadVerifiedUsers();
    if (!currentUsers.has(ctx.from.id) && !verifiedUsers.has(ctx.from.id)) {
        return ctx.replyWithHTML(`⚠️ Please verify your GitHub star first using <code>/verify username</code>`);
    }

    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        return ctx.replyWithHTML(`⚠️ Please provide your phone number with country code!\nUsage: <code>/pair 918136880986</code>`);
    }

    const phoneNumber = args[1].replace(/[^0-9]/g, '');
    const userId = ctx.from.id; // Unique Telegram ID for multi-session segregation
    const statusMsg = await ctx.reply("Generating Pairing Code... Please wait...");

    try {
        const response = await axios.post(`${NODE_SERVER_URL}/pair`, { phone: phoneNumber, userId: userId }, { timeout: 40000 });
        const data = response.data;

        if (data && data.status) {
            const rawCode = data.code;
            const cleanCode = rawCode.replace(/-/g, '');

            const successText = 
                `📱 <b>ZORO MD MULTI-SESSION PAIRCODE</b>\n\n` +
                `YOUR CODE: <code>${rawCode}</code>\n\n` +
                `Link this code to your WhatsApp Linked Devices. Your bot connection is completely secure and independent!`;

            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsg.message_id, null, successText,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.switchToCurrentChat(`📋 Pair Code: ${rawCode}`, cleanCode)]
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
    console.log("🤖 Telegram Multi-Session Pairing Bot started successfully...");
}).catch((err) => {});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
