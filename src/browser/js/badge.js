// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

export function createDataURL(text, small) {
  const scale = 2; // should rely display dpi
  const size = (small ? 20 : 16) * scale;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('width', size);
  canvas.setAttribute('height', size);
  const ctx = canvas.getContext('2d');

  // circle
  ctx.fillStyle = '#FF1744'; // Material Red A400
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = (11 * scale) + 'px sans-serif';
  ctx.fillText(text, size / 2, size / 2, size);

  return canvas.toDataURL();
}
