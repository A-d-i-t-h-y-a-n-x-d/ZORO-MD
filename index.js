const cluster = require('cluster');
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
    // MAIN BOT STARTUP
    // ============================================
    async function startBot() {
        const express = require('express');
        const app = express();
        app.use(express.json());
        const port = process.env.PORT || 8000;

        const mongoose = require('mongoose');
        const mongoURI = process.env.MONGODB_URI;

        if (mongoURI && mongoose.connection.readyState === 0) {
            try {
                await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 15000 });
                console.log('✅ MongoDB Connected successfully for Multi-User Sessions!');
            } catch (e) {
                console.log('⚠️ MongoDB connection warning, retrying in background...');
            }
        }

        const SessionSchema = new mongoose.Schema({
            sessionId: { type: String, required: true, unique: true },
            creds: { type: Object, default: {} },
            keys: { type: Object, default: {} }
        });
        const SessionModel = mongoose.models.Session || mongoose.model('Session', SessionSchema);

        async function migrateEnvSessionToMongo() {
            if (process.env.SESSION_ID) {
                try {
                    let sessionId = process.env.SESSION_ID.replace(/^["']|["']$/g, '');
                    if (sessionId.includes(':~')) {
                        sessionId = sessionId.split(':~')[1];
                    }
                    const sessionData = JSON.parse(Buffer.from(sessionId, 'base64').toString('utf-8'));
                    
                    const existing = await SessionModel.findOne({ sessionId: 'session_default' });
                    if (!existing || !existing.creds || !existing.creds.registered) {
                        await SessionModel.findOneAndUpdate(
                            { sessionId: 'session_default' },
                            { $set: { creds: sessionData } },
                            { upsert: true, new: true }
                        );
                        console.log('🚀 .env SESSION_ID successfully migrated to MongoDB (session_default)!');
                    }
                } catch (err) {
                    console.log('⚠️ Failed to migrate .env session to MongoDB:', err.message);
                }
            }
        }
        await migrateEnvSessionToMongo();

        async function useMongoDBAuthState(sessionId) {
            const readCreds = async () => {
                try {
                    const session = await SessionModel.findOne({ sessionId });
                    if (session && session.creds) {
                        return JSON.parse(JSON.stringify(session.creds));
                    }
                } catch (e) {}
                return null;
            };

            const saveCredsToMongo = async (creds) => {
                try {
                    await SessionModel.findOneAndUpdate(
                        { sessionId },
                        { $set: { creds: JSON.parse(JSON.stringify(creds)) } },
                        { upsert: true, new: true }
                    );
                } catch (e) {}
            };

            const initialCreds = await readCreds() || (await require("@whiskeysockets/baileys").initAuthCreds());

            const authState = {
                creds: initialCreds,
                keys: {
                    get: async (type, ids) => {
                        try {
                            const session = await SessionModel.findOne({ sessionId });
                            const keys = session && session.keys ? JSON.parse(JSON.stringify(session.keys)) : {};
                            const data = {};
                            for (const id of ids) {
                                if (keys[type] && keys[type][id]) data[id] = keys[type][id];
                            }
                            return data;
                        } catch (e) {
                            return {};
                        }
                    },
                    set: async (data) => {
                        try {
                            const session = await SessionModel.findOne({ sessionId }) || { keys: {} };
                            let keys = session.keys ? JSON.parse(JSON.stringify(session.keys)) : {};
                            for (const type of Object.keys(data)) {
                                if (!keys[type]) keys[type] = {};
                                for (const id of Object.keys(data[type])) {
                                    keys[type][id] = data[type][id];
                                }
                            }
                            await SessionModel.findOneAndUpdate(
                                { sessionId },
                                { $set: { keys: JSON.parse(JSON.stringify(keys)) } },
                                { upsert: true, new: true }
                            );
                        } catch (e) {}
                    }
                }
            };

            return {
                state: authState,
                saveCreds: async () => {
                    await saveCredsToMongo(authState.creds);
                }
            };
        }

        // ============================================
        // EXPRESS PAIRING ENDPOINT FOR TELEGRAM (FIXED & FAST)
        // ============================================
        app.post('/pair', async (req, res) => {
            const { phone, userId } = req.body;
            if (!phone) {
                return res.status(400).json({ status: false, error: 'Phone number is required' });
            }

            let tempSock = null;
            try {
                let phoneNum = phone.replace(/[^0-9]/g, '');
                let targetUserId = userId || 'default';
                let sessionName = `session_${targetUserId}`;

                const { default: makeWASocket, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay, Browsers } = require("@whiskeysockets/baileys");
                const NodeCache = require("node-cache");
                const pino = require("pino");

                let { version } = await fetchLatestBaileysVersion();
                const authObj = await useMongoDBAuthState(sessionName);
                const msgRetryCounterCache = new NodeCache();

                tempSock = makeWASocket({
                    version,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false,
                    browser: Browsers.ubuntu('Chrome'),
                    auth: {
                        creds: authObj.state.creds,
                        keys: makeCacheableSignalKeyStore(authObj.state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                    },
                    msgRetryCounterCache,
                    markOnlineOnConnect: false,
                    connectTimeoutMs: 60000,
                    defaultQueryTimeoutMs: 60000,
                    keepAliveIntervalMs: 15000,
                    generateHighQualityLinkPreview: true
                });

                tempSock.ev.on('creds.update', authObj.saveCreds);

                await delay(3000);

                let retries = 0;
                let code = null;
                while (retries < 8) {
                    try {
                        if (!tempSock.authState.creds.registered) {
                            code = await tempSock.requestPairingCode(phoneNum.toString());
                            if (code) break;
                        } else {
                            break;
                        }
                    } catch (e) {
                        console.log('Pairing code generation retry error:', e.message);
                    }
                    await delay(4000);
                    retries++;
                }

                try {
                    if (tempSock) tempSock.end(undefined);
                } catch {}

                if (code) {
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    return res.json({ status: true, code: code });
                } else {
                    return res.status(500).json({ status: false, error: 'Network busy or timeout. Please check number format and try again.' });
                }
            } catch (err) {
                if (tempSock) {
                    try { tempSock.end(undefined); } catch {}
                }
                return res.status(500).json({ status: false, error: 'Connection error. Please retry after some time.' });
            }
        });

        app.get('/', (req, res) => res.send('Bot is Alive!'));
        app.listen(port, () => console.log(`🚀 Keep-alive & Pairing server running on port ${port}`));

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
            delay,
            Browsers
        } = require("@whiskeysockets/baileys");
        const NodeCache = require("node-cache");
        const pino = require("pino");
        const readline = require("readline");
        const { parsePhoneNumber } = require("libphonenumber-js");
        const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics');
        const { rmSync, existsSync } = require('fs');
        const { join } = require('path');

        const store = require('./lib/lightweight_store');

        try { store.readFromFile(); } catch(e) {}
        const settings = require('./settings');
        setInterval(() => { try { store.writeToFile(); } catch(e) {} }, settings.storeWriteInterval || 10000);

        const MessageQueue = require('./lib/messageQueue');
        const messageQueue = new MessageQueue();

        setInterval(() => {
            if (global.gc) {
                try { global.gc(); } catch (e) {}
            }
        }, 60_000);

        setInterval(() => {
            const used = process.memoryUsage().rss / 1024 / 1024;
            if (used > 450) {
                console.log('⚠️ RAM too high (>450MB), restarting bot...');
                process.exit(1);
            }
        }, 30_000);

        let owner = [];
        try {
            owner = JSON.parse(fs.readFileSync('./data/owner.json'));
        } catch (e) {
            owner = ["Aadhixd"];
        }

        global.botname = "ZORO BOT";
        global.themeemoji = "•";

        // ============================================
        // TELEGRAM BOT FOR PAIRING
        // ============================================
        try {
            const { Telegraf, Markup } = require('telegraf');
            const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

            if (TELEGRAM_TOKEN) {
                const tgBot = new Telegraf(TELEGRAM_TOKEN);
                
                tgBot.start((ctx) => {
                    ctx.replyWithHTML(`🤖 <b>ZORO MD MULTI-USER PAIRING BOT</b>\n\nSend your phone number with country code to get pairing code:\nExample: <code>/pair 918136880986</code>`).catch(() => {});
                });

                tgBot.command('pair', async (ctx) => {
                    const text = ctx.message.text.trim();
                    const args = text.split(/\s+/);
                    if (args.length < 2) {
                        return ctx.replyWithHTML(`⚠️ Please provide your phone number with country code!\nUsage: <code>/pair 918136880986</code>`).catch(() => {});
                    }

                    const phoneNumber = args[1].replace(/[^0-9]/g, '');
                    const userId = ctx.from.id;
                    const statusMsg = await ctx.reply("Generating Pairing Code... Please wait...").catch(() => {});

                    try {
                        const response = await axios.post(`http://127.0.0.1:${port}/pair`, { phone: phoneNumber, userId: userId }, { timeout: 90000 });
                        const data = response.data;

                        if (data && data.status) {
                            const rawCode = data.code;
                            const cleanCode = rawCode.replace(/-/g, '');

                            const successText = 
                                `📱 <b>AADHIXD PAIRCODE GENERATED</b>\n\n` +
                                `YOUR CODE: <code>${rawCode}</code>\n\n` +
                                `Steps to link:\n` +
                                `1. Open WhatsApp > Settings > Linked Devices.\n` +
                                `2. Tap Link a Device > Link with phone number.\n` +
                                `3. Enter the pairing code above.\n\n` +
                                `Bot will auto activate after verification!`;

                            if (statusMsg) {
                                await ctx.telegram.editMessageText(
                                    ctx.chat.id,
                                    statusMsg.message_id,
                                    null,
                                    successText,
                                    {
                                        parse_mode: 'HTML',
                                        ...Markup.inlineKeyboard([
                                            [Markup.button.switchToCurrentChat(`📋 Pair Code: ${rawCode}`, cleanCode)]
                                        ])
                                    }
                                ).catch(() => {});
                            }

                            await delay(4000);
                            startXeonBotInc(`session_${userId}`, userId);
                        } else {
                            if (statusMsg) {
                                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Error: ${data.error || 'Failed to get code'}`).catch(() => {});
                            }
                        }
                    } catch (err) {
                        let errorMsg = err.response?.data?.error || "Network timeout or server busy. Please try again.";
                        if (statusMsg) {
                            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Server Error: ${errorMsg}`).catch(() => {});
                        }
                    }
                });

                tgBot.launch().then(() => console.log("🤖 Telegram Pairing Bot started..."));
                process.once('SIGINT', () => tgBot.stop('SIGINT'));
                process.once('SIGTERM', () => tgBot.stop('SIGTERM'));
            }
        } catch (e) {}

        async function startXeonBotInc(sessionName = 'session_default', identifier = 'default') {
            let { version, isLatest } = await fetchLatestBaileysVersion();
            
            const authObj = await useMongoDBAuthState(sessionName);
            const msgRetryCounterCache = new NodeCache();

            const XeonBotInc = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                auth: {
                    creds: authObj.state.creds,
                    keys: makeCacheableSignalKeyStore(authObj.state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: true,
                getMessage: async (key) => {
                    try {
                        let jid = jidNormalizedUser(key.remoteJid);
                        let msg = await store.loadMessage(jid, key.id);
                        return msg?.message || "";
                    } catch (e) {
                        return "";
                    }
                },
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined,
            });

            try { store.bind(XeonBotInc.ev); } catch(e) {}

            try {
                const { wrapSendMessage } = require('./lib/fontTransformer');
                if (wrapSendMessage) wrapSendMessage(XeonBotInc);
            } catch (e) {}

            const originalSendMessage = XeonBotInc.sendMessage;
            const baseSendMessage = originalSendMessage;
            let hasConnectedOnce = false;

            XeonBotInc.sendMessage = async function(jid, content, options = {}) {
                try {
                    return await originalSendMessage.call(this, jid, content, options);
                } catch (error) {
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
                        await handleStatus(XeonBotInc, chatUpdate).catch(() => {});
                        return;
                    }
                    if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                    if (XeonBotInc?.msgRetryCounterCache) {
                        XeonBotInc.msgRetryCounterCache.clear();
                    }

                    try {
                        await handleMessages(XeonBotInc, chatUpdate, true);
                    } catch (err) {
                        if (mek.key && mek.key.remoteJid) {
                            await XeonBotInc.sendMessage(mek.key.remoteJid, {
                                text: '❌ An error occurred while processing your message.',
                            }).catch(() => {});
                        }
                    }
                } catch (err) {}
            });

            XeonBotInc.decodeJid = (jid) => {
                if (!jid) return jid;
                if (/:\d+@/gi.test(jid)) {
                    let decode = jidDecode(jid) || {};
                    return decode.user && decode.server && decode.user + '@' + decode.server || jid;
                } else return jid;
            };

            XeonBotInc.ev.on('contacts.update', update => {
                try {
                    for (let contact of update) {
                        let id = XeonBotInc.decodeJid(contact.id);
                        if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
                    }
                } catch (e) {}
            });

            XeonBotInc.getName = (jid, withoutContact = false) => {
                let id = XeonBotInc.decodeJid(jid);
                withoutContact = XeonBotInc.withoutContact || withoutContact;
                let v;
                if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                    try {
                        v = store.contacts[id] || {};
                        if (!(v.name || v.subject)) v = await XeonBotInc.groupMetadata(id).catch(() => ({}));
                        resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
                    } catch (e) {
                        resolve(id);
                    }
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
                    await messageQueue.processQueue(XeonBotInc).catch(() => {});

                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    if (!hasConnectedOnce) {
                        hasConnectedOnce = true;
                        
                        await XeonBotInc.sendMessageDirect(botNumber, {
                            text: "✨ *Bot Successfully Connected (Multi-User & MongoDB Linked)!* ✅"
                        }).catch(() => {});

                        await delay(2000);

                        await XeonBotInc.sendMessageDirect(botNumber, {
                            text: `
┏❐═⭔ *ZORO CONNECTED SUCCESSFULLY* ⭔═❐
┃⭔ *Bot:* ZORO MD 
┃⭔ *Time:* ${new Date().toLocaleString()}
┃⭔ *Status:* Active
┃⭔ *User:* ${botNumber}
┗❐═⭔════════⭔═❐

ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴛʜᴇ ɢʀᴏᴜᴘ
https://chat.whatsapp.com/IUe14A04uicGJdIOfBuuvd?s=cl&p=a&mlu=4`,
                        }).catch(() => {});
                    }

                    setInterval(() => messageQueue.processQueue(XeonBotInc).catch(() => {}), 10000);

                    await delay(1999);
                    
                    console.log(chalk.yellow(`\n\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮`));
                    console.log(chalk.bold.blue(`│     🔥 ZORO MD BOT 🔥      │`));
                    console.log(chalk.yellow(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`));
                    
                    console.log(chalk.cyan(`╔════════════════════════════════════╗`));
                    console.log(chalk.green(`║  ✅ ZORO CONNECTION SUCCESSFUL! ✅     ║`));
                    console.log(chalk.cyan(`╠════════════════════════════════════╣`));
                    console.log(chalk.magenta(`║ 👤 Owner: Aadhixd               ║`));
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
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        try {
                            await SessionModel.deleteOne({ sessionId: sessionName });
                        } catch { }
                    } else {
                        setTimeout(() => startXeonBotInc(sessionName, identifier), 5000);
                    }
                }
            });

            try {
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
                    } catch (e) {}
                });
            } catch (e) {}

            XeonBotInc.ev.on('creds.update', authObj.saveCreds);
            XeonBotInc.ev.on('group-participants.update', async (update) => {
                try { await handleGroupParticipantUpdate(XeonBotInc, update); } catch(e) {}
            });
            XeonBotInc.ev.on('messages.upsert', async (m) => {
                try {
                    if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
                        await handleStatus(XeonBotInc, m);
                    }
                } catch(e) {}
            });
            XeonBotInc.ev.on('status.update', async (status) => {
                try { await handleStatus(XeonBotInc, status); } catch(e) {}
            });
            XeonBotInc.ev.on('messages.reaction', async (status) => {
                try { await handleStatus(XeonBotInc, status); } catch(e) {}
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
        process.exit(1);
    });

    process.on('uncaughtException', (err) => {});
    process.on('unhandledRejection', (err) => {});

    let file = require.resolve(__filename);
    fs.watchFile(file, () => {
        fs.unwatchFile(file);
        delete require.cache[file];
        require(file);
    });
}
