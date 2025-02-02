import path from 'path';
import { readFileSync, readdirSync } from 'fs';
import fetch from 'node-fetch';
import { parseEBon } from 'rewe-ebon-parser';

const pdfFolder = path.join(process.cwd(), 'static', 'ebons');
const geoCache = new Map();

async function getLatLong(city, zip, street) {
    const query = `${street}, ${zip}, ${city}`;

    if (geoCache.has(query)) {
        return geoCache.get(query);
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
        const latLong = { lat: data[0].lat, lon: data[0].lon };
        geoCache.set(query, latLong);
        console.log(`Geocoded: ${city}, ${zip}, ${street} → lat: ${latLong.lat}, lon: ${latLong.lon}`);
        return latLong;
    }

    console.error(`Could not find geolocation for: ${city}, ${zip}, ${street}`);
    return { lat: null, lon: null };
}

async function parseEbons() {
    const files = readdirSync(pdfFolder).filter(file => file.endsWith('.pdf'));
    const results = [];
    const uniqueMarkets = new Map();

    for (const file of files) {
        try {
            const filePath = path.join(pdfFolder, file);
            console.log(`Processing: ${filePath}`);
            const dataBuffer = readFileSync(filePath);
            const receipt = await parseEBon(dataBuffer);

            if (receipt.marketAddress) {
                const { city, zip, street } = receipt.marketAddress;
                if (city && zip && street) {
                    const marketKey = `${street}, ${zip}, ${city}`;
                    uniqueMarkets.set(marketKey, { city, zip, street });
                }
            }

            results.push(receipt);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }

    // Fetch geolocation for each unique market
    const geoPromises = [];
    uniqueMarkets.forEach((marketData, key) => {
        geoPromises.push(
            getLatLong(marketData.city, marketData.zip, marketData.street)
            .then(geoData => {
                uniqueMarkets.set(key, { ...marketData, ...geoData });
            })
        );
    });
    await Promise.all(geoPromises);

    results.forEach(receipt => {
        if (receipt.marketAddress) {
            const { city, zip, street } = receipt.marketAddress;
            const marketKey = `${street}, ${zip}, ${city}`;
            const geoData = uniqueMarkets.get(marketKey);
            if (geoData) {
                receipt.marketAddress.lat = geoData.lat;
                receipt.marketAddress.lon = geoData.lon;
            }
            receipt.marketAddress = JSON.stringify(receipt.marketAddress);
        }
        if (receipt.items) receipt.items = JSON.stringify(receipt.items);
        if (receipt.given) receipt.given = JSON.stringify(receipt.given);
        if (receipt.payback) receipt.payback = JSON.stringify(receipt.payback);
        if (receipt.taxDetails) receipt.taxDetails = JSON.stringify(receipt.taxDetails);
    });

    if (results.length === 0) {
        console.log(`[WARNING] No data found or parsed from ${pdfFolder}`);
        return [{ message: "No data available" }];
    }

    return results;
}

const data = await parseEbons();
export { data };
