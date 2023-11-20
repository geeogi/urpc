const fs = require("fs");
const { renderToString } = require("./urpc");

// Specify the path to your HTML file
const filePath = "demo-simple.html";

// Read the HTML file as a string
fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    console.error(`Error reading the file: ${err}`);
    return;
  }

  // Print the HTML content as a string
  renderToString(data).then(console.log);
});
