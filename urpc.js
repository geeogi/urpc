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
    const { type, to, method, args } = this.loadAttributes();
    const url = document.querySelector(URL_TAG)?.textContent?.trim();
    const response = await callRPC(url, type, to, method, args);

    if (response) {
      // Handle the successful RPC response
      const { value } = response;
      const decimals = lookup(this.getAttribute("decimals"));
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
    return { type, to, method, args };
  }
}

// Call RPC
async function callRPC(url, type, contractAddress, methodSignature, args = []) {
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

// SSR
async function generateCacheForHTMLString(html) {
  const url = html.split(URL_TAG)[1].split(">")[1].split(`</${URL_TAG}`).trim();

  const vars = html
    .split(DIRECTORY_TAG)[1]
    .split(DIRECTORY_TAG)[0]
    .split("<var");

  const directory = new Map();

  vars.forEach((variable) => {
    const name = variable.split('name="')[1].split('"')[0];
    const value = variable.split('">')[1].split("</var")[0];
    directory.set(name, value);
  });

  const lookup = (v) => directory.get(v) || v;

  const calls = html.split(`<${CALL_TAG}`).map(async (call) => {
    const type = call.split('type="')[1]?.split('"')[0] || "eth_call";
    const to = lookup(call.split('to="')[1].split('"')[0]);
    const method = lookup(call.split('method="')[1].split('"')[0]);
    const args = call.split('args="')[1].split('"')[0].split(",").map(lookup);
    const decimals = lookup(call.split('decimals="')[1].split('"')[0]);
    const response = await callRPC(url, type, to, method, args);
    const { value } = response;
    return parseReturn(value, decimals);
  });

  console.log(await Promise.all(calls));
}

customElements.define(DIRECTORY_TAG, URPCDirectory);
customElements.define(CALL_TAG, URPCCall);
