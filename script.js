const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. HOME ROUTE
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ✅ 2. PLAY ROUTE (JioSaavn API - No YouTube, No Blocks)
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("No query");

    try {
        console.log(`🎵 Searching Music API: ${query}`);
        
        // Search for song
        const searchRes = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.results.length === 0) {
            return res.status(404).send("Song not found");
        }

        // Get the top result's best quality download link
        const song = searchData.data.results[0];
        const downloadUrl = song.downloadUrl[song.downloadUrl.length - 1].url; // Highest quality link

        console.log(`✅ Playing: ${song.name}`);

        // Direct redirect to the audio URL (No FFmpeg needed, much faster!)
        res.redirect(downloadUrl);

    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).send("Music server busy, try again.");
    }
});

// ✅ 3. SUGGESTIONS
app.get("/suggest", async (req, res) => {
    try {
        const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(req.query.q)}`);
        const data = await response.json();
        res.json(data[1].slice(0, 7));
    } catch (err) { res.json([]); }
});

// ✅ 4. DOWNLOAD ROUTE
app.get("/download", async (req, res) => {
    const query = req.query.q;
    try {
        const searchRes = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
        const searchData = await searchRes.json();
        const downloadUrl = searchData.data.results[0].downloadUrl[searchData.data.results[0].downloadUrl.length - 1].url;
        res.redirect(downloadUrl);
    } catch (err) { res.status(500).send("Download error"); }
});

app.listen(PORT, () => console.log(`🚀 Music App Ready on Port ${PORT}`));
