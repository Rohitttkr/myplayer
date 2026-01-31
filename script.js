const express = require("express");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. HOME ROUTE
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ✅ 2. PLAY ROUTE (Axios + JioSaavn API)
app.get("/play", async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).send("Gaana likho bhai!");

    try {
        console.log(`🎵 Searching: ${query}`);
        
        // Search API call
        const response = await axios.get(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
        
        if (!response.data || !response.data.data.results.length) {
            return res.status(404).send("Gaana nahi mila.");
        }

        const song = response.data.data.results[0];
        // 320kbps link sabse last mein hota hai
        const downloadUrl = song.downloadUrl[song.downloadUrl.length - 1].url;

        console.log(`✅ Success: Playing ${song.name}`);
        
        // Browser ko direct gaane ke link par bhej do
        res.redirect(downloadUrl);

    } catch (err) {
        console.error("❌ Error details:", err.message);
        res.status(500).send("Server Busy. Refresh karke dekho.");
    }
});

// ✅ 3. DOWNLOAD ROUTE
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

app.listen(PORT, () => console.log(`🚀 Music App Ready on Port ${PORT}`));
