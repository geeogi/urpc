const TAG_PREFIX = "urpc";
const DIRECTORY_TAG = `${TAG_PREFIX}-directory`;
const CALL_TAG = `${TAG_PREFIX}-call`;
const URL_TAG = `${TAG_PREFIX}-url`;

/*
 * Directory
 */
class URPCDirectory extends HTMLElement {
  constructor() {
    super();
    this.variables = new Map();
  }

  connectedCallback() {
    this.loadEntries();
  }

  // Method to load variables from the light DOM
  loadEntries() {
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

  // Collects data from the light DOM and executes the RPC call
  async connectedCallback() {
    const directory = document.getElementsByTagName(DIRECTORY_TAG)?.[0];
    const lookup = (v) => directory.lookup(v);
    // Extract the attributes and elements needed for the RPC call
    const type = this.getAttribute("type") || "eth_call";
    const to = lookup(this.getAttribute("to"));
    const method = lookup(this.getAttribute("method"));
    const args = this.getAttribute("args")?.split(",").map(lookup);
    const response = await callRPC(type, to, method, args);

    if (response) {
      // Handle the successful RPC response
      const { value } = response;
      const decimals = parseInt(lookup(this.getAttribute("decimals")));
      this.shadowRoot.innerHTML = parseReturn(value, decimals);
    } else {
      // Handle error or no response
      this.shadowRoot.innerHTML = "Error in RPC call";
    }
  }
}

// Call RPC
async function callRPC(type, contractAddress, methodSignature, args = []) {
  const endpoint = document.querySelector(URL_TAG)?.textContent?.trim();
  const data = encodeMethodCall(methodSignature, args);

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: type,
    params: [{ to: contractAddress, data: data }, "latest"],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message);
  }

  const value = json.result;

  return { type, contractAddress, methodSignature, args, value };
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

customElements.define(DIRECTORY_TAG, URPCDirectory);
customElements.define(CALL_TAG, URPCCall);
