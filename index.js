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
    
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.log(`\n⚠️ Bot process stopped (Code: ${code}). Restarting in 2 seconds...\n`);
        setTimeout(() => {
            cluster.fork();
        }, 2000);
    });

} else {
    // ============================================
    // MODULE UPDATER & CHANGELOG TRACKER
    // ============================================
    async function downloadAndExtractModules() {
        const settingsPath = path.join(__dirname, 'settings.js');
        const modulesInstalledFlag = path.join(__dirname, '.modules_installed');
        
        if (!fs.existsSync(settingsPath)) return { success: false, updatedFiles: [] };
        
        const settings = require('./settings');
        const zipUrl = settings.updateZipUrl;
        if (!zipUrl) return { success: false, updatedFiles: [] };

        const TEMP_DIR = path.join(__dirname, 'temp_update');
        const ZIP_FILE = path.join(TEMP_DIR, 'modules.zip');
        const EXTRACT_DIR = path.join(TEMP_DIR, 'extracted');

        let updatedFilesList = [];

        try {
            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

            const response = await axios({
                method: 'get',
                url: zipUrl,
                responseType: 'arraybuffer',
                timeout: 120000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            fs.writeFileSync(ZIP_FILE, response.data);
            if (fs.existsSync(EXTRACT_DIR)) fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
            fs.mkdirSync(EXTRACT_DIR, { recursive: true });

            execSync(`unzip -o "${ZIP_FILE}" -d "${EXTRACT_DIR}"`, { stdio: 'pipe' });

            const extractedFolders = fs.readdirSync(EXTRACT_DIR);
            const moduleFolder = extractedFolders.find(f => f.includes('ZORO-MD-MODULES'));
            if (!moduleFolder) return { success: false, updatedFiles: [] };

            const sourcePath = path.join(EXTRACT_DIR, moduleFolder);
            const basePath = __dirname;

            const foldersToSync = ['lib', 'plugins', 'data', 'media'];
            const filesToSync = ['main.js', 'config.js'];

            for (const folder of foldersToSync) {
                const sourceFolder = path.join(sourcePath, folder);
                const destFolder = path.join(basePath, folder);
                if (fs.existsSync(sourceFolder)) {
                    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                    
                    // Track changed files inside folders (like plugins/song.js, plugins/menu.js etc.)
                    const checkFilesRecursive = (srcDir, dstDir, relativeBase) => {
                        const items = fs.readdirSync(srcDir);
                        for (const item of items) {
                            const srcPath = path.join(srcDir, item);
                            const dstPath = path.join(dstDir, item);
                            const relPath = path.join(relativeBase, item);
                            
                            if (fs.statSync(srcPath).isDirectory()) {
                                if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
                                checkFilesRecursive(srcPath, dstPath, relPath);
                            } else {
                                // Check if file is new or modified
                                if (!fs.existsSync(dstPath) || fs.readFileSync(srcPath).toString() !== fs.readFileSync(dstPath).toString()) {
                                    updatedFilesList.push(relPath);
                                }
                            }
                        }
                    };
                    checkFilesRecursive(sourceFolder, destFolder, folder);
                    fs.cpSync(sourceFolder, destFolder, { recursive: true, force: true });
                }
            }

            for (const file of filesToSync) {
                const sourceFile = path.join(sourcePath, file);
                const destFile = path.join(basePath, file);
                if (fs.existsSync(sourceFile)) {
                    if (!fs.existsSync(destFile) || fs.readFileSync(sourceFile).toString() !== fs.readFileSync(destFile).toString()) {
                        updatedFilesList.push(file);
                    }
                    fs.copyFileSync(sourceFile, destFile);
                }
            }

            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            fs.writeFileSync(modulesInstalledFlag, new Date().toISOString());
            return { success: true, updatedFiles: updatedFilesList };
        } catch (error) {
            if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            return { success: false, updatedFiles: [] };
        }
    }

    // ============================================
    // FFMPEG CHECK AND AUTO-INSTALL
    // ============================================
    async function checkAndInstallFFmpeg() {
        const ffmpegDir = path.join(__dirname, 'ffmpeg_bin');
        const ffmpegPath = path.join(ffmpegDir, 'ffmpeg');
        const ffprobePath = path.join(ffmpegDir, 'ffprobe');
        
        try {
            execSync('ffmpeg -version', { stdio: 'pipe', encoding: 'utf8' });
            return true;
        } catch (error) {}
        
        if (fs.existsSync(ffmpegPath)) {
            process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
            return true;
        }
        
        try {
            if (!fs.existsSync(ffmpegDir)) fs.mkdirSync(ffmpegDir, { recursive: true });
            const FFMPEG_URL = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
            const tempFile = path.join(__dirname, 'ffmpeg_temp.tar.xz');
            const extractDir = path.join(__dirname, 'ffmpeg_extract');
            
            const response = await axios({ method: 'get', url: FFMPEG_URL, responseType: 'arraybuffer', timeout: 300000 });
            fs.writeFileSync(tempFile, response.data);
            
            if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
            fs.mkdirSync(extractDir, { recursive: true });
            execSync(`tar -xf "${tempFile}" -C "${extractDir}"`, { stdio: 'pipe' });
            
            const extractedFolders = fs.readdirSync(extractDir);
            const ffmpegFolder = extractedFolders.find(f => f.includes('ffmpeg'));
            
            if (ffmpegFolder) {
                const srcFFmpeg = path.join(extractDir, ffmpegFolder, 'ffmpeg');
                const srcFFprobe = path.join(extractDir, ffmpegFolder, 'ffprobe');
                if (fs.existsSync(srcFFmpeg)) { fs.copyFileSync(srcFFmpeg, ffmpegPath); fs.chmodSync(ffmpegPath, '755'); }
                if (fs.existsSync(srcFFprobe)) { fs.copyFileSync(srcFFprobe, ffprobePath); fs.chmodSync(ffprobePath, '755'); }
            }
            fs.unlinkSync(tempFile);
            fs.rmSync(extractDir, { recursive: true, force: true });
            process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
            return true;
        } catch (error) {
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
        global.activeSessions = new Map();

        // Express Endpoint for Pairing
        app.post('/pair', async (req, res) => {
            const { phone, userId } = req.body;
            if (!phone || !userId) {
                return res.status(400).json({ status: false, error: 'Phone number and UserId are required' });
            }

            try {
                let phoneNum = phone.replace(/[^0-9]/g, '');
                const sessionDir = path.join(__dirname, 'sessions', `session_${userId}`);

                if (!fs.existsSync(sessionDir)) {
                    fs.mkdirSync(sessionDir, { recursive: true });
                }

                const userSocket = await createWhatsAppSession(sessionDir, phoneNum);
                
                let retries = 0;
                let code = null;
                while (retries < 15) {
                    try {
                        code = await userSocket.requestPairingCode(phoneNum);
                        if (code) break;
                    } catch (e) {}
                    await new Promise(r => setTimeout(r, 1500));
                    retries++;
                }

                if (code) {
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    return res.json({ status: true, code: code });
                } else {
                    return res.status(500).json({ status: false, error: 'Failed to generate pairing code.' });
                }
            } catch (err) {
                return res.status(500).json({ status: false, error: err.message });
            }
        });

        // Endpoint to check & trigger global update menu notifications to all active users
        app.post('/check-updates', async (req, res) => {
            const { success, updatedFiles } = await downloadAndExtractModules();
            if (success && updatedFiles.length > 0) {
                let fileListText = updatedFiles.map(file => `📁 \`\`\`${file}\`\`\``).join('\n');
                
                let updateMenu = 
                    `┏━━━❐ *ZORO MD UPDATE NOTIFICATION* ❐━━━\n` +
                    `┃\n` +
                    `┃ ✨ *New updates are available in the repository!*\n` +
                    `┃\n` +
                    `┃ 📋 *Updated Plugins & Files:*\n` +
                    `${fileListText}\n` +
                    `┃\n` +
                    `┃ 🛠️ *How to apply:*\n` +
                    `┃ Type \`.update\` in your chat to apply these changes instantly without losing connection.\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                // Send this English update menu to all active user sessions
                for (const [identifier, sock] of global.activeSessions.entries()) {
                    try {
                        const botNumber = identifier.includes('@') ? identifier : identifier + '@s.whatsapp.net';
                        await sock.sendMessage(botNumber, { text: updateMenu });
                    } catch (e) {}
                }
                return res.json({ status: true, message: 'Update menu notification broadcasted successfully!' });
            }
            res.json({ status: false, message: 'No new updates found.' });
        });

        app.get('/', (req, res) => res.send('Zoro MD Multi-Session Bot is Alive!'));
        app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

        // Spawn Telegram Pairing Bot
        if (cluster.isWorker && fs.existsSync(path.join(__dirname, 'pair.js'))) {
            try {
                const telegramProcess = spawn('node', ['pair.js']);
                telegramProcess.stdout.on('data', (data) => console.log(`[Telegram Bot]: ${data.toString().trim()}`));
                telegramProcess.stderr.on('data', (data) => console.error(`[Telegram Bot Error]: ${data.toString().trim()}`));
            } catch (err) {}
        }

        await checkAndInstallFFmpeg();
        await downloadAndExtractModules();

        require('./settings');
        const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
        const { 
            default: makeWASocket, 
            useMultiFileAuthState, 
            DisconnectReason, 
            fetchLatestBaileysVersion, 
            makeCacheableSignalKeyStore 
        } = require("@whiskeysockets/baileys");
        const NodeCache = require("node-cache");
        const pino = require("pino");
        const store = require('./lib/lightweight_store');

        store.readFromFile();
        const settings = require('./settings');
        setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

        // Function to create/restore individual user WhatsApp sessions
        async function createWhatsAppSession(sessionDir, identifier) {
            let { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            const msgRetryCounterCache = new NodeCache();

            const sock = makeWASocket({
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
                syncFullHistory: true,
                msgRetryCounterCache,
            });

            global.activeSessions.set(identifier, sock);
            store.bind(sock.ev);

            sock.ev.on('messages.upsert', async chatUpdate => {
                try {
                    const mek = chatUpdate.messages[0];
                    if (!mek.message) return;
                    mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                    
                    // Individual .update command handler
                    const textMessage = mek.message.conversation || mek.message.extendedTextMessage?.text;
                    if (textMessage && textMessage.trim() === '.update') {
                        const remoteJid = mek.key.remoteJid;
                        await sock.sendMessage(remoteJid, { text: '🔄 Downloading latest updates for your personal bot session...' });
                        const { success } = await downloadAndExtractModules();
                        if (success) {
                            await sock.sendMessage(remoteJid, { text: '✅ Successfully updated! All plugins and commands have been updated to the latest version.' });
                        } else {
                            await sock.sendMessage(remoteJid, { text: '❌ Update failed or no new changes found.' });
                        }
                        return;
                    }

                    if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                        await handleStatus(sock, chatUpdate);
                        return;
                    }
                    await handleMessages(sock, chatUpdate, true);
                } catch (err) {}
            });

            sock.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
                    } else {
                        setTimeout(() => createWhatsAppSession(sessionDir, identifier), 5000);
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('group-participants.update', async (update) => {
                await handleGroupParticipantUpdate(sock, update);
            });

            return sock;
        }

        // Auto-restore existing sessions on bot restart
        const sessionsBasePath = path.join(__dirname, 'sessions');
        if (fs.existsSync(sessionsBasePath)) {
            const existingFolders = fs.readdirSync(sessionsBasePath);
            for (const folder of existingFolders) {
                if (folder.startsWith('session_')) {
                    const sessionDir = path.join(sessionsBasePath, folder);
                    if (fs.existsSync(path.join(sessionDir, 'creds.json'))) {
                        createWhatsAppSession(sessionDir, folder.replace('session_', '')).catch(() => {});
                    }
                }
            }
        }
    }

    startBot().catch(error => {
        console.error('Fatal error:', error);
    });
}
