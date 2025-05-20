import Block from "./blocks/block.js";

const content = document.getElementById("content");
/**
 * @type {Block[]}
 */
let blocks = [
  Block.fromText(
    "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam",
    0
  ),
];

function renderBlocks() {
  content.innerHTML = "";
  blocks.forEach((block, idx) => {
    const p = block.render();
    block.listen((e) => handleBlockKeydown(e, idx));
    content.appendChild(p);
  });
}

function focusBlock(idx) {
  const block = content.querySelector(`.block[data-idx='${idx}']`);
  if (block) {
    block.focus();
    // Move caret to end
    const range = document.createRange();
    range.selectNodeContents(block);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function handleBlockKeydown(e, idx) {
  const block = e.target;
  console.log(e.key);
  switch (e.key) {
    case "Enter":
      e.preventDefault();
      // Split at caret position
      const sel = window.getSelection();
      const caretPos = sel.focusOffset;
      const text = block.innerText;
      const before = text.slice(0, caretPos);
      const after = text.slice(caretPos);
      blocks[idx] = Block.fromText(before, idx);
      blocks.splice(idx + 1, 0, Block.fromText(after, idx + 1));
      renderBlocks();
      focusBlock(idx + 1);
      break;
    case "Backspace":
      if (block.innerText === "" && blocks.length > 1) {
        e.preventDefault();
        blocks.splice(idx, 1);
        renderBlocks();
        focusBlock(Math.max(0, idx - 1));
      }
      break;
    default:
      // Update block content on input
      setTimeout(() => {
        blocks[idx] = block.innerText;
      }, 0);
      break;
  }
}

renderBlocks();

content.addEventListener("click", (e) => {
  const block = e.target.closest(".block");
  if (block) {
    focusBlock(block.dataset.idx);
  }
});

class MarkdownParser {
  text;
  index;

  constructor(text) {
    this.text = text;
    this.index = 0;
  }

  parse() {
    const blocks = [];
    while (this.peek() !== null) {
      blocks.push(this.parseBlock());
    }
    return blocks;
  }

  parseBlock() {
    const block = [];
    while (this.peek() !== null) {
      block.push(this.next());
    }
    return block.join("");
  }

  peek() {
    if (this.index >= this.text.length) {
      return null;
    }

    return this.text[this.index];
  }

  next() {
    if (this.index >= this.text.length) {
      return null;
    }

    const char = this.text[this.index];
    this.index++;
    return char;
  }
}
