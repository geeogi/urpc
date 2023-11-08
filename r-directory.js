class RPCDirectory extends HTMLElement {
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
      if (name) {
        this.variables.set(name, value);
      }
    });
  }

  // Method to get an variable by name
  getVariable(name) {
    return this.variables.get(name) || null;
  }

  // If dynamic updates of variables are needed
  updateEntry(name, value) {
    this.variables.set(name, value);
  }
}

customElements.define("r-directory", RPCDirectory);
