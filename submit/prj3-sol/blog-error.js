// -*- mode: JavaScript; -*-

export default class BlogError {
  constructor(code, msg) {
    this.code = code;
    this.message = msg;
  }

  toString() { return `${this.code}: ${this.message}`; }
}
