// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// function to mimic Object.fromEntries without polluting the object primitive
//
// node v10 doesn't have fromentries
// remove this once we use node > v12
export function objectFromEntries(entriesIterator) {
  if (typeof Object.fromEntries === 'undefined') {
    const result = {};
    for (const [key, value] of entriesIterator) {
      if (typeof key !== 'undefined') {
        result[key] = value;
      }
    }
    return result;
  }
  console.warn('seems we are already using node v12 or greater to build the desktop app, we can remove this code');
  return Object.fromEntries(entriesIterator);
}
