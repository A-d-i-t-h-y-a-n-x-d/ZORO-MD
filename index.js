const cluster = require('cluster');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync, spawn } = require('child_process');
require('dotenv').config();

// ============================================
// AUTO RESTART SYSTEM (MASTER PROCESS)
// ============================================
if (cluster.isPrimary || cluster.isMaster) {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║  🛡️ ZORO MD SYSTEM MONITOR ACTIVE    ║');
    console.log('╚════════════════════════════════════╝\n');
    console.log('✅ Auto-restart system is active...\n');
    
    cluster.fork(); // Start the worker (the bot)

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
    // MAIN BOT STARTUP & MULTI-SESSION PAIRING
    // ============================================
    async function startBot() {
        const express = require('express');
        const app = express();
        app.use(express.json());

        const port = process.env.PORT || 8000;
        
        // Global Multi-User Pairing Endpoint (Supports any country code infinitely)
        app.post('/pair', async (req, res) => {
            const { phone } = req.body;
            if (!phone) {
                return res.status(400).json({ status: false, error: 'Phone number is required' });
            }

            try {
                let phoneNum = phone.replace(/[^0-9]/g, '');
                
                // Initialize separate session instance dynamically for each user
                const userSessionDir = path.join(__dirname, 'session', `user_${phoneNum}`);
                if (!fs.existsSync(userSessionDir)) {
                    fs.mkdirSync(userSessionDir, { recursive: true });
                }

                const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
                const { version } = await fetchLatestBaileysVersion();
                const msgRetryCounterCache = new NodeCache();

                const tempSock = makeWASocket({
                    version,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false,
                    browser: ["Ubuntu", "Chrome", "20.0.04"],
                    auth: {
                        creds: state.creds,
                        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                    },
                    markOnlineOnConnect: true,
                    generateHighQualityLinkPreview: true,
                    msgRetryCounterCache,
                    defaultQueryTimeoutMs: undefined,
                });

                tempSock.ev.on('creds.update', saveCreds);

                // Wait for connection registration and request pairing code
                if (!tempSock.authState.creds.registered) {
                    await delay(1500);
                    let code = await tempSock.requestPairingCode(phoneNum);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;

                    // Automatically start full bot socket once paired successfully
                    tempSock.ev.on('connection.update', async (s) => {
                        const { connection } = s;
                        if (connection === 'open') {
                            console.log(`✅ User ${phoneNum} connected successfully via Multi-Session!`);
                            startUserBotInstance(userSessionDir);
                        }
                    });

                    return res.json({ status: true, code: code });
                } else {
                    return res.status(400).json({ status: false, error: 'Number already registered or session exists.' });
                }
            } catch (err) {
                return res.status(500).json({ status: false, error: err.message });
            }
        });

        app.get('/', (req, res) => res.send('Bot & Pairing Server is Alive!'));
        app.listen(port, () => console.log(`🚀 Keep-alive & Multi-User Pairing server running on port ${port}`));

        if (cluster.isWorker && fs.existsSync(path.join(__dirname, 'pair_bot.js'))) {
            try {
                const telegramProcess = spawn('node', ['pair_bot.js']);
                telegramProcess.stdout.on('data', (data) => console.log(`[Telegram Bot]: ${data.toString().trim()}`));
                telegramProcess.stderr.on('data', (data) => console.error(`[Telegram Bot Error]: ${data.toString().trim()}`));
            } catch (err) {
                console.error('❌ Failed to start pair_bot.js:', err.message);
            }
        }

        console.log('\n╔════════════════════════════════════╗');
        console.log('║    🚀 ZORO MD BOT STARTING...        ║');
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
        
        const { handleAntiStatusMention, toggleAntiStatusMention } = require('./antiStatusMention');

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

        const store = require('./lib/lightweight_store');
        store.readFromFile();
        const settings = require('./settings');
        setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

        const MessageQueue = require('./lib/messageQueue');
        const messageQueue = new MessageQueue();

        let owner = JSON.parse(fs.readFileSync('./data/owner.json'));

        global.botname = "ZORO BOT";
        global.themeemoji = "•";

        // Function to run individual user bot instance concurrently (Multi-Session Handler)
        async function startUserBotInstance(sessionDir) {
            let { version } = await fetchLatestBaileysVersion();
            const msgRetryCounterCache = new NodeCache();

            const XeonBotInc = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ["Ubuntu", "Chrome", "20.0.04"],
                auth: {
                    creds: (await useMultiFileAuthState(sessionDir)).state.creds,
                    keys: makeCacheableSignalKeyStore((await useMultiFileAuthState(sessionDir)).state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
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

            XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
                try {
                    const mek = chatUpdate.messages[0];
                    if (!mek.message) return;
                    mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                    
                    const chatId = mek.key.remoteJid;
                    const senderId = mek.key.participant || chatId;

                    if (chatId === 'status@broadcast') {
                        await handleStatus(XeonBotInc, chatUpdate);
                        return;
                    }

                    try {
                        await handleMessages(XeonBotInc, chatUpdate, true);
                    } catch (err) {
                        console.error("Error in handleMessages:", err);
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

            XeonBotInc.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        try {
                            rmSync(sessionDir, { recursive: true, force: true });
                        } catch { }
                    } else {
                        setTimeout(() => startUserBotInstance(sessionDir), 5000);
                    }
                }
            });

            XeonBotInc.ev.on('creds.update', (await useMultiFileAuthState(sessionDir)).saveCreds);
        }

        // Load Main Bot Session from .env or default session folder
        async function startMainBot() {
            const sessionDir = './session';
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }
            
            if (process.env.SESSION_ID) {
                try {
                    let sessionId = process.env.SESSION_ID;
                    sessionId = sessionId.replace(/^["']|["']$/g, '');
                    if (sessionId.includes(':~')) {
                        sessionId = sessionId.split(':~')[1];
                    }
                    const sessionData = Buffer.from(sessionId, 'base64').toString('utf-8');
                    const credsPath = path.join(sessionDir, 'creds.json');
                    fs.writeFileSync(credsPath, sessionData);
                    console.log('✅ Session loaded from .env SESSION_ID');
                } catch (err) {
                    console.log('⚠️ Could not decode SESSION_ID from .env:', err.message);
                }
            }

            // Also auto-load any existing user sessions in the session directory
            try {
                const subDirs = fs.readdirSync(sessionDir, { withFileTypes: true });
                for (const subDir of subDirs) {
                    if (subDir.isDirectory() && subDir.name.startsWith('user_')) {
                        const fullPath = path.join(sessionDir, subDir.name);
                        if (fs.existsSync(path.join(fullPath, 'creds.json'))) {
                            startUserBotInstance(fullPath);
                            console.log(`✅ Loaded existing user session: ${subDir.name}`);
                        }
                    }
                }
            } catch (e) {}

            await startUserBotInstance(sessionDir);
        }

        console.log(chalk.green('\n🤖 STARTING WHATSAPP CONNECTION...\n'));
        await startMainBot();
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
}
