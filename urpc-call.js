// first 8 characters of keccak_256 of e.g. balanceOf(address)
// https://emn178.github.io/online-tools/keccak_256.html
class URPCCall extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  // Collects data from the light DOM and executes the RPC call
  async connectedCallback() {
    // Extract the attributes and elements needed for the RPC call
    const type = this.getAttribute("type") || "eth_call";
    const to = this.lookup(this.getAttribute("to"));
    const method = this.lookup(this.getAttribute("method"));
    const args = this.getAttribute("args")?.split(",").map(this.lookup);
    const response = await this.callRPC(type, to, method, args);

    if (response) {
      // Handle the successful RPC response
      const decimals = parseInt(this.lookup(this.getAttribute("decimals")));
      this.shadowRoot.innerHTML = this.parseReturn(response.value, decimals);
    } else {
      // Handle error or no response
      this.shadowRoot.innerHTML = "Error in RPC call";
    }
  }

  // smart parse return value
  parseReturn(value, decimals) {
    if (decimals) {
      return parseInt(value, 16) / 10 ** decimals;
    } else {
      return value;
    }
  }

  // fetch the directory
  directory() {}

  // lookup value in directory
  lookup(value) {
    const directory = document.getElementsByTagName("urpc-directory")?.[0];

    return value?.includes?.("$")
      ? directory.getVariable(value.replace("$", ""))
      : value;
  }

  // fetch the rpc endpoint
  endpoint() {
    return document.querySelector("urpc-url")?.textContent?.trim();
  }

  // Encode method call data for Ethereum transaction
  encodeMethodCall(methodSignature, args) {
    let data = methodSignature;
    for (let i = 0; i < args.length; i++) {
      data += this.padArgument(args[i]);
    }
    return data;
  }

  // Pad Ethereum address or value to 32 bytes
  padArgument(arg) {
    return arg.startsWith("0x")
      ? arg.slice(2).padStart(64, "0")
      : arg.padStart(64, "0");
  }

  async callRPC(type, contractAddress, methodSignature, args = []) {
    const data = this.encodeMethodCall(methodSignature, args);

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: type,
      params: [{ to: contractAddress, data: data }, "latest"],
    };

    const response = await fetch(this.endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (json.error) {
      throw new Error(json.error.message);
    }

    const value = json.result;

    return { type, contractAddress, methodSignature, args, value };
  }
}

customElements.define("urpc-call", URPCCall);
