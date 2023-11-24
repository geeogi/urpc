const TAG_PREFIX = "u";
const DIRECTORY_TAG = `${TAG_PREFIX}-directory`;
const URL_TAG = `${TAG_PREFIX}-url`;
const CALL_TAG = `${TAG_PREFIX}-c`;

/*
 * Define web component classes for browser environments
 */
if (typeof window !== "undefined") {
  /*
   *
   * ## Directory ##
   *
   * Define variables in your HTML to use
   * throughout urpc using the key:value syntax
   *
   * <urpc-directory>
   *   <var>stETH:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84</var>
   *   <var>balanceOf(address):0x70a08231</var>
   * </urpc-directory>
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
        const [key, value] = variable.textContent.trim().split(":");
        this.variables.set(key, value);
      });
    }

    // Method to lookup a value in this directory
    lookup(value) {
      if (value?.includes("$")) {
        const key = value.replace("$", "");
        return this.variables.get(key);
      } else {
        return value;
      }
    }
  }

  /*
   * ## RPC CALL ##
   *
   * Make inline RPC calls directly in your HTML template
   *
   * <urpc-call>$stETH.balanceOf($unstETH).18</urpc-call>
   */
  class URPCCall extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    // Executes the RPC call
    async connectedCallback() {
      const { type, to, method, args, decimals, call } = this.loadAttributes();
      const url = document.querySelector(URL_TAG)?.textContent?.trim();
      const response = await callRPC(url, type, to, method, args);

      if (response) {
        // Handle the successful RPC response
        const { value } = response;
        const displayValue = parseReturn(value, decimals);
        const key = Date.now();
        const arg0 = response.args?.[0];
        const arg1 = response.args?.[1];
        const arg0Name = call.args?.[0]?.replace("$", "");
        const arg1Name = call.args?.[1]?.replace("$", "");
        const toName = call.to?.replace("$", "");
        const methodName = call.method?.replace("$", "");
        const onClick = `this.getRootNode().getElementById('dialog-${key}').showModal()`;

        this.shadowRoot.innerHTML = [
          `<span>${displayValue}</span>`,
          "&nbsp;",
          "&nbsp;",
          `<button onclick="${onClick}">ⓘ</button>`,
          `<dialog id="dialog-${key}">
            <p><b>contract</b>: ${toName} (${response.to})</p>
            <p><b>method</b>: ${methodName} (${response.method})</p>
            ${arg0 ? `<p><b>arg0</b>: ${arg0Name}  (${arg0})</p>` : ""}
            ${arg1 ? `<p><b>arg1</b>: ${arg1Name}  (${arg1})</p>` : ""}
            <p><b>result</b>: ${displayValue}</p>
            <form method="dialog">
              <button>close</button>
            </form>
          </dialog>`,
        ].join("");

        this.style.display = "inline";
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
      const call = parseUrpcCallString(this.textContent.trim());
      const to = lookup(call.to);
      const method = lookup(call.method);
      const args = call.args.map(lookup);
      const decimals = lookup(call.decimals);
      return { type, to, method, args, decimals, call };
    }
  }

  customElements.define(DIRECTORY_TAG, URPCDirectory);
  customElements.define(CALL_TAG, URPCCall);
}

/*
 * Parse the urpc call string syntax: $to.$method($args)?.$decimals
 *
 * e.g. $stETH.balanceOf($unstETH).18
 */
function parseUrpcCallString(call) {
  const to = call.split(".")[0];
  const methodName = call.split(".")[1].split("(")[0];
  const args = call
    .split("(")[1]
    .split(")")[0]
    .split(",")
    .filter((arg) => arg !== "");
  const method = `${methodName}(${args.map((_) => "address")})`;
  const decimals = call.split(")")[1].split(".")[1];
  return { to, method, args, decimals, call };
}

// Make an RPC call
async function callRPC(url, type, to, method, args = []) {
  const data = encodeMethodCall(method, args);

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: type,
    params: [{ to, data }, "latest"],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (json.error) {
    console.error("RPC call failed:", { to, method, args });
    throw new Error(json.error.message);
  }

  const value = json.result;

  return { type, to, method, args, value };
}

// Encode method call data
function encodeMethodCall(method, args) {
  let data = method;
  for (let i = 0; i < args.length; i++) {
    data += padArgument(args[i]);
  }
  return data;
}

// Pad value to 32 bytes
function padArgument(arg) {
  return arg.startsWith("0x")
    ? arg.slice(2).padStart(64, "0")
    : arg.padStart(64, "0");
}

// Pretty parse return value
function parseReturn(value, decimals) {
  if (decimals !== undefined) {
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

// SSR: render urpc HTML in server environments
async function renderToString(html) {
  const url = html
    .split(`<${URL_TAG}`)[1]
    .split(">")[1]
    .split(`</${URL_TAG}`)[0]
    .trim();

  const vars = html
    .split(`<${DIRECTORY_TAG}`)[1]
    .split(`</${DIRECTORY_TAG}`)[0]
    .split("<var>")
    .filter((item) => item.includes("</var>"))
    .map((item) => item.split("</var>")[0]);

  const directory = new Map();

  vars.forEach((variable) => {
    const [key, value] = variable.split(":");
    directory.set(key, value);
  });

  const lookup = (v) =>
    v?.includes("$") ? directory.get(v.replace("$", ""))?.trim() : v || v;

  const calls = await Promise.all(
    html
      .split(`<${CALL_TAG}`)
      .filter((item) => item.includes(`</${CALL_TAG}`))
      .map(async (item) => {
        const type = item.split('type="')[1]?.split('"')[0] || "eth_call";
        const key = item.split('key="')[1]?.split('"')[0];
        const callString = item.split(">")[1].split(`</${CALL_TAG}`)[0];
        const call = parseUrpcCallString(callString);
        const to = lookup(call.to);
        const method = lookup(call.method);
        const args = call.args.map(lookup);
        const decimals = lookup(call.decimals);
        const result = await callRPC(url, type, to, method, args);
        const { value } = result;
        const displayValue = parseReturn(value, decimals);

        return {
          key,
          callString,
          to,
          method,
          args,
          decimals,
          displayValue,
          result,
        };
      })
  );

  let template = html.slice();
  const json = { values: {} };

  // insert call results
  calls.forEach((result) => {
    template =
      template.split(`<${CALL_TAG}`)[0] +
      result.displayValue +
      template.split(`</${CALL_TAG}>`).slice(1).join(`</${CALL_TAG}>`);

    json.values[result.key || result.callString] = result;
  });

  // remove url
  template =
    template.split(`<${URL_TAG}`)[0] + template.split(`</${URL_TAG}>`)[1];

  // remove directory
  template =
    template.split(`<${DIRECTORY_TAG}`)[0] +
    template.split(`</${DIRECTORY_TAG}>`)[1];

  // cleanup blank lines
  template = template
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");

  return { template, json };
}

if (typeof module !== "undefined") {
  module.exports = { renderToString };
}
