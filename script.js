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

// ✅ 2. HELPER: Multiple Piped Instances (Taki error na aaye)
const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.drgns.space"
];

async function fetchFromPiped(endpoint) {
    for (let instance of PIPED_INSTANCES) {
        try {
            const response = await fetch(`${instance}${endpoint}`);
            if (response.ok) return await response.json();
        } catch (e) { console.log(`Retry: Instance ${instance} failed.`); }
    }
    throw new Error("All instances failed");
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
    if (!query) return res.status(400).send("No query");

    try {
        console.log(`🔍 Searching: ${query}`);
        const searchData = await fetchFromPiped(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
        
        if (!searchData.items || !searchData.items[0]) throw new Error("No results");

        const videoId = searchData.items[0].url.split("v=")[1];
        const streamData = await fetchFromPiped(`/streams/${videoId}`);
        
        const audioStream = streamData.audioStreams.find(s => s.format === "M4A") || streamData.audioStreams[0];

        res.setHeader("Content-Type", "audio/mpeg");
        ffmpeg(audioStream.url)
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("error", (err) => console.log("Stream Error:", err.message))
            .pipe(res, { end: true });

    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).send("Service busy. Try again.");
    }
});

// ✅ 5. DOWNLOAD ROUTE
app.get("/download", async (req, res) => {
    try {
        const query = req.query.q;
        const searchData = await fetchFromPiped(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
        const videoId = searchData.items[0].url.split("v=")[1];
        const streamData = await fetchFromPiped(`/streams/${videoId}`);
        const audioUrl = streamData.audioStreams.find(s => s.format === "M4A").url;

        res.setHeader("Content-Disposition", `attachment; filename="song.mp3"`);
        ffmpeg(audioUrl).audioCodec("libmp3lame").format("mp3").pipe(res);
    } catch (err) { res.status(500).send("Download error"); }
});

app.listen(PORT, () => console.log(`🚀 Music App Ready: http://localhost:${PORT}`));
