require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { TikTokLiveConnection, SignConfig } = require('tiktok-live-connector');
const axios = require('axios');

const {
  DISCORD_TOKEN,
  CHANNEL_ID,
  TIKTOK_USERNAME,
  SIGN_API_KEY,
  CHECK_INTERVAL_MS = 120000,
  PORT = 3000,
} = process.env;

if (!DISCORD_TOKEN || !CHANNEL_ID || !TIKTOK_USERNAME) {
  console.error('Thiếu DISCORD_TOKEN / CHANNEL_ID / TIKTOK_USERNAME trong biến môi trường');
  process.exit(1);
}

// Nếu có API key Euler Stream (free tại eulerstream.com) thì dùng, giúp ổn định hơn
if (SIGN_API_KEY) {
  SignConfig.apiKey = SIGN_API_KEY;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let liveMessageId = null;
let lastVideoId = null;

// ---------------- Giữ Render free tier không ngủ ----------------
const app = express();
app.get('/', (req, res) => res.send('Bot dang chay'));
app.listen(PORT, () => console.log(`Web server chạy ở port ${PORT}`));

// ---------------- Theo dõi LIVE ----------------
function startLiveWatcher() {
  const tiktokLive = new TikTokLiveConnection(TIKTOK_USERNAME);
  let reconnectTimer = null;

  const tryConnect = () => {
    tiktokLive.connect().catch(() => {
      reconnectTimer = setTimeout(tryConnect, 30000); // chưa live, thử lại sau 30s
    });
  };

  tiktokLive.on('connected', async () => {
    console.log(`[LIVE] ${TIKTOK_USERNAME} đang live`);
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const liveUrl = `https://www.tiktok.com/@${TIKTOK_USERNAME}/live`;
      const msg = await channel.send(`✅ **${TIKTOK_USERNAME}** đang LIVE!\n${liveUrl}`);
      liveMessageId = msg.id;
    } catch (err) {
      console.error('Lỗi gửi thông báo live:', err.message);
    }
  });

  tiktokLive.on('streamEnd', async () => {
    console.log(`[LIVE] ${TIKTOK_USERNAME} đã hết live`);
    try {
      if (liveMessageId) {
        const channel = await client.channels.fetch(CHANNEL_ID);
        const msg = await channel.messages.fetch(liveMessageId).catch(() => null);
        if (msg) {
          const newContent = msg.content
            .replace('✅', '❌')
            .replace('đang LIVE!', 'đã kết thúc live.');
          await msg.edit(newContent);
        }
        liveMessageId = null;
      }
    } catch (err) {
      console.error('Lỗi cập nhật tin nhắn live:', err.message);
    } finally {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(tryConnect, 30000);
    }
  });

  tiktokLive.on('disconnected', () => {
    // phòng trường hợp mất kết nối ngoài ý muốn (không phải do hết live)
    if (!reconnectTimer) reconnectTimer = setTimeout(tryConnect, 30000);
  });

  tryConnect();
}

// ---------------- Theo dõi VIDEO MỚI ----------------
async function fetchLatestVideo(username) {
  const res = await axios.get(`https://www.tiktok.com/@${username}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    },
  });

  const match = res.data.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return null;

  const json = JSON.parse(match[1]);
  const scope = json?.__DEFAULT_SCOPE__ || {};
  const items =
    scope['webapp.user-detail']?.itemList ||
    scope['webapp.user-post']?.itemList ||
    [];

  if (!items.length) return null;

  const video = items[0];
  return {
    id: video.id,
    url: `https://www.tiktok.com/@${username}/video/${video.id}`,
  };
}

async function checkNewVideo() {
  try {
    const latest = await fetchLatestVideo(TIKTOK_USERNAME);
    if (!latest) return;

    if (lastVideoId === null) {
      // lần đầu chạy: chỉ lưu mốc, không gửi (tránh spam video cũ)
      lastVideoId = latest.id;
      return;
    }

    if (latest.id !== lastVideoId) {
      lastVideoId = latest.id;
      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(`🎬 **${TIKTOK_USERNAME}** vừa đăng video mới!\n${latest.url}`);
    }
  } catch (err) {
    console.error('Lỗi check video mới:', err.message);
  }
}

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
  startLiveWatcher();
  checkNewVideo();
  setInterval(checkNewVideo, Number(CHECK_INTERVAL_MS));
});

client.login(DISCORD_TOKEN);
