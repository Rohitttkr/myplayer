require('dotenv').config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Jamendo API Configuration
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || "709fa152"; // Default test key
const JAMENDO_API_BASE = "https://api.jamendo.com/v3.0";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ 1. SEARCH/SUGGEST ROUTE
app.get("/suggest", async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) {
        return res.json([]);
    }

    try {
        // Jamendo tracks API se search karo
        const url = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=7&namesearch=${encodeURIComponent(query)}&audioformat=mp32`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.headers.status === "success" && data.results) {
            // Clean suggestions with artist name
            const suggestions = data.results.map(track => ({
                title: `${track.name} - ${track.artist_name}`,
                trackId: track.id,
                artist: track.artist_name,
                name: track.name
            }));
            
            res.json(suggestions);
        } else {
            res.json([]);
        }

    } catch (err) {
        console.error("Suggestion Error:", err.message);
        res.json([]);
    }
});

// ✅ 2. GET TRACK DETAILS (for streaming)
app.get("/track", async (req, res) => {
    const trackId = req.query.id;
    
    if (!trackId) {
        return res.status(400).json({ error: "No track ID provided" });
    }

    try {
        const url = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&id=${trackId}&audioformat=mp32&include=licenses`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.headers.status === "success" && data.results.length > 0) {
            const track = data.results[0];
            
            res.json({
                id: track.id,
                name: track.name,
                artist: track.artist_name,
                album: track.album_name,
                duration: track.duration,
                image: track.image || track.album_image,
                audioUrl: track.audio,
                downloadUrl: track.audiodownload,
                canDownload: track.audiodownload_allowed,
                shareUrl: track.shareurl
            });
        } else {
            res.status(404).json({ error: "Track not found" });
        }

    } catch (err) {
        console.error("Track Error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ 3. SEARCH BY QUERY (alternative search method)
app.get("/search", async (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        return res.status(400).json({ error: "No search query" });
    }

    try {
        const url = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=10&namesearch=${encodeURIComponent(query)}&audioformat=mp32&include=musicinfo`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.headers.status === "success") {
            res.json({
                results: data.results.map(track => ({
                    id: track.id,
                    name: track.name,
                    artist: track.artist_name,
                    album: track.album_name,
                    image: track.image || track.album_image,
                    duration: track.duration
                }))
            });
        } else {
            res.json({ results: [] });
        }

    } catch (err) {
        console.error("Search Error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ 4. DOWNLOAD PROXY (optional - for better UX)
app.get("/download", async (req, res) => {
    const trackId = req.query.id;
    
    if (!trackId) {
        return res.status(400).send("No track ID provided");
    }

    try {
        // First get track info to check download permission
        const trackUrl = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&id=${trackId}`;
        const trackResponse = await fetch(trackUrl);
        const trackData = await trackResponse.json();

        if (trackData.results.length === 0) {
            return res.status(404).send("Track not found");
        }

        const track = trackData.results[0];

        if (!track.audiodownload_allowed) {
            return res.status(403).send("Download not allowed for this track");
        }

        // Redirect to Jamendo's download URL
        res.redirect(track.audiodownload);

    } catch (err) {
        console.error("Download Error:", err.message);
        res.status(500).send("Download failed");
    }
});

// ✅ 5. GET POPULAR TRACKS (homepage)
app.get("/popular", async (req, res) => {
    try {
        const url = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=20&order=popularity_month&audioformat=mp32`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.headers.status === "success") {
            res.json({
                tracks: data.results.map(track => ({
                    id: track.id,
                    name: track.name,
                    artist: track.artist_name,
                    image: track.image || track.album_image
                }))
            });
        } else {
            res.json({ tracks: [] });
        }

    } catch (err) {
        console.error("Popular Tracks Error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Jamendo Music App running on: http://localhost:${PORT}`);
    console.log(`📡 Using Jamendo Client ID: ${JAMENDO_CLIENT_ID}`);
});
