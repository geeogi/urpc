class RPCDirectory extends HTMLElement {
  constructor() {
    super();
    this.addresses = new Map();
  }

  connectedCallback() {
    this.loadEntries();
  }

  // Method to load addresses from the light DOM
  loadEntries() {
    const entryElements = this.querySelectorAll("r-address");
    entryElements.forEach((address) => {
      const name = address.getAttribute("name");
      const value = address.textContent.trim();
      if (name) {
        this.addresses.set(name, value);
      }
    });
  }

  // Method to get an address by name
  getAddress(name) {
    return this.addresses.get(name) || null;
  }

  // If dynamic updates of addresses are needed
  updateEntry(name, value) {
    this.addresses.set(name, value);
  }
}

customElements.define("r-directory", RPCDirectory);
