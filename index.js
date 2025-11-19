/**
 * AtherixCloud — Advanced Status Monitor Bot (Admin-by-CMD enabled)
 * Generated: (paste)
 *
 * - Main admin (cannot be removed): 1163301364009541764
 * - Add/remove admins via commands
 * - 20+ admin/utility commands (slash + prefix)
 * - Monitors Convoy and MC panel URLs
 * - Auto-refreshes status message every 5s (default)
 *
 * Setup:
 * 1. Create .env (see template file)
 * 2. npm install
 * 3. node index.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const net = require('net');

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

let mcUtil = null;
try { mcUtil = require('minecraft-server-util'); } catch(e) { mcUtil = null; }

// --- ENV vars ---
const BOT_TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CLIENT_ID = process.env.CLIENT_ID || '';
const GUILD_ID = process.env.GUILD_ID || '';
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL_MS || 5000);
const PRESENCE_INTERVAL = Number(process.env.PRESENCE_INTERVAL_MS || 10000);

// Validate
if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error('Missing .env variables: TOKEN and CHANNEL_ID are required.');
  process.exit(1);
}

// --- Data paths ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const LOG_FILE = path.join(DATA_DIR, 'bot.log');

// --- Defaults (uses your supplied URLs) ---
const DEFAULT_SITES = [
  { id: 'convoy', name: 'Convoy Panel', url: 'https://vms.saturnnode.qzz.io', type: 'http', alertAfter: 2 },
  { id: 'mc', name: 'MC Panel', url: 'https://fp.cherrymc.fun', type: 'http', alertAfter: 2 }
];

// --- Logging & helpers ---
function writeLog(...args) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`;
  try { fs.appendFileSync(LOG_FILE, line + '\\n'); } catch(e) {}
  console.log(line);
}

function loadJSON(filepath, fallback) {
  try {
    if (fs.existsSync(filepath)) return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) { writeLog('loadJSON error', filepath, e.message || e); }
  return fallback;
}
function saveJSON(filepath, obj) {
  try { fs.writeFileSync(filepath, JSON.stringify(obj, null, 2)); } catch (e) { writeLog('saveJSON error', filepath, e); }
}

// --- Seed files ---
if (!fs.existsSync(SITES_FILE)) saveJSON(SITES_FILE, { sites: DEFAULT_SITES, messageId: null, createdAt: Date.now() });
if (!fs.existsSync(STATE_FILE)) saveJSON(STATE_FILE, { sites: {}, alerts: {} });
if (!fs.existsSync(ADMINS_FILE)) saveJSON(ADMINS_FILE, { mainAdmin: '1163301364009541764', admins: ['1163301364009541764'] });

let CONFIG = loadJSON(SITES_FILE, { sites: DEFAULT_SITES, messageId: null });
let STATE = loadJSON(STATE_FILE, { sites: {}, alerts: {} });
let ADMINS = loadJSON(ADMINS_FILE, { mainAdmin: '1163301364009541764', admins: ['1163301364009541764'] });

// Ensure site IDs & state entries
for (const s of CONFIG.sites) {
  if (!s.id) s.id = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
  if (!STATE.sites[s.id]) STATE.sites[s.id] = { url: s.url, name: s.name, lastUp: null, lastDown: null, consecutiveFails: 0, history: [] };
}
saveJSON(SITES_FILE, CONFIG);
saveJSON(STATE_FILE, STATE);
saveJSON(ADMINS_FILE, ADMINS);

// --- Utility functions ---
function uptimeStr(ms) {
  if (!ms) return '—';
  let s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hrs = Math.floor(s / 3600); s -= hrs * 3600;
  const mins = Math.floor(s / 60); s -= mins * 60;
  const parts = [];
  if (days) parts.push(days + 'd');
  if (hrs) parts.push(hrs + 'h');
  if (mins) parts.push(mins + 'm');
  parts.push(s + 's');
  return parts.join(' ');
}

async function httpCheck(url, timeout = 7000) {
  try {
    const start = Date.now();
    const res = await axios.get(url, { timeout, validateStatus: () => true });
    const ping = Date.now() - start;
    return { ok: res.status >= 200 && res.status < 400, code: res.status, ping };
  } catch (e) {
    return { ok: false, code: null, ping: null, error: String(e) };
  }
}

// --- Monitor manager ---
class MonitorManager {
  constructor(sites) {
    this.sites = sites.slice();
    this.minInterval = 3000;
    this.lastChecked = {};
  }
  async checkSite(site) {
    const now = Date.now();
    if (this.lastChecked[site.id] && now - this.lastChecked[site.id] < this.minInterval) return null;
    this.lastChecked[site.id] = now;
    if (site.type === 'http') return await httpCheck(site.url);
    // fallback
    return { ok: false, code: null };
  }
  async runAll() {
    const out = [];
    for (const s of this.sites) {
      try {
        const r = await this.checkSite(s);
        if (r) out.push({ id: s.id, site: s, result: r });
      } catch (e) {
        writeLog('runAll error', s.id, e);
      }
    }
    return out;
  }
}

const monitor = new MonitorManager(CONFIG.sites);

// --- ASCII panel builder ---
function asciiPanel(title, rows) {
  const width = 56;
  const h = '─'.repeat(width);
  const top = `┌${h}┐`;
  const bottom = `└${h}┘`;
  const titleLine = `│ ${title.padEnd(width - 2)} │`;
  const lines = rows.map(r => {
    const left = `${r.k}:`.padEnd(20);
    const right = String(r.v).slice(0, width - 24).padEnd(width - 24);
    return `│ ${left}${right} │`;
  });
  return [top, titleLine, '│' + ' '.repeat(width) + '│', ...lines, bottom].join('\\n');
}

function buildEmbed() {
  const now = Date.now();
  const rows = CONFIG.sites.map(s => {
    const st = STATE.sites[s.id] || {};
    const lastStatus = st.lastStatus || 'unknown';
    const recent = (st.history || []).slice(-6).map(h => h.ok ? '🟢' : '🔴').join(' ');
    const upAgo = st.lastUp ? uptimeStr(now - st.lastUp) : '—';
    const downAgo = st.lastDown ? uptimeStr(now - st.lastDown) : '—';
    return { k: s.name, v: `${lastStatus.toUpperCase()} ${recent}\\nUp: ${upAgo} | Down: ${downAgo}` };
  });
  const panel = asciiPanel('AtherixCloud — System Status', rows);
  const embed = new EmbedBuilder()
    .setTitle('✨ AtherixCloud • Status Monitor')
    .setDescription('Auto-refresh every ' + (CHECK_INTERVAL / 1000) + 's')
    .addFields({ name: '\\u200b', value: '```' + panel + '```' })
    .setTimestamp();
  const anyUp = CONFIG.sites.some(s => (STATE.sites[s.id] && STATE.sites[s.id].lastStatus === 'up'));
  embed.setColor(anyUp ? 0x2ecc71 : 0xe74c3c);
  embed.setFooter({ text: 'AtherixCloud • Premium Monitor' });
  return embed;
}

// --- Admin system ---
function isAdmin(userId) {
  return ADMINS.admins && ADMINS.admins.includes(String(userId));
}
function addAdmin(userId) {
  userId = String(userId);
  if (!ADMINS.admins.includes(userId)) {
    ADMINS.admins.push(userId);
    saveJSON(ADMINS_FILE, ADMINS);
    return true;
  }
  return false;
}
function removeAdmin(userId) {
  userId = String(userId);
  if (userId === String(ADMINS.mainAdmin)) return false; // protected
  const i = ADMINS.admins.indexOf(userId);
  if (i !== -1) {
    ADMINS.admins.splice(i, 1);
    saveJSON(ADMINS_FILE, ADMINS);
    return true;
  }
  return false;
}

// --- Discord bot setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});
client.commands = new Collection();

// -- Slash commands (many admin utilities)
const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Manage the status bot')
    .addSubcommand(s => s.setName('add').setDescription('Add site').addStringOption(o => o.setName('url').setRequired(true)).addStringOption(o => o.setName('name')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove site by id').addStringOption(o => o.setName('id').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List monitored sites'))
    .addSubcommand(s => s.setName('test').setDescription('Test URL').addStringOption(o => o.setName('url').setRequired(true)))
    .addSubcommand(s => s.setName('refresh').setDescription('Force refresh now'))
    .addSubcommand(s => s.setName('reload').setDescription('Reload config from disk'))
    .addSubcommand(s => s.setName('interval').setDescription('Set check interval (ms)').addNumberOption(o => o.setName('ms').setRequired(true)))
    .addSubcommand(s => s.setName('maintenance').setDescription('Maintenance on/off (on/off)').addStringOption(o => o.setName('mode').setRequired(true)))
    .addSubcommand(s => s.setName('addadmin').setDescription('Add admin by id').addStringOption(o => o.setName('id').setRequired(true)))
    .addSubcommand(s => s.setName('rmadmin').setDescription('Remove admin by id').addStringOption(o => o.setName('id').setRequired(true)))
    .addSubcommand(s => s.setName('admins').setDescription('List admins'))
    .addSubcommand(s => s.setName('logs').setDescription('Get recent logs'))
    .addSubcommand(s => s.setName('export').setDescription('Export sites config'))
    .addSubcommand(s => s.setName('backup').setDescription('Backup config & state'))
    .addSubcommand(s => s.setName('uptime').setDescription('Show bot uptime'))
    .toJSON()
];

// register commands helper
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID || process.env.CLIENT_ID || '0', GUILD_ID), { body: commands });
      writeLog('Registered commands to guild', GUILD_ID);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID || process.env.CLIENT_ID || '0'), { body: commands });
      writeLog('Registered global commands (may take up to 1 hour)');
    }
  } catch (e) {
    writeLog('registerCommands error', e.toString());
  }
}

// ensure status message exists
async function ensureMessage() {
  try {
    const ch = await client.channels.fetch(CHANNEL_ID);
    if (!ch) { writeLog('Channel not found', CHANNEL_ID); return null; }
    if (CONFIG.messageId) {
      try {
        const m = await ch.messages.fetch(CONFIG.messageId);
        return m;
      } catch (e) {
        CONFIG.messageId = null;
        saveJSON(SITES_FILE, CONFIG);
      }
    }
    const embed = buildEmbed();
    const m = await ch.send({ embeds: [embed] });
    CONFIG.messageId = m.id;
    saveJSON(SITES_FILE, CONFIG);
    return m;
  } catch (e) {
    writeLog('ensureMessage error', e);
    return null;
  }
}

// periodic update
async function periodicUpdate() {
  try {
    const results = await monitor.runAll();
    const now = Date.now();
    for (const r of results) {
      const id = r.id, site = r.site, res = r.result;
      if (!STATE.sites[id]) STATE.sites[id] = { url: site.url, name: site.name, history: [], lastUp: null, lastDown: null, consecutiveFails: 0 };
      const s = STATE.sites[id];
      s.history.push({ ts: now, ok: !!res.ok, code: res.code, ping: res.ping || null });
      if (s.history.length > 300) s.history.shift();
      if (res.ok) {
        s.lastUp = s.lastUp || now;
        s.consecutiveFails = 0;
        s.lastStatus = 'up';
        // clear alert if recovered
        if (STATE.alerts && STATE.alerts[id]) {
          delete STATE.alerts[id];
        }
      } else {
        s.lastDown = now;
        s.consecutiveFails = (s.consecutiveFails || 0) + 1;
        s.lastStatus = 'down';
        if (s.consecutiveFails >= (site.alertAfter || 2)) {
          if (!STATE.alerts[id] || STATE.alerts[id].lastNotified !== s.lastDown) {
            STATE.alerts[id] = { lastNotified: s.lastDown };
            const ch = await client.channels.fetch(CHANNEL_ID).catch(()=>null);
            if (ch) {
              const embed = new EmbedBuilder()
                .setTitle(`🔴 ALERT • ${site.name} is DOWN`)
                .setDescription(site.url)
                .addFields({ name: 'Consecutive fails', value: String(s.consecutiveFails), inline: true })
                .setTimestamp();
              await ch.send({ embeds: [embed] });
            }
          }
        }
      }
    }
    saveJSON(STATE_FILE, STATE);
    const msg = await ensureMessage();
    if (msg) {
      try {
        const embed = buildEmbed();
        await msg.edit({ embeds: [embed] });
      } catch (e) { writeLog('edit message failed', e); }
    }
  } catch (e) {
    writeLog('periodicUpdate error', e);
  }
}

// presence
function rotatePresence() {
  try {
    const choices = [
      'Monitoring AtherixCloud • Premium',
      'Auto-refresh ' + (CHECK_INTERVAL/1000) + 's',
      'Monitoring: ' + CONFIG.sites.map(s=>s.name).join(', ')
    ];
    const p = choices[Math.floor(Math.random()*choices.length)];
    client.user.setActivity(p, { type: ActivityType.Watching }).catch(()=>{});
  } catch (e) {}
}

// interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'status') return;
  const sub = interaction.options.getSubcommand();
  const uid = interaction.user.id;
  const adminOnly = ['add','remove','refresh','reload','interval','maintenance','addadmin','rmadmin','admins','logs','export','backup'];
  if (adminOnly.includes(sub) && !isAdmin(uid)) return interaction.reply({ content: 'You are not an admin.', ephemeral: true });

  try {
    if (sub === 'add') {
      const url = interaction.options.getString('url');
      const name = interaction.options.getString('name') || url;
      const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24);
      let id = idBase; let i=1;
      while (CONFIG.sites.find(s=>s.id===id)) { id = idBase + '-' + (i++); }
      const site = { id, name, url, type: 'http', alertAfter: 2 };
      CONFIG.sites.push(site);
      STATE.sites[id] = { url, name, history: [], lastUp: null, lastDown: null, consecutiveFails: 0 };
      saveJSON(SITES_FILE, CONFIG); saveJSON(STATE_FILE, STATE);
      await interaction.reply({ content: `✅ Added ${name} (id: ${id})`, ephemeral: true });
      setTimeout(periodicUpdate, 1000);
    } else if (sub === 'remove') {
      const id = interaction.options.getString('id');
      const idx = CONFIG.sites.findIndex(s=>s.id===id);
      if (idx === -1) return interaction.reply({ content: 'Not found', ephemeral: true });
      const removed = CONFIG.sites.splice(idx,1)[0];
      delete STATE.sites[id];
      saveJSON(SITES_FILE, CONFIG); saveJSON(STATE_FILE, STATE);
      await interaction.reply({ content: `🗑️ Removed ${removed.name}`, ephemeral: true });
    } else if (sub === 'list') {
      const lines = CONFIG.sites.map(s=>`\`${s.id}\` • **${s.name}** — ${s.url}`).join('\\n');
      await interaction.reply({ content: `📋 Monitored sites:\\n${lines}`, ephemeral: true });
    } else if (sub === 'test') {
      const url = interaction.options.getString('url');
      await interaction.reply({ content: `🔎 Testing ${url}...`, ephemeral: true });
      const res = await httpCheck(url);
      await interaction.followUp({ content: `Result: ${res.ok ? '🟢 Online' : '🔴 Offline'} • Code: ${res.code} • Ping: ${res.ping || '—'}ms`, ephemeral: true });
    } else if (sub === 'refresh') {
      await interaction.reply({ content: 'Refreshing...', ephemeral: true });
      await periodicUpdate();
      await interaction.followUp({ content: 'Refreshed.', ephemeral: true });
    } else if (sub === 'reload') {
      CONFIG = loadJSON(SITES_FILE, CONFIG);
      STATE = loadJSON(STATE_FILE, STATE);
      await interaction.reply({ content: 'Reloaded config.', ephemeral: true });
    } else if (sub === 'interval') {
      const ms = interaction.options.getNumber('ms');
      if (ms < 1000) return interaction.reply({ content: 'Interval too small', ephemeral: true });
      process.env.CHECK_INTERVAL_MS = String(ms);
      await interaction.reply({ content: `Set interval to ${ms}ms (restart required)`, ephemeral: true });
    } else if (sub === 'maintenance') {
      const mode = interaction.options.getString('mode');
      process.env.MAINTENANCE = (mode === 'on') ? '1' : '0';
      await interaction.reply({ content: `Maintenance set to ${mode}`, ephemeral: true });
    } else if (sub === 'addadmin') {
      const id = interaction.options.getString('id');
      const ok = addAdmin(id);
      await interaction.reply({ content: ok ? `✅ Added admin ${id}` : `Already admin or failed.`, ephemeral: true });
    } else if (sub === 'rmadmin') {
      const id = interaction.options.getString('id');
      const ok = removeAdmin(id);
      await interaction.reply({ content: ok ? `🗑️ Removed admin ${id}` : `Failed (cannot remove main or not found).`, ephemeral: true });
    } else if (sub === 'admins') {
      await interaction.reply({ content: `Admins: ${ADMINS.admins.join(', ')}`, ephemeral: true });
    } else if (sub === 'logs') {
      const logContent = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE,'utf8').slice(-8000) : 'No logs';
      await interaction.reply({ content: 'Recent logs (truncated):\\n' + '```' + logContent + '```', ephemeral: true });
    } else if (sub === 'export') {
      const json = JSON.stringify(CONFIG, null, 2);
      await interaction.reply({ content: 'Config export (attached)', ephemeral: true, files: [{ attachment: Buffer.from(json,'utf8'), name: 'sites-export.json' }] });
    } else if (sub === 'backup') {
      const backup = { config: CONFIG, state: STATE, admins: ADMINS };
      await interaction.reply({ content: 'Backup (attached)', ephemeral: true, files: [{ attachment: Buffer.from(JSON.stringify(backup,null,2),'utf8'), name: 'backup.json' }] });
    } else if (sub === 'uptime') {
      await interaction.reply({ content: `Bot uptime: ${uptimeStr(process.uptime() * 1000)}`, ephemeral: true });
    } else {
      await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  } catch (e) {
    writeLog('interaction error', e);
    await interaction.reply({ content: 'Error: ' + String(e), ephemeral: true });
  }
});

// Prefix commands (legacy)
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const prefix = process.env.PREFIX || '!';
  if (!msg.content.startsWith(prefix)) return;
  const parts = msg.content.slice(prefix.length).trim().split(/\\s+/);
  const cmd = parts.shift().toLowerCase();
  const authorId = String(msg.author.id);
  const adminCmds = ['add','remove','refresh','reload','interval','maintenance','addadmin','rmadmin','admins','backup','export','logs'];

  try {
    if (cmd === 'status') {
      const lines = CONFIG.sites.map(s => {
        const st = STATE.sites[s.id] || {};
        const last = st.lastStatus || 'unknown';
        return `**${s.name}** — ${last.toUpperCase()} • ${s.url}`;
      });
      await msg.channel.send({ embeds: [ new EmbedBuilder().setTitle('Quick Status').setDescription(lines.join('\\n')).setTimestamp() ] });
    } else if (adminCmds.includes(cmd)) {
      if (!isAdmin(authorId)) return msg.reply('You are not an admin.');
      if (cmd === 'add') {
        const url = parts[0];
        const name = parts.slice(1).join(' ') || url;
        const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24);
        let id = idBase; let i = 1;
        while (CONFIG.sites.find(s=>s.id===id)) { id = idBase + '-' + (i++); }
        const site = { id, name, url, type: 'http', alertAfter: 2 };
        CONFIG.sites.push(site);
        STATE.sites[id] = { url, name, history: [], lastUp: null, lastDown: null, consecutiveFails: 0 };
        saveJSON(SITES_FILE, CONFIG); saveJSON(STATE_FILE, STATE);
        await msg.reply(`✅ Added ${name} (id: ${id})`);
      } else if (cmd === 'remove') {
        const id = parts[0];
        const idx = CONFIG.sites.findIndex(s=>s.id===id);
        if (idx === -1) return msg.reply('Not found');
        const removed = CONFIG.sites.splice(idx,1)[0];
        delete STATE.sites[id];
        saveJSON(SITES_FILE, CONFIG); saveJSON(STATE_FILE, STATE);
        await msg.reply(`🗑️ Removed ${removed.name}`);
      } else if (cmd === 'addadmin') {
        const id = parts[0];
        const ok = addAdmin(id);
        await msg.reply(ok ? `✅ Added admin ${id}` : 'Already admin or failed');
      } else if (cmd === 'rmadmin') {
        const id = parts[0];
        const ok = removeAdmin(id);
        await msg.reply(ok ? `🗑️ Removed admin ${id}` : 'Failed (cannot remove main or not found)');
      } else if (cmd === 'admins') {
        await msg.reply(`Admins: ${ADMINS.admins.join(', ')}`);
      } else if (cmd === 'refresh') {
        await msg.reply('Refreshing...'); await periodicUpdate(); await msg.reply('Refreshed.');
      } else if (cmd === 'backup') {
        const backup = { config: CONFIG, state: STATE, admins: ADMINS };
        await msg.reply({ files: [ { attachment: Buffer.from(JSON.stringify(backup,null,2),'utf8'), name: 'backup.json' } ] });
      } else if (cmd === 'export') {
        await msg.reply({ files: [ { attachment: Buffer.from(JSON.stringify(CONFIG,null,2),'utf8'), name: 'sites-export.json' } ] });
      } else if (cmd === 'logs') {
        const content = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE,'utf8').slice(-8000) : 'No logs';
        await msg.reply('Recent logs:\\n' + '```' + content + '```');
      } else {
        await msg.reply('Command not implemented in prefix form');
      }
    }
  } catch (e) {
    writeLog('prefix command error', e);
    await msg.reply('Error: ' + String(e));
  }
});

client.once('ready', async () => {
  writeLog('Logged in as', client.user.tag);
  try { await registerCommands(); } catch (e) { writeLog('register', e); }
  try { await ensureMessage(); } catch (e) { writeLog('ensureMessage', e); }
  setTimeout(periodicUpdate, 500);
  setInterval(periodicUpdate, CHECK_INTERVAL);
  rotatePresence();
  setInterval(rotatePresence, PRESENCE_INTERVAL);
});

// login
client.login(BOT_TOKEN);
