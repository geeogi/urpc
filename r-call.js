class RPCCall extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  // Collects data from the light DOM and executes the RPC call
  async connectedCallback() {
    // Extract the attributes and elements needed for the RPC call
    const parseText = (e) => this.lookup(e?.textContent.trim());
    const getOne = (s) => parseText(this.querySelector(s));
    const getAll = (s) => Array.from(this.querySelectorAll(s)).map(parseText);

    const to = getOne("r-to");
    const methodSignature = getOne("r-method-signature");
    const args = getAll("r-arg");

    const response = await this.callContractMethod(to, methodSignature, args);

    if (response) {
      // Handle the successful RPC response
      this.shadowRoot.innerHTML = `<pre>${JSON.stringify(
        response,
        null,
        2
      )}</pre>`;
    } else {
      // Handle error or no response
      this.shadowRoot.innerHTML = `<pre>Error in RPC call</pre>`;
    }
  }

  // lookup value in the directory
  lookup(value) {
    const directory = document.getElementsByTagName("r-directory")?.[0];

    return directory !== undefined && value?.includes?.("$")
      ? directory.getAddress(value.replace("$", ""))
      : value;
  }

  // fetch the rpc endpoint
  endpoint() {
    return document.querySelector("r-url")?.textContent?.trim();
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

  async callContractMethod(contractAddress, methodSignature, args = []) {
    const data = this.encodeMethodCall(methodSignature, args);

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
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

    return { value, contractAddress, methodSignature, args };
  }
}

customElements.define("r-call", RPCCall);
