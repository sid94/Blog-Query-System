// -*- mode: javascript; -*-

import axios from 'axios';

export default class Blog544Ws {

  constructor(url, topLinks, meta) {
    this.url = url; this.topLinks = topLinks; this.meta = meta;
  }

  static async make(url) {
    try {
      const topLinksData = (await axios.get(url)).data;
      const topLinksPairs =
	    topLinksData.links.filter(e => e.name !== 'self')
	    .map(e => [e.name, e.url]);
      const topLinks = Object.fromEntries(topLinksPairs);
      const meta = (await axios.get(topLinks.meta)).data;
      delete topLinks.meta;
      return new Blog544Ws(url, topLinks, meta);
    }
    catch (err) {
      throw (err.response && err.response.data) || err;
    }
  }

  async list(category, q) {
    try {
      const url = this.topLinks[category];
      if (!url) {
	throw `no web service for category ${category}`;
      }
      const response = await axios.get(url, { params: q });
      return response.data;
    }
    catch (err) {
      throw (err.response && err.response.data) || err;
    }
  }
}
