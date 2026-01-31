const express = require("express");
const ytDlp = require("yt-dlp-exec");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

const app = express();
const PORT = 3000;


// FFmpeg setup
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. SMART SUGGESTION ROUTE (Only Songs Logic)
app.get("/suggest", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    try {
        // Hum 'ds=yt' (YouTube datasource) aur 'gl=IN' (India location) use kar rahe hain
        // Taaki result music se relevat aaye
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&gl=IN&q=${encodeURIComponent(query)}`;

        const response = await fetch(url);
        const data = await response.json();
        const rawSuggestions = data[1]; // Google se aayi list

        // 🛡️ FILTER LOGIC: Faltu cheezein hatao
        const ignoreWords = ["reaction", "review", "roast", "news", "interview", "gameplay", "trailer", "scene", "explained", "cover", "remix", "parody", "tutorial", "challenge", "vlog", "meme", "live", "full movie", "episode", "podcast", "audiobook", "free fire", "bgmi"];

        const cleanSuggestions = rawSuggestions.filter(item => {
            const lowerItem = item.toLowerCase();
            // Agar inme se koi bhi ganda word hai, toh use hata do
            return !ignoreWords.some(badWord => lowerItem.includes(badWord));
        });

        // Top 7 clean results bhejo
        res.json(cleanSuggestions.slice(0, 7));

    } catch (err) {
        console.error("Suggestion Error:", err.message);
        res.json([]);
    }
});

// ✅ 2. PLAY STREAM ROUTE
app.get("/play", (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No song provided");

    console.log(`🎧 Streaming: ${query}`);

    try {
        const ytProcess = ytDlp.exec(
            `ytsearch1:${query}`,
            { o: "-", f: "bestaudio", noPlaylist: true, q: "" },
            { stdio: ["ignore", "pipe", "ignore"] }
        );

        // Header ko FFmpeg shuru hone se pehle bhej dein
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Transfer-Encoding", "chunked"); // Browser ko batayega ki data aa raha hai


        ffmpeg(ytProcess.stdout)
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("error", () => { })
            .pipe(res, { end: true });

    } catch (err) {
        console.error("Stream Error:", err);
        res.end();
    }
});

// ✅ 3. DOWNLOAD ROUTE
app.get("/download", (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No song provided");

    console.log(`⬇️ Downloading: ${query}`);

    try {
        const ytProcess = ytDlp.exec(
            `ytsearch1:${query}`,
            { o: "-", f: "bestaudio", noPlaylist: true, q: "" },
            { stdio: ["ignore", "pipe", "ignore"] }
        );

        const safeFilename = query.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

        res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Transfer-Encoding", "chunked"); // Browser ko batayega ki data aa raha hai



        ffmpeg(ytProcess.stdout)
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("error", () => { })
            .pipe(res, { end: true });

    } catch (err) {
        console.error("Download Error:", err);
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Music App Ready: http://localhost:${PORT}`);
});