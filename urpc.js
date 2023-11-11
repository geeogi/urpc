const TAG_PREFIX = "urpc";
const DIRECTORY_TAG = `${TAG_PREFIX}-directory`;
const CALL_TAG = `${TAG_PREFIX}-call`;
const URL_TAG = `${TAG_PREFIX}-url`;

let CACHE = {};

// Define the web components classes conditionally for the browser
if (typeof window !== "undefined") {
  /*
   * Directory
   */
  class URPCDirectory extends HTMLElement {
    constructor() {
      super();
      this.variables = new Map();
    }

    // Load variables from the light DOM
    connectedCallback() {
      const entryElements = this.querySelectorAll("var");
      entryElements.forEach((variable) => {
        const name = variable.getAttribute("name");
        const value = variable.textContent.trim();
        this.variables.set(name, value);
      });
    }

    // Method to lookup a value
    lookup(value) {
      if (value.includes("$")) {
        const key = value.replace("$", "");
        return this.variables.get(key);
      } else {
        return value;
      }
    }
  }

  /*
   * RPC Call
   */
  class URPCCall extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    // Executes the RPC call
    async connectedCallback() {
      const { type, to, method, args, decimals } = this.loadAttributes();
      const url = document.querySelector(URL_TAG)?.textContent?.trim();
      const response = await callRPC(url, type, to, method, args);

      if (response) {
        // Handle the successful RPC response
        const { value } = response;
        this.shadowRoot.innerHTML = parseReturn(value, decimals);
      } else {
        // Handle error or no response
        this.shadowRoot.innerHTML = "Error in RPC call";
      }
    }

    // Extract the attributes needed for the RPC call
    loadAttributes() {
      const directory = document.getElementsByTagName(DIRECTORY_TAG)?.[0];
      const lookup = (v) => directory.lookup(v);
      const type = this.getAttribute("type") || "eth_call";
      const to = lookup(this.getAttribute("to"));
      const method = lookup(this.getAttribute("method"));
      const args = this.getAttribute("args")?.split(",").map(lookup);
      const decimals = lookup(this.getAttribute("decimals"));
      return { type, to, method, args, decimals };
    }
  }

  customElements.define(DIRECTORY_TAG, URPCDirectory);
  customElements.define(CALL_TAG, URPCCall);
}

// Call RPC
async function callRPC(url, type, contractAddress, methodSignature, args = []) {
  const cacheKey = [
    type,
    contractAddress,
    methodSignature,
    args.join(","),
  ].join(";");

  if (CACHE[cacheKey]) {
    return CACHE[cacheKey];
  }

  const data = encodeMethodCall(methodSignature, args);

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: type,
    params: [{ to: contractAddress, data: data }, "latest"],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message);
  }

  const value = json.result;
  const result = { type, contractAddress, methodSignature, args, value };

  CACHE[cacheKey] = result;

  return result;
}

// Encode method call data for Ethereum transaction
function encodeMethodCall(methodSignature, args) {
  let data = methodSignature;
  for (let i = 0; i < args.length; i++) {
    data += padArgument(args[i]);
  }
  return data;
}

// Pad Ethereum address or value to 32 bytes
function padArgument(arg) {
  return arg.startsWith("0x")
    ? arg.slice(2).padStart(64, "0")
    : arg.padStart(64, "0");
}

// Pretty parse return value
function parseReturn(value, decimals) {
  if (decimals) {
    const num = parseInt(value, 16) / 10 ** decimals;
    return num > 9999
      ? // locale comma string for large values
        Math.round(num).toLocaleString()
      : num > 1
      ? // 2 decimal places
        Math.round(num * 100) / 100
      : // 5 decimal places
        Math.round(num * 100000) / 100000;
  } else {
    return value;
  }
}

// SSR
async function generateCacheForHTMLString(html) {
  const url = html
    .split(`<${URL_TAG}`)[1]
    .split(">")[1]
    .split(`</${URL_TAG}`)[0]
    .trim();

  const vars = html
    .split(`<${DIRECTORY_TAG}`)[1]
    .split(`</${DIRECTORY_TAG}`)[0]
    .split("<var")
    .filter((item) => item.includes("var"));

  const directory = new Map();

  vars.forEach((variable) => {
    const name = variable.split('name="')[1].split('"')[0];
    const value = variable.split('">')[1].split("</var")[0];
    directory.set(name, value);
  });

  const lookup = (v) =>
    v?.includes("$") ? directory.get(v.replace("$", "")) : v || v;

  const calls = html
    .split(`<${CALL_TAG}`)
    .filter((item) => item.includes('method="'))
    .map(async (call, index) => {
      console.log(`making call: ${index + 1}`);
      const type = call.split('type="')[1]?.split('"')[0] || "eth_call";
      const to = lookup(call.split('to="')[1].split('"')[0]);
      const method = lookup(call.split('method="')[1].split('"')[0]);
      const args = call.split('args="')[1].split('"')[0].split(",").map(lookup);
      const decimals = lookup(call.split('decimals="')[1].split('"')[0]);
      const response = await callRPC(url, type, to, method, args);
      const { value } = response;
      return parseReturn(value, decimals);
    });

  const results = await Promise.all(calls);

  let template = html.slice();

  results.forEach((result) => {
    template =
      template.split(`<${CALL_TAG}`)[0] +
      result +
      template.split(`</${CALL_TAG}>`).slice(1).join(`</${CALL_TAG}>`);
  });

  template =
    template.split(`<${URL_TAG}`)[0] + template.split(`</${URL_TAG}>`)[1];

  template =
    template.split(`<${DIRECTORY_TAG}`)[0] +
    template.split(`</${DIRECTORY_TAG}>`)[1];

  console.log(template);
}

if (typeof module !== "undefined") {
  module.exports = { generateCacheForHTMLString };
}
