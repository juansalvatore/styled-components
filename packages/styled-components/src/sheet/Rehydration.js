// @flow

import { SC_ATTR, SC_ATTR_ACTIVE, SC_ATTR_VERSION, SC_VERSION } from '../constants';
import { getIdForGroup, setGroupForId } from './GroupIDAllocator';
import type { Sheet } from './types';

const SELECTOR = `style[${SC_ATTR}][${SC_ATTR_VERSION}="${SC_VERSION}"]`;
const RULE_RE = /(?:\s*)?(.*?){((?:{[^}]*}|(?!{).*?)*)}/g;
const MARKER_RE = new RegExp(`^${SC_ATTR}\\.g(\\d+)\\[id="([\\w\\d-]+)"\\]`);

export const outputSheet = (sheet: Sheet) => {
  const tag = sheet.getTag();
  const { length } = tag;

  let css = '';
  for (let group = 0; group < length; group++) {
    const id = getIdForGroup(group);
    if (id === undefined) continue;

    const names = sheet.names.get(id);
    const rules = tag.getGroup(group);
    if (names === undefined || rules.length === 0) continue;

    const selector = `${SC_ATTR}.g${group}[id="${id}"]`;

    let content = '';
    if (names !== undefined) {
      names.forEach(name => {
        if (name.length > 0) {
          content += `${name},`;
        }
      });
    }

    // NOTE: It's easier to collect rules and have the marker
    // after the actual rules to simplify the rehydration
    css += `${rules}${selector}{content:"${content}"}\n`;
  }

  return css;
};

const rehydrateNamesFromContent = (sheet: Sheet, id: string, content: string) => {
  const names = content.split(',');
  let name;

  for (let i = 0, l = names.length; i < l; i++) {
    // eslint-disable-next-line
    if ((name = names[i])) {
      sheet.registerName(id, name);
    }
  }
};

const rehydrateSheetFromTag = (sheet: Sheet, style: HTMLStyleElement) => {
  const rawHTML = style.innerHTML;
  const rules: string[] = [];
  let parts;

  // parts = [match, selector, content]
  // eslint-disable-next-line no-cond-assign
  while ((parts = RULE_RE.exec(rawHTML))) {
    const marker = parts[1].match(MARKER_RE);

    if (marker) {
      const group = parseInt(marker[1], 10) | 0;
      const id = marker[2];

      if (group !== 0) {
        // Rehydrate componentId to group index mapping
        setGroupForId(id, group);
        // Rehydrate names and rules
        // looks like: data-styled.g11[id="idA"]{content:"nameA,"}
        rehydrateNamesFromContent(sheet, id, parts[2].split('"')[1]);
        sheet.getTag().insertRules(group, rules);
      }

      rules.length = 0;
    } else {
      rules.push(parts[0].trim());
    }
  }
};

export const rehydrateSheet = (sheet: Sheet) => {
  const nodes = document.querySelectorAll(SELECTOR);

  for (let i = 0, l = nodes.length; i < l; i++) {
    const node = ((nodes[i]: any): HTMLStyleElement);
    if (node && node.getAttribute(SC_ATTR) !== SC_ATTR_ACTIVE) {
      rehydrateSheetFromTag(sheet, node);

      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  }
};
