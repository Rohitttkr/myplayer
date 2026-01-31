const express = require("express");
const ytDlp = require("yt-dlp-exec");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000; // Render ke liye dynamic port

// FFmpeg setup
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. HOME ROUTE (Manual File Serving)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ 2. SMART SUGGESTION ROUTE
app.get("/suggest", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        const rawSuggestions = data[1];

        const ignoreWords = ["reaction", "review", "roast", "news", "interview", "gameplay", "trailer", "scene", "explained", "cover", "remix", "parody", "tutorial", "challenge", "vlog", "meme", "live", "full movie", "episode", "podcast", "audiobook", "free fire", "bgmi"];

        const cleanSuggestions = rawSuggestions.filter(item => {
            const lowerItem = item.toLowerCase();
            return !ignoreWords.some(badWord => lowerItem.includes(badWord));
        });

        res.json(cleanSuggestions.slice(0, 7));
    } catch (err) {
        res.json([]);
    }
});

// ✅ 3. PLAY STREAM ROUTE (YouTube Music + Bot Bypass)
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No song provided");

    console.log(`🎧 Requesting: ${query}`);

    try {
        // Step 1: Search on YT Music for better reliability
        const output = await ytDlp(`ytmsearch1:${query}`, {
            dumpJson: true,
            noPlaylist: true,
            f: "bestaudio",
            noWarnings: true,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        });

        if (!output || !output.url) throw new Error("Audio URL not found");

        // Step 2: Set Headers for smooth streaming
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Accept-Ranges", "bytes");

        // Step 3: Convert to MP3 and Pipe
        ffmpeg(output.url)
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("start", () => console.log("✅ Stream Started"))
            .on("error", (err) => {
                console.error("❌ FFmpeg Error:", err.message);
                if (!res.headersSent) res.end();
            })
            .pipe(res, { end: true });

    } catch (err) {
        console.error("❌ yt-dlp Error:", err.message);
        res.status(500).send("YouTube is blocking this. Try again later.");
    }
});

// ✅ 4. DOWNLOAD ROUTE
app.get("/download", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No song provided");

    try {
        const output = await ytDlp(`ytmsearch1:${query}`, {
            dumpJson: true,
            noPlaylist: true,
            f: "bestaudio",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        });

        const safeFilename = query.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
        res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader("Content-Type", "audio/mpeg");

        ffmpeg(output.url)
            .audioCodec("libmp3lame")
            .audioBitrate(192) // Download ke liye thodi better quality
            .format("mp3")
            .pipe(res, { end: true });

    } catch (err) {
        res.status(500).send("Download failed.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Music App Ready: http://localhost:${PORT}`);
});
