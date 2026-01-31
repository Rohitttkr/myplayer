const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

ffmpeg.setFfmpegPath(ffmpegPath);
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. HOME ROUTE
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ✅ 2. RELIABLE INSTANCES (Sorted by stability)
const INSTANCES = [
    "https://invidious.flokinet.to",
    "https://invidious.sethforprivacy.com",
    "https://inv.vern.cc",
    "https://invidious.lunar.icu"
];

// Helper: Fetch with Timeout & Failover
async function fetchSafe(endpoint) {
    for (let base of INSTANCES) {
        try {
            console.log(`📡 Trying Instance: ${base}`);
            const response = await fetch(`${base}/api/v1${endpoint}`, { signal: AbortSignal.timeout(5000) });
            const text = await response.text();
            
            // Check if response is actually JSON
            if (text.startsWith("{") || text.startsWith("[")) {
                return JSON.parse(text);
            }
        } catch (e) {
            console.log(`⚠️ Instance ${base} failed, trying next...`);
        }
    }
    throw new Error("Sare servers busy hain. Please 2 minute baad try karein.");
}

// ✅ 3. SUGGESTIONS
app.get("/suggest", async (req, res) => {
    try {
        const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(req.query.q)}`);
        const data = await response.json();
        res.json(data[1].slice(0, 7));
    } catch (err) { res.json([]); }
});

// ✅ 4. PLAY STREAM ROUTE
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("Gaana search karein");

    try {
        // Step 1: Search
        const searchData = await fetchSafe(`/search?q=${encodeURIComponent(query)}&type=video`);
        if (!searchData || searchData.length === 0) throw new Error("No results");

        const videoId = searchData[0].videoId;
        
        // Step 2: Get Stream URL directly from Invidious
        const videoData = await fetchSafe(`/videos/${videoId}`);
        const audioFormat = videoData.adaptiveFormats.find(f => f.type.includes("audio/webm") || f.type.includes("audio/mp4"));
        
        if (!audioFormat) throw new Error("Audio stream not found");

        console.log("🎵 Streaming started via Invidious...");

        res.setHeader("Content-Type", "audio/mpeg");
        ffmpeg(audioFormat.url)
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("error", (err) => console.log("Stream Error:", err.message))
            .pipe(res, { end: true });

    } catch (err) {
        console.error("❌ Final Error:", err.message);
        res.status(500).send(err.message);
    }
});

// ✅ 5. DOWNLOAD ROUTE
app.get("/download", async (req, res) => {
    try {
        const query = req.query.q;
        const searchData = await fetchSafe(`/search?q=${encodeURIComponent(query)}&type=video`);
        const videoId = searchData[0].videoId;
        const videoData = await fetchSafe(`/videos/${videoId}`);
        const audioUrl = videoData.adaptiveFormats.find(f => f.type.includes("audio")).url;

        res.setHeader("Content-Disposition", `attachment; filename="song.mp3"`);
        ffmpeg(audioUrl).audioCodec("libmp3lame").format("mp3").pipe(res);
    } catch (err) { res.status(500).send("Download error"); }
});

app.listen(PORT, () => console.log(`🚀 Music App Ready: http://localhost:${PORT}`));
