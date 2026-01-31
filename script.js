const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

ffmpeg.setFfmpegPath(ffmpegPath);
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. NEW STABLE INSTANCES
const INSTANCES = [
    "https://invidious.asir.dev",
    "https://iv.melmac.space",
    "https://invidious.no-logs.com",
    "https://invidious.io.lol"
];

async function fetchFromInvidious(endpoint) {
    for (let base of INSTANCES) {
        try {
            console.log(`📡 Trying: ${base}`);
            const res = await fetch(`${base}/api/v1${endpoint}`, { signal: AbortSignal.timeout(6000) });
            const data = await res.json();
            if (data) return data;
        } catch (e) {
            console.log(`❌ ${base} failed`);
        }
    }
    throw new Error("All servers are busy. Try again in 10 seconds.");
}

// ✅ 2. PLAY ROUTE (With Extra Safety)
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No query");

    try {
        console.log(`🔍 Searching for: ${query}`);
        const searchResults = await fetchFromInvidious(`/search?q=${encodeURIComponent(query)}&type=video`);
        
        if (!searchResults || searchResults.length === 0) throw new Error("No results found");

        const videoId = searchResults[0].videoId;
        const videoData = await fetchFromInvidious(`/videos/${videoId}`);

        // Error handling for 'find'
        if (!videoData || !videoData.adaptiveFormats) {
            throw new Error("Stream data missing");
        }

        const audioStream = videoData.adaptiveFormats.find(f => f.type.includes("audio")) || videoData.formatStreams[0];

        if (!audioStream || !audioStream.url) throw new Error("No playable URL");

        res.setHeader("Content-Type", "audio/mpeg");
        ffmpeg(audioStream.url)
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

// ✅ 3. SUGGESTIONS & HOME (Keep as is)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/suggest", async (req, res) => {
    try {
        const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(req.query.q)}`);
        const data = await response.json();
        res.json(data[1].slice(0, 7));
    } catch (err) { res.json([]); }
});

app.listen(PORT, () => console.log(`🚀 Ready at ${PORT}`));
