const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// FFmpeg setup
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. HOME ROUTE
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ 2. SMART SUGGESTION ROUTE (Google API)
app.get("/suggest", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data[1].slice(0, 7));
    } catch (err) {
        res.json([]);
    }
});

// ✅ 3. PLAY STREAM ROUTE (Piped API - No YouTube Block)
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No song provided");

    console.log(`🎧 Requesting Play: ${query}`);

    try {
        // Step 1: Search using Piped API (Alternative to YouTube)
        const searchUrl = `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.items || searchData.items.length === 0) {
            return res.status(404).send("Song not found");
        }

        // Step 2: Extract Video ID and get Stream Info
        const videoId = searchData.items[0].url.split("v=")[1];
        const streamRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
        const streamData = await streamRes.json();

        // Step 3: Find the best audio stream
        const audioStream = streamData.audioStreams.find(s => s.format === "M4A") || streamData.audioStreams[0];

        console.log("✅ Stream found! Buffering...");

        // Step 4: Headers for Audio Streaming
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Transfer-Encoding", "chunked");

        // Step 5: Convert to MP3 and Pipe to Response
        ffmpeg(audioStream.url)
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("error", (err) => console.log("FFmpeg Play Error:", err.message))
            .pipe(res, { end: true });

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        res.status(500).send("Something went wrong. Try again.");
    }
});

// ✅ 4. DOWNLOAD ROUTE
app.get("/download", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No song provided");

    console.log(`⬇️ Downloading: ${query}`);

    try {
        const searchUrl = `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        const videoId = searchData.items[0].url.split("v=")[1];
        const streamRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
        const streamData = await streamRes.json();
        const audioUrl = streamData.audioStreams.find(s => s.format === "M4A").url;

        const safeFilename = query.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
        
        res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader("Content-Type", "audio/mpeg");

        ffmpeg(audioUrl)
            .audioCodec("libmp3lame")
            .audioBitrate(192)
            .format("mp3")
            .on("error", (err) => console.log("Download Error:", err.message))
            .pipe(res, { end: true });

    } catch (err) {
        res.status(500).send("Download failed.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Music App Ready: http://localhost:${PORT}`);
});
