class Block {
  /**
   * @type {HTMLElement}
   */
  element;
  listeners = [];

  /**
   * @param {string} text
   * @param {string} type
   */
  constructor(text, type, idx) {
    this.idx = idx;
    this.text = text;
    this.type = type;
  }

  /**
   * @param {function} callback
   */
  listen(callback) {
    this.listeners.push(callback);
    this.element.addEventListener("keydown", callback);
  }

  /**
   * @param {function} callback
   */
  removeListener(callback) {
    this.element.removeEventListener("keydown", callback);
  }

  /**
   * @returns {HTMLElement}
   */
  render() {
    this.listeners.forEach((listener) => {
      this.removeListener(listener);
    });

    switch (this.type) {
      case "text":
      default:
        const p = document.createElement("p");
        p.className = "block";
        p.contentEditable = "true";
        p.dataset.idx = this.idx;
        p.innerText = this.text;
        this.element = p;
        return p;
    }
  }

  /**
   * @returns {string}
   */
  getType() {
    return this.type;
  }

  /**
   * @param {string} text
   * @returns {Block}
   */
  static fromText(text, idx) {
    return new Block(text, "text", idx);
  }
}

export default Block;
