import fs from "fs/promises";
import { renderToString } from "./urpc.js";

// Specify the path to your HTML file
const filePath = "demo-simple.html";

// Async function to read the HTML file and process it
async function run() {
  try {
    const data = await fs.readFile(filePath, "utf8");
    const { template } = await renderToString(data);
    console.log(template);
  } catch (err) {
    console.error(`Error reading the file: ${err}`);
  }
}

run();
