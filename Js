Const cluster = require('cluster');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
require('dotenv').config();

// ============================================
// AUTO RESTART SYSTEM (MASTER PROCESS)
// ============================================
if (cluster.isPrimary || cluster.isMaster) {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║  🛡️ ZORO MD SYSTEM MONITOR ACTIVE    ║');
    console.log('╚════════════════════════════════════╝\n');
    console.log('✅ Auto-restart system is active...\n');
    
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.log(`\n⚠️ Bot process stopped (Code: ${code}). Restarting in 2 seconds...\n`);
        setTimeout(() => {
            cluster.fork();
        }, 2000);
    });

} else {
    // ============================================
    // MODULE UPDATER - RUNS ONLY ON FIRST START
    // ============================================
    async function downloadAndExtractModules() {
        const settingsPath = path.join(__dirname, 'settings.js');
        const modulesInstalledFlag = path.join(__dirname, '.modules_installed');
        
        if (fs.existsSync(modulesInstalledFlag)) {
            console.log('✅ Modules already installed, skipping download');
            return true;
        }
        
        if (!fs.existsSync(settingsPath)) {
            console.log('⚠️ settings.js not found, skipping module update');
            return false;
        }
        
        const settings = require('./settings');
        const zipUrl = settings.updateZipUrl;
        
        if (!zipUrl) {
            console.log('⚠️ No updateZipUrl configured in settings.js');
            return false;
        }

        const TEMP_DIR = path.join(__dirname, 'temp_update');
        const ZIP_FILE = path.join(TEMP_DIR, 'modules.zip');
        const EXTRACT_DIR = path.join(TEMP_DIR, 'extracted');

        console.log('📥 DOWNLOADING MODULES FROM REPOSITORY...');
        console.log(`📍 URL: ${zipUrl}`);

        try {
            if (!fs.existsSync(TEMP_DIR)) {
                fs.mkdirSync(TEMP_DIR, { recursive: true });
            }

            const response = await axios({
                method: 'get',
                url: zipUrl,
                responseType: 'arraybuffer',
                timeout: 120000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            fs.writeFileSync(ZIP_FILE, response.data);
            console.log('✅ DOWNLOAD COMPLETE!');

            if (fs.existsSync(EXTRACT_DIR)) {
                fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
            }
            fs.mkdirSync(EXTRACT_DIR, { recursive: true });

            console.log('📦 EXTRACTING FILES...');
            execSync(`unzip -o "${ZIP_FILE}" -d "${EXTRACT_DIR}"`, { stdio: 'pipe' });

            const extractedFolders = fs.readdirSync(EXTRACT_DIR);
            const moduleFolder = extractedFolders.find(f => f.includes('ZORO-MD-MODULES'));
            
            if (!moduleFolder) {
                console.log('❌ Could not find modules folder in extracted files');
                return false;
            }

            const sourcePath = path.join(EXTRACT_DIR, moduleFolder);
            const basePath = __dirname;

            const foldersToSync = ['lib', 'plugins', 'data', 'media'];
            const filesToSync = ['main.js', 'config.js'];

            for (const folder of foldersToSync) {
                const sourceFolder = path.join(sourcePath, folder);
                const destFolder = path.join(basePath, folder);
                
                if (fs.existsSync(sourceFolder)) {
                    if (!fs.existsSync(destFolder)) {
                        fs.mkdirSync(destFolder, { recursive: true });
                    }
                    
                    fs.cpSync(sourceFolder, destFolder, { recursive: true, force: true });
                    console.log(`✅ SYNCED FOLDER: ${folder}`);
                }
            }

            for (const file of filesToSync) {
                const sourceFile = path.join(sourcePath, file);
                const destFile = path.join(basePath, file);
                
                if (fs.existsSync(sourceFile)) {
                    fs.copyFileSync(sourceFile, destFile);
                    console.log(`✅ SYNCED FILE: ${file}`);
                }
            }

            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            fs.writeFileSync(modulesInstalledFlag, new Date().toISOString());
            
            console.log('🎉 MODULES UPDATED SUCCESSFULLY!');
            return true;

        } catch (error) {
            console.error('❌ Error updating modules:', error.message);
            if (fs.existsSync(TEMP_DIR)) {
                fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            }
            return false;
        }
    }

    // ============================================
    // FFMPEG CHECK AND AUTO-INSTALL
    // ============================================
    async function checkAndInstallFFmpeg() {
        console.log('🎬 CHECKING FFMPEG INSTALLATION...');
        
        const ffmpegDir = path.join(__dirname, 'ffmpeg_bin');
        const ffmpegPath = path.join(ffmpegDir, 'ffmpeg');
        const ffprobePath = path.join(ffmpegDir, 'ffprobe');
        
        try {
            const result = execSync('ffmpeg -version', { stdio: 'pipe', encoding: 'utf8' });
            const version = result.split('\n')[0];
            console.log(`✅ FFMPEG FOUND IN SYSTEM: ${version.substring(0, 50)}...`);
            return true;
        } catch (error) {
            console.log('⚠️ FFmpeg not found in system PATH');
        }
        
        if (fs.existsSync(ffmpegPath)) {
            try {
                const result = execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe', encoding: 'utf8' });
                const version = result.split('\n')[0];
                console.log(`✅ FFMPEG FOUND LOCALLY: ${version.substring(0, 50)}...`);
                process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
                console.log('✅ ADDED FFMPEG TO PATH');
                return true;
            } catch (error) {
                console.log('⚠️ Local FFmpeg exists but not working, will re-download');
            }
        }
        
        console.log('📥 DOWNLOADING FFMPEG AUTOMATICALLY...');
        
        try {
            if (!fs.existsSync(ffmpegDir)) {
                fs.mkdirSync(ffmpegDir, { recursive: true });
            }
            
            const FFMPEG_URL = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
            const tempFile = path.join(__dirname, 'ffmpeg_temp.tar.xz');
            const extractDir = path.join(__dirname, 'ffmpeg_extract');
            
            console.log('📍 DOWNLOADING FROM johnvansickle.com...');
            
            const response = await axios({
                method: 'get',
                url: FFMPEG_URL,
                responseType: 'arraybuffer',
                timeout: 300000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            fs.writeFileSync(tempFile, response.data);
            console.log('✅ DOWNLOAD COMPLETE!');
            
            console.log('📦 EXTRACTING FFMPEG...');
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });
            
            execSync(`tar -xf "${tempFile}" -C "${extractDir}"`, { stdio: 'pipe' });
            
            const extractedFolders = fs.readdirSync(extractDir);
            const ffmpegFolder = extractedFolders.find(f => f.includes('ffmpeg'));
            
            if (ffmpegFolder) {
                const srcFFmpeg = path.join(extractDir, ffmpegFolder, 'ffmpeg');
                const srcFFprobe = path.join(extractDir, ffmpegFolder, 'ffprobe');
                
                if (fs.existsSync(srcFFmpeg)) {
                    fs.copyFileSync(srcFFmpeg, ffmpegPath);
                    fs.chmodSync(ffmpegPath, '755');
                    console.log('✅ FFmpeg INSTALLED');
                }
                
                if (fs.existsSync(srcFFprobe)) {
                    fs.copyFileSync(srcFFprobe, ffprobePath);
                    fs.chmodSync(ffprobePath, '755');
                    console.log('✅ FFprobe INSTALLED');
                }
            }
            
            fs.unlinkSync(tempFile);
            fs.rmSync(extractDir, { recursive: true, force: true });
            
            process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
            console.log('✅ ADDED FFMPEG TO PATH');
            
            try {
                const result = execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe', encoding: 'utf8' });
                const version = result.split('\n')[0];
                console.log(`🎉 FFMPEG INSTALLED SUCCESSFULLY: ${version.substring(0, 50)}...`);
                return true;
            } catch (e) {
                console.log('❌ FFMPEG INSTALLATION VERIFICATION FAILED');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Failed to download FFmpeg:', error.message);
            console.log('⚠️ Some features like stickers and audio effects may not work');
            console.log('💡 Please install FFmpeg manually on your hosting panel');
            return false;
        }
    }

    // ============================================
    // GITHUB UPDATE CHECKER & STYLISH NOTIFIER
    // ============================================
    async function checkForGitHubUpdates(sock, botNumber) {
        const GITHUB_OWNER = "Aadhixd777";
        const GITHUB_REPO = "ZORO-MD";
        const versionFile = path.join(__dirname, 'data', 'last_commit.json');

        try {
            const response = await axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=1`, {
                headers: { 'User-Agent': 'Zoro-MD-Updater' }
            });

            if (!response.data || response.data.length === 0) return;

            const latestCommit = response.data[0];
            const commitHash = latestCommit.sha;
            const commitMessage = latestCommit.commit.message;

            let savedData = {};
            if (fs.existsSync(versionFile)) {
                savedData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
            }

            if (savedData.lastCommit !== commitHash) {
                savedData.lastCommit = commitHash;
                if (!fs.existsSync(path.dirname(versionFile))) {
                    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
                }
                fs.writeFileSync(versionFile, JSON.stringify(savedData, null, 2));

                const updateMessage = `
╔════════════════════════╗
║  ⚡ *ZORO MD SYSTEM UPDATE*  ⚡
╚════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🌟 *Hello User!*
┃ A fresh update has just been deployed. 🚀
┃
┃ 1️⃣ 📝 *What's New:*
┃    ↳ *${commitMessage}*
┃
┃ 2️⃣ 🛠️ *Components:*
┃    ↳ *Plugins, Libs & Core Files*
┃
┃ 3️⃣ 💡 *How to update?*
┃    ↳ *Type \`.update\` in chat!* 🔥
┗━━━━━━━━━━━━━━━━━━━━━━━━

╔════════════════════════╗
│ 💎 *Powered by:* \`Zoro MD\`
│ 👑 *Developer:* \`Aadhixd\`
╚════════════════════════╝

╔════════════════════════╗
│ ✨ *Status:* \`Ready to Roll\` 🦅
╚════════════════════════╝`;

                const updateImageUrl = "https://files.catbox.moe/f13mkf.jpg";

                await sock.sendMessageDirect(botNumber, {
                    image: { url: updateImageUrl },
                    caption: updateMessage
                });

                console.log('✅ Stylish image update notification sent to user personal chat!');
            }
        } catch (error) {
            console.log('⚠️ Failed to check GitHub updates:', error.message);
        }
    }

    // ============================================
    // MAIN BOT STARTUP
    // ============================================
    async function startBot() {
        const express = require('express');
        const app = express();
        app.use(express.json());
        const port = process.env.PORT || 8000;

        // MongoDB Setup for Sessions
        const mongoose = require('mongoose');
        const mongoURI = process.env.MONGODB_URI;

        if (mongoURI && mongoose.connection.readyState === 0) {
            try {
                await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
                console.log('✅ MongoDB Connected successfully for Sessions!');
            } catch (e) {
                console.log('⚠️ MongoDB connection error:', e.message);
            }
        }

        const SessionSchema = new mongoose.Schema({
            sessionId: { type: String, required: true, unique: true },
            creds: { type: Object, default: {} },
            keys: { type: Object, default: {} }
        });
        const SessionModel = mongoose.models.Session || mongoose.model('Session', SessionSchema);

        async function useMongoDBAuthState(sessionId) {
            const readCreds = async () => {
                const session = await SessionModel.findOne({ sessionId });
                if (session && session.creds) return session.creds;
                return null;
            };

            const saveCredsToMongo = async (creds) => {
                await SessionModel.findOneAndUpdate(
                    { sessionId },
                    { $set: { creds } },
                    { upsert: true, new: true }
                );
            };

            const initialCreds = await readCreds() || (await require("@whiskeysockets/baileys").initAuthCreds());

            return {
                state: {
                    creds: initialCreds,
                    keys: {
                        get: async (type, ids) => {
                            const session = await SessionModel.findOne({ sessionId });
                            const keys = session && session.keys ? session.keys : {};
                            const data = {};
                            for (const id of ids) {
                                if (keys[type] && keys[type][id]) data[id] = keys[type][id];
                            }
                            return data;
                        },
                        set: async (data) => {
                            const session = await SessionModel.findOne({ sessionId }) || { keys: {} };
                            let keys = session.keys || {};
                            for (const type of Object.keys(data)) {
                                if (!keys[type]) keys[type] = {};
                                for (const id of Object.keys(data[type])) {
                                    keys[type][id] = data[type][id];
                                }
                            }
                            await SessionModel.findOneAndUpdate(
                                { sessionId },
                                { $set: { keys } },
                                { upsert: true, new: true }
                            );
                        }
                    }
                },
                saveCreds: async () => {
                    await saveCredsToMongo(state.creds);
                }
            };
        }

        // ============================================
        // EXPRESS PAIRING ENDPOINT (MULTI-USER SUPPORT)
        // ============================================
        app.post('/pair', async (req, res) => {
            const { phone, userId } = req.body;
            if (!phone) {
                return res.status(400).json({ status: false, error: 'Phone number is required' });
            }

            try {
                let phoneNum = phone.replace(/[^0-9]/g, '');
                let targetUserId = userId || 'default';
                let sessionName = `session_${targetUserId}`;

                const { default: makeWASocket, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } = require("@whiskeysockets/baileys");
                const NodeCache = require("node-cache");
                const pino = require("pino");

                let { version } = await fetchLatestBaileysVersion();
                const { state, saveCreds } = await useMongoDBAuthState(sessionName);
                const msgRetryCounterCache = new NodeCache();

                const tempSock = makeWASocket({
                    version,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false,
                    browser: ["Chrome", "Desktop", "120.0.0.0"],
                    auth: {
                        creds: state.creds,
                        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                    },
                    msgRetryCounterCache,
                    markOnlineOnConnect: true,
                });

                tempSock.ev.on('creds.update', saveCreds);

                await delay(3000);

                let retries = 0;
                let code = null;
                while (retries < 5) {
                    try {
                        if (!tempSock.authState.creds.registered) {
                            code = await tempSock.requestPairingCode(phoneNum);
                            if (code) break;
                        } else {
                            break;
                        }
                    } catch (e) {
                        console.log(`Pairing code attempt ${retries + 1} failed:`, e.message);
                    }
                    await delay(3000);
                    retries++;
                }

                try { setTimeout(() => { try { tempSock.end(undefined); } catch {} }, 10000); } catch {}

                if (code) {
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    return res.json({ status: true, code: code });
                } else {
                    return res.status(500).json({ status: false, error: 'Failed to generate pairing code. Please check number format.' });
                }
            } catch (err) {
                return res.status(500).json({ status: false, error: err.message });
            }
        });

        app.get('/', (req, res) => res.send('Bot is Alive!'));
        app.listen(port, () => console.log(`🚀 Keep-alive & Pairing server running on port ${port}`));

        // ============================================
        // TELEGRAM BOT (INLINE WITH PREMIUM EMOJIS & GITHUB VERIFICATION)
        // ============================================
        try {
            const { Telegraf, Markup } = require('telegraf');
            const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

            if (TELEGRAM_TOKEN) {
                const tgBot = new Telegraf(TELEGRAM_TOKEN);
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
                    } catch (e) {}
                    return new Map();
                }

                function saveVerifiedUsers(usersMap) {
                    try {
                        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
                        fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(usersMap.entries()), null, 2));
                    } catch (e) {}
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
                            const found = stargazers.some(user => user.login.toLowerCase() === username.toLowerCase());
                            if (found) return true;
                            if (stargazers.length < 100) break;
                            page++;
                        }
                        return false;
                    } catch (error) {
                        return false;
                    }
                }

                tgBot.start((ctx) => {
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

                tgBot.command('verify', async (ctx) => {
                    const text = ctx.message.text.trim();
                    const args = text.split(/\s+/);
                    if (args.length < 2) {
                        return ctx.replyWithHTML(`⚠️ Please provide your GitHub username!\n\nUsage: <code>/verify your_github_username</code>`);
                    }
                    const githubUsername = args[1].trim();
                    const waitMsg = await ctx.reply(`🔍 Checking GitHub status for <b>${githubUsername}</b>... Please wait.`, { parse_mode: 'HTML' });
                    const isStarred = await checkGitHubStar(githubUsername);

                    if (isStarred) {
                        const currentUsers = loadVerifiedUsers();
                        currentUsers.set(ctx.from.id, githubUsername);
                        saveVerifiedUsers(currentUsers);
                        verifiedUsers.set(ctx.from.id, githubUsername);

                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            waitMsg.message_id,
                            null,
                            `${emoji("5251685816828194329", "✅")} <b>Verification Successful!</b>\n\n` +
                            `Thank you for starring <code>${GITHUB_REPO}</code>! Your pairing section is now active ${emoji("5251733667058840414", "✔️")}.\n\n` +
                            `${emoji("4969971262546772590", "📲")} Now you can generate your WhatsApp pairing code using:\n` +
                            `<code>/pair phone_number</code>\n\n` +
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

                tgBot.command('pair', async (ctx) => {
                    const currentUsers = loadVerifiedUsers();
                    if (!currentUsers.has(ctx.from.id) && !verifiedUsers.has(ctx.from.id)) {
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
                        return ctx.replyWithHTML(`⚠️ Please provide your phone number with country code!\nUsage: <code>/pair 918136880986</code>`);
                    }

                    const phoneNumber = args[1].replace(/[^0-9]/g, '');
                    const userId = ctx.from.id;
                    const statusMsg = await ctx.reply("Generating Pairing Code... Please wait...");

                    try {
                        const response = await axios.post(`http://127.0.0.1:${port}/pair`, { phone: phoneNumber, userId: userId }, { timeout: 30000 });
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

                            // Dynamically start bot session for this user
                            startXeonBotInc(`session_${userId}`, userId);
                        } else {
                            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Error: ${data.error || 'Failed to get code'}`);
                        }
                    } catch (err) {
                        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Server Error: ${err.message}`);
                    }
                });

                tgBot.launch().then(() => console.log("🤖 Telegram Bot started with Premium Emojis & Verification..."));
                process.once('SIGINT', () => tgBot.stop('SIGINT'));
                process.once('SIGTERM', () => tgBot.stop('SIGTERM'));
            }
        } catch (e) {
            console.log("⚠️ Telegram Bot initialization warning:", e.message);
        }

        console.log('\n╔════════════════════════════════════╗');
        console.log('║  🚀 ZORO MD BOT STARTING... ║');
        console.log('╚════════════════════════════════════╝\n');
        
        console.log('📥 CHECKING FOR MODULE UPDATES...');
        try {
            await downloadAndExtractModules();
        } catch (err) {
            console.log('⚠️ Module update check failed, continuing with existing files...');
        }
        
        await checkAndInstallFFmpeg();
        
        console.log('\n🤖 LOADING BOT MODULES...\n');

        require('./settings');
        const { Boom } = require('@hapi/boom');
        const chalk = require('chalk');
        const FileType = require('file-type');
        const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
        const PhoneNumber = require('awesome-phonenumber');
        const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
        const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await: awaitFunc, sleep, reSize } = require('./lib/myfunc');
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            DisconnectReason,
            fetchLatestBaileysVersion,
            generateForwardMessageContent,
            prepareWAMessageMedia,
            generateWAMessageFromContent,
            generateMessageID,
            downloadContentFromMessage,
            jidDecode,
            proto,
            jidNormalizedUser,
            makeCacheableSignalKeyStore,
            delay
        } = require("@whiskeysockets/baileys");
        const NodeCache = require("node-cache");
        const pino = require("pino");
        const readline = require("readline");
        const { parsePhoneNumber } = require("libphonenumber-js");
        const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics');
        const { rmSync, existsSync } = require('fs');
        const { join } = require('path');

        const store = require('./lib/lightweight_store');

        store.readFromFile();
        const settings = require('./settings');
        setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

        const MessageQueue = require('./lib/messageQueue');
        const messageQueue = new MessageQueue();

        setInterval(() => {
            if (global.gc) {
                global.gc();
                console.log('🧹 Garbage collection completed');
            }
        }, 60_000);

        setInterval(() => {
            const used = process.memoryUsage().rss / 1024 / 1024;
            if (used > 400) {
                console.log('⚠️ RAM too high (>400MB), restarting bot...');
                process.exit(1);
            }
        }, 30_000);

        let owner = JSON.parse(fs.readFileSync('./data/owner.json'));

        global.botname = "ZORO BOT";
        global.themeemoji = "•";

        async function startXeonBotInc(sessionName = 'session_default', identifier = 'default') {
            let { version, isLatest } = await fetchLatestBaileysVersion();
            
            const { state, saveCreds } = await useMongoDBAuthState(sessionName);
            const msgRetryCounterCache = new NodeCache();

            const XeonBotInc = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ["Chrome", "Desktop", "120.0.0.0"],
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: true,
                getMessage: async (key) => {
                    let jid = jidNormalizedUser(key.remoteJid);
                    let msg = await store.loadMessage(jid, key.id);
                    return msg?.message || "";
                },
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined,
            });

            store.bind(XeonBotInc.ev);

            const { wrapSendMessage } = require('./lib/fontTransformer');
            wrapSendMessage(XeonBotInc);

            const originalSendMessage = XeonBotInc.sendMessage;
            const baseSendMessage = originalSendMessage;
            let hasConnectedOnce = false;

            XeonBotInc.sendMessage = async function(jid, content, options = {}) {
                try {
                    return await originalSendMessage.call(this, jid, content, options);
                } catch (error) {
                    console.log(`⚠️ Message send failed, queueing for retry: ${error.message}`);
                    messageQueue.addMessage(jid, content, 1);
                    throw error;
                }
            };

            XeonBotInc.sendMessageDirect = async function(jid, content, options = {}) {
                return await baseSendMessage.call(this, jid, content, options);
            };

            XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
                try {
                    const mek = chatUpdate.messages[0];
                    if (!mek.message) return;
                    mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                    if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                        await handleStatus(XeonBotInc, chatUpdate);
                        return;
                    }
                    if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                    if (XeonBotInc?.msgRetryCounterCache) {
                        XeonBotInc.msgRetryCounterCache.clear();
                    }

                    try {
                        await handleMessages(XeonBotInc, chatUpdate, true);
                    } catch (err) {
                        console.error("Error in handleMessages:", err);
                        if (mek.key && mek.key.remoteJid) {
                            await XeonBotInc.sendMessage(mek.key.remoteJid, {
                                text: '❌ An error occurred while processing your message.',
                                }).catch(console.error);
                        }
                    }
                } catch (err) {
                    console.error("Error in messages.upsert:", err);
                }
            });

            XeonBotInc.decodeJid = (jid) => {
                if (!jid) return jid;
                if (/:\d+@/gi.test(jid)) {
                    let decode = jidDecode(jid) || {};
                    return decode.user && decode.server && decode.user + '@' + decode.server || jid;
                } else return jid;
            };

            XeonBotInc.ev.on('contacts.update', update => {
                for (let contact of update) {
                    let id = XeonBotInc.decodeJid(contact.id);
                    if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
                }
            });

            XeonBotInc.getName = (jid, withoutContact = false) => {
                let id = XeonBotInc.decodeJid(jid);
                withoutContact = XeonBotInc.withoutContact || withoutContact;
                let v;
                if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                    v = store.contacts[id] || {};
                    if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {};
                    resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
                });
                else v = id === '0@s.whatsapp.net' ? {
                    id,
                    name: 'WhatsApp'
                } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
                    XeonBotInc.user :
                    (store.contacts[id] || {});
                return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
            };

            XeonBotInc.public = true;
            XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

            XeonBotInc.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection == "open") {
                    console.log(chalk.magenta(` `));
                    console.log(chalk.yellow(`🦅 CONNECTED TO => ` + JSON.stringify(XeonBotInc.user, null, 2)));

                    messageQueue.setConnected(true);
                    await messageQueue.processQueue(XeonBotInc);

                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    if (!hasConnectedOnce) {
                        hasConnectedOnce = true;
                        
                        await checkForGitHubUpdates(XeonBotInc, botNumber);

                        await XeonBotInc.sendMessageDirect(botNumber, {
                            text: "✨ *Multi-User Bot Successfully Connected (MongoDB Active)!* ✅"
                        }).catch(err => console.log('⚠️ Could not send update message:', err.message));

                        await delay(2000);

                        await XeonBotInc.sendMessageDirect(botNumber, {
                            text: `
┏❐═⭔ *ZORO CONNECTED SUCCESSFULLY* ⭔═❐
┃⭔ *Bot:* ZORO MD 
┃⭔ *Time:* ${new Date().toLocaleString()}
┃⭔ *Status:* Active (Multi-User & MongoDB Linked)
┃⭔ *User:* ${botNumber}
┗❐═⭔════════⭔═❐

ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴛʜᴇ ɢʀᴏᴜᴘ
https://chat.whatsapp.com/JD6upTGh8a44e5t7pUahgq?s=cl&p=a&mlu=3&amv=0`,
                        }).catch(err => console.log('⚠️ Could not send connection message:', err.message));
                    }

                    setInterval(() => messageQueue.processQueue(XeonBotInc), 10000);

                    await delay(1999);
                    
                    console.log(chalk.yellow(`\n\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮`));
                    console.log(chalk.bold.blue(`│     🔥 ZORO MD BOT 🔥      │`));
                    console.log(chalk.yellow(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`));
                    
                    console.log(chalk.cyan(`╔════════════════════════════════════╗`));
                    console.log(chalk.green(`║  ✅ ZORO CONNECTION SUCCESSFUL! ✅     ║`));
                    console.log(chalk.cyan(`╠════════════════════════════════════╣`));
                    console.log(chalk.magenta(`║ 👤 Owner: ROMEO               ║`));
                    console.log(chalk.magenta(`║ 📱 Number: ${owner}             ║`));
                    console.log(chalk.magenta(`║ 💎 Version: ${settings.version || '3.0.0'}                     ║`));
                    console.log(chalk.magenta(`║ ⏰ Time: ${new Date().toLocaleString()}  ║`));
                    console.log(chalk.magenta(`║ 🔥 Status: ON FIRE!                ║`));
                    console.log(chalk.cyan(`╚════════════════════════════════════╝\n`));
                    
                    console.log(chalk.green(`${global.themeemoji || '•'} 🍁 ZORO AND ZORO is on fire 🔥`));
                    console.log(chalk.blue(`${global.themeemoji || '•'} All systems operational!`));
                }
                if (connection === 'close') {
                    messageQueue.setConnected(false);
                    console.log(chalk.yellow('⚠️ Connection lost - messages will be queued for retry'));
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        try {
                            await SessionModel.deleteOne({ sessionId: sessionName });
                        } catch { }
                        console.log(chalk.red('Session logged out. Please re-authenticate.'));
                    } else {
                        console.log(chalk.yellow('Reconnecting...'));
                        setTimeout(() => startXeonBotInc(sessionName, identifier), 5000);
                    }
                }
            });

            const { handleCall } = require('./plugins/anticall-improved');
            XeonBotInc.ev.on('call', async (calls) => {
                try {
                    for (const call of calls) {
                        const callData = {
                            from: call.from || call.peerJid || call.chatId,
                            id: call.id,
                            status: call.status || 'offer'
                        };
                        await handleCall(XeonBotInc, callData);
                    }
                } catch (e) {
                    console.error('Error handling call:', e);
                }
            });

            XeonBotInc.ev.on('creds.update', saveCreds);
            XeonBotInc.ev.on('group-participants.update', async (update) => {
                await handleGroupParticipantUpdate(XeonBotInc, update);
            });
            XeonBotInc.ev.on('messages.upsert', async (m) => {
                if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, m);
                }
            });
            XeonBotInc.ev.on('status.update', async (status) => {
                await handleStatus(XeonBotInc, status);
            });
            XeonBotInc.ev.on('messages.reaction', async (status) => {
                await handleStatus(XeonBotInc, status);
            });

            return XeonBotInc;
        }

        console.log(chalk.green('\n🤖 STARTING WHATSAPP CONNECTION...\n'));
        
        try {
            const allSessions = await SessionModel.find({});
            if (allSessions.length > 0) {
                console.log(`🔄 Restoring ${allSessions.length} active user session(s) from MongoDB...`);
                for (const sess of allSessions) {
                    const identifier = sess.sessionId.replace('session_', '');
                    await startXeonBotInc(sess.sessionId, identifier);
                }
            } else {
                await startXeonBotInc('session_default', 'default');
            }
        } catch (err) {
            await startXeonBotInc('session_default', 'default');
        }
    }

    startBot().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
    });

    process.on('unhandledRejection', (err) => {
        console.error('Unhandled Rejection:', err);
    });

    let file = require.resolve(__filename);
    fs.watchFile(file, () => {
        fs.unwatchFile(file);
        console.log(`Update ${__filename}`);
        delete require.cache[file];
        require(file);
    });
}
