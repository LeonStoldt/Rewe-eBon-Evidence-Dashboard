import path from 'path';
import { readFileSync, readdirSync } from 'fs';
import { parseEBon } from 'rewe-ebon-parser';

const pdfFolder = path.join(process.cwd(), 'static', 'ebons');

async function parseEbons() {
  const files = readdirSync(pdfFolder).filter((file) => file.endsWith('.pdf'));
  const results = [];
  for (const file of files) {
      try {
        const filePath = path.join(pdfFolder, file);
        console.log(`Processing: ${filePath}`);
        const dataBuffer = readFileSync(filePath);
        const receipt = await parseEBon(dataBuffer);
//        console.log(`Parsed data for ${file}:`, JSON.stringify(receipt, null, 2));

        if (receipt.marketAddress) {
          receipt.marketAddress = JSON.stringify(receipt.marketAddress);
        }
        if (receipt.items) {
          receipt.items = JSON.stringify(receipt.items);
        }
        if (receipt.given) {
          receipt.given = JSON.stringify(receipt.given);
        }
        if (receipt.payback) {
          receipt.payback = JSON.stringify(receipt.payback);
        }
        if (receipt.taxDetails) {
          receipt.taxDetails = JSON.stringify(receipt.taxDetails);
        }

        results.push(receipt);
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }

  if (results.length === 0) {
    console.log(`[WARNING] No data could be found or parsed from ${pdfFolder}`);
    return [{ message: "No data available" }];
  }

  return results;
}

const data = await parseEbons();
export { data };