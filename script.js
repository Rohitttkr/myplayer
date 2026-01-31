const express = require("express");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. HOME ROUTE
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ✅ 2. SUGGEST ROUTE (Fixes 404 Error)
app.get("/suggest", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        // Google suggestions API ka use
        const response = await axios.get(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`);
        res.json(response.data[1].slice(0, 7));
    } catch (err) {
        res.json([]);
    }
});

// ✅ 3. PLAY ROUTE (Direct JioSaavn API)
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("Gaana likho bhai!");
    try {
        console.log(`🎵 Searching: ${query}`);
        const response = await axios.get(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
        if (!response.data || !response.data.data.results.length) {
            return res.status(404).send("Gaana nahi mila.");
        }
        const song = response.data.data.results[0];
        const downloadUrl = song.downloadUrl[song.downloadUrl.length - 1].url;
        console.log(`✅ Success: Playing ${song.name}`);
        res.redirect(downloadUrl);
    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).send("Server Busy.");
    }
});

// ✅ 4. DOWNLOAD ROUTE
app.get("/download", async (req, res) => {
    try {
        const query = req.query.q;
        const response = await axios.get(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
        const downloadUrl = response.data.data.results[0].downloadUrl[response.data.data.results[0].downloadUrl.length - 1].url;
        res.redirect(downloadUrl);
    } catch (err) {
        res.status(500).send("Download error.");
    }
});

app.listen(PORT, () => console.log(`🚀 Music App Fixed: http://localhost:${PORT}`));
